import { Effect } from "effect";
import { createServer } from "node:net";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  normalizeShowtimeHostName,
  type ShowtimeConnectionsState,
  type ShowtimeHostnameLabel,
} from "@showtime/shared";
import { ConnectionManager, makeBackendRuntime } from "../index.js";
import { makeLayer, MdnsAdvertiserError } from "./MdnsAdvertiser.js";

const tempHomes = new Set<string>();

afterEach(async () => {
  await Promise.all(Array.from(tempHomes, (home) => rm(home, { recursive: true, force: true })));
  tempHomes.clear();
});

const findAvailablePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") return reject(new Error("No TCP port"));
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });

const waitForAnnouncement = async (
  runtime: ReturnType<typeof makeBackendRuntime>,
  invitationId: string,
) => {
  for (let attempt = 0; attempt < 200; attempt++) {
    const info = await runtime.runPromise(
      Effect.flatMap(ConnectionManager, (_) => _.pairingInfo(invitationId)),
    );
    if (info.discovery.kind === "announced") return info;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Local discovery did not announce");
};

const invitationId = (state: ShowtimeConnectionsState) => {
  const invitation = state.clients.find((client) => client.kind === "pending");
  if (!invitation || invitation.kind !== "pending") throw new Error("Invitation missing");
  return invitation.invitationId;
};

const createInvitation = (runtime: ReturnType<typeof makeBackendRuntime>) =>
  runtime.runPromise(
    Effect.flatMap(ConnectionManager, (_) =>
      _.createInvitation("Discovery test client", "profile_0000000000000000", []),
    ),
  );

describe("LocalDiscovery", () => {
  it("announces after TCP is listening, persists the device-derived name, and says goodbye", async () => {
    const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "showtime-discovery-home-"));
    tempHomes.add(homeDirectory);
    const port = await findAvailablePort();
    const preferred: Array<ShowtimeHostnameLabel> = [];
    let shutdowns = 0;
    let listeningStatus: number | undefined;
    const advertiser = makeLayer(({ preferredLabel }) =>
      Effect.tryPromise(() => fetch(`http://127.0.0.1:${port}/`)).pipe(
        Effect.tap((response) => Effect.sync(() => (listeningStatus = response.status))),
        Effect.orDie,
        Effect.as({
          hostnameLabel: preferredLabel,
          nextEvent: Effect.never,
          shutdown: Effect.sync(() => shutdowns++).pipe(Effect.asVoid),
        }),
        Effect.tap(() => Effect.sync(() => preferred.push(preferredLabel))),
      ),
    );
    const runtime = makeBackendRuntime(
      { host: "127.0.0.1", port, homeDirectory, localDiscovery: true },
      advertiser,
    );

    await runtime.runPromise(Effect.void);
    const info = await waitForAnnouncement(runtime, invitationId(await createInvitation(runtime)));
    const hostName = normalizeShowtimeHostName(os.hostname());
    const label = `showtime-${hostName}`;
    expect(listeningStatus).toBe(404);
    expect(info.candidates[0]).toMatchObject({
      kind: "hostname",
      label: `Recommended — ${label}.local`,
      host: `${label}.local`,
    });
    expect(info.candidates[0]?.url).toMatch(
      new RegExp(
        `^http://${label}\\.local:${port}/#pair=[A-Za-z0-9_-]{43}&profile=profile_0000000000000000$`,
      ),
    );
    expect(preferred).toEqual([label]);
    expect(
      JSON.parse(await readFile(path.join(homeDirectory, ".showtime", "settings.json"), "utf8")),
    ).toEqual({ version: 2, connectionsEnabled: true, hostName });

    await runtime.runPromise(
      Effect.flatMap(ConnectionManager, (_) => _.setConnectionsEnabled(false)),
    );
    expect(shutdowns).toBe(1);
    await runtime.dispose();
    expect(shutdowns).toBe(1);
  });

  it("restarts on an explicit rename and revokes every old connection", async () => {
    const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "showtime-discovery-rename-"));
    tempHomes.add(homeDirectory);
    const advertised: Array<ShowtimeHostnameLabel> = [];
    let shutdowns = 0;
    const advertiser = makeLayer(({ preferredLabel }) => {
      advertised.push(preferredLabel);
      return Effect.succeed({
        hostnameLabel: preferredLabel,
        nextEvent: Effect.never,
        shutdown: Effect.sync(() => shutdowns++).pipe(Effect.asVoid),
      });
    });
    const runtime = makeBackendRuntime(
      {
        host: "127.0.0.1",
        port: await findAvailablePort(),
        homeDirectory,
        localDiscovery: true,
      },
      advertiser,
    );

    await runtime.runPromise(Effect.void);
    const initial = await createInvitation(runtime);
    await waitForAnnouncement(runtime, invitationId(initial));
    const renamed = await runtime.runPromise(
      Effect.flatMap(ConnectionManager, (_) => _.setHostName("main-stage")),
    );
    expect(renamed).toMatchObject({
      hostName: "main-stage",
      hostname: "showtime-main-stage.local",
      clients: [],
    });
    await waitForAnnouncement(runtime, invitationId(await createInvitation(runtime)));
    expect(advertised).toEqual([
      `showtime-${normalizeShowtimeHostName(os.hostname())}`,
      "showtime-main-stage",
    ]);
    expect(shutdowns).toBe(1);
    await runtime.dispose();
    expect(shutdowns).toBe(2);
  });

  it("retries degraded discovery without ever changing the persisted hostname", async () => {
    const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "showtime-discovery-retry-"));
    tempHomes.add(homeDirectory);
    const directory = path.join(homeDirectory, ".showtime");
    await mkdir(directory);
    await writeFile(
      path.join(directory, "settings.json"),
      JSON.stringify({ version: 2, connectionsEnabled: true, hostName: "foh" }),
    );
    const advertised: Array<ShowtimeHostnameLabel> = [];
    const advertiser = makeLayer(({ preferredLabel }) => {
      advertised.push(preferredLabel);
      if (advertised.length === 1) {
        return Effect.fail(
          new MdnsAdvertiserError({ operation: "advertise", cause: new Error("test failure") }),
        );
      }
      return Effect.succeed({
        hostnameLabel: preferredLabel,
        nextEvent: Effect.never,
        shutdown: Effect.void,
      });
    });
    const runtime = makeBackendRuntime(
      {
        host: "127.0.0.1",
        port: await findAvailablePort(),
        homeDirectory,
        localDiscovery: true,
      },
      advertiser,
    );

    await runtime.runPromise(Effect.void);
    const pendingId = invitationId(await createInvitation(runtime));
    const announced = await waitForAnnouncement(runtime, pendingId);
    expect(announced.discovery).toEqual({ kind: "announced", hostname: "showtime-foh.local" });
    expect(advertised).toEqual(["showtime-foh", "showtime-foh"]);
    await runtime.dispose();
  });
});
