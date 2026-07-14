import { Effect } from "effect";
import { createServer } from "node:net";
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { ConnectionManager, makeBackendRuntime } from "../index.js";
import { makeLayer, MdnsAdvertiserError } from "./MdnsAdvertiser.js";
import type { ShowtimeConnectionsState, ShowtimeHostnameLabel } from "@showtime/shared";

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
    Effect.flatMap(ConnectionManager, (_) => _.createInvitation("Discovery test client")),
  );

describe("LocalDiscovery", () => {
  it("announces after TCP is listening, prefers the hostname, persists it, and says goodbye", async () => {
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
    const pendingId = invitationId(await createInvitation(runtime));
    const info = await waitForAnnouncement(runtime, pendingId);
    expect(listeningStatus).toBe(404);
    expect(info.candidates[0]).toMatchObject({
      kind: "hostname",
      host: "showtime.local",
    });
    expect(info.candidates[0]?.url).toMatch(
      new RegExp(`^http://showtime\\.local:${port}/#pair=[A-Za-z0-9_-]{43}$`),
    );
    expect(preferred).toEqual(["showtime"]);

    const discoveryPath = path.join(homeDirectory, ".showtime", "discovery.json");
    let persisted = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        expect(JSON.parse(await readFile(discoveryPath, "utf8"))).toEqual({
          version: 1,
          hostnameLabel: "showtime",
        });
        persisted = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
    expect(persisted).toBe(true);

    await runtime.runPromise(
      Effect.flatMap(ConnectionManager, (_) => _.setConnectionsEnabled(false)),
    );
    expect(shutdowns).toBe(1);
    const disabled = await runtime.runPromise(
      Effect.flatMap(ConnectionManager, (_) => _.pairingInfo(pendingId)),
    );
    expect(disabled.discovery).toEqual({ kind: "disabled" });
    expect(disabled.candidates.every((candidate) => candidate.kind === "ip-address")).toBe(true);
    await runtime.dispose();
    expect(shutdowns).toBe(1);
  });

  it("quarantines malformed state and probes from the base label", async () => {
    const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "showtime-discovery-corrupt-"));
    tempHomes.add(homeDirectory);
    const directory = path.join(homeDirectory, ".showtime");
    await mkdir(directory);
    await writeFile(path.join(directory, "discovery.json"), "not-json");
    const advertised: Array<ShowtimeHostnameLabel> = [];
    const advertiser = makeLayer(({ preferredLabel }) => {
      advertised.push(preferredLabel);
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
    await waitForAnnouncement(runtime, invitationId(await createInvitation(runtime)));
    expect(advertised).toEqual(["showtime"]);
    expect(
      (await readdir(directory)).some((name) => name.startsWith("discovery.json.corrupt-")),
    ).toBe(true);
    await runtime.dispose();
  });

  it("retries degraded discovery from the persisted hostname", async () => {
    const homeDirectory = await mkdtemp(path.join(os.tmpdir(), "showtime-discovery-retry-"));
    tempHomes.add(homeDirectory);
    const directory = path.join(homeDirectory, ".showtime");
    await mkdir(directory);
    await writeFile(
      path.join(directory, "discovery.json"),
      JSON.stringify({ version: 1, hostnameLabel: "showtime-1" }),
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
    let degraded = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      const info = await runtime.runPromise(
        Effect.flatMap(ConnectionManager, (_) => _.pairingInfo(pendingId)),
      );
      if (info.discovery.kind === "degraded") {
        degraded = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(degraded).toBe(true);
    const announced = await waitForAnnouncement(runtime, pendingId);
    expect(announced.discovery).toEqual({ kind: "announced", hostname: "showtime-1.local" });
    expect(advertised).toEqual(["showtime-1", "showtime-1"]);
    await runtime.dispose();
  });
});
