import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
import { CiaoService } from "@homebridge/ciao";
import { describe, expect, it, vi } from "vite-plus/test";

const fakeNetworkManager = {
  getInterfaceMap: () => new Map(),
};

const service = (hostname: string) =>
  new CiaoService(fakeNetworkManager as never, {
    name: "Showtime",
    type: "http",
    hostname,
    fixedName: true,
    port: 8585,
    disabledIpv6: true,
  });

describe("patched @homebridge/ciao hostname policy", () => {
  it("keeps the configured device-specific hostname exact", () => {
    expect(service("showtime-foh").getHostname()).toBe("showtime-foh.local.");
  });

  it("rejects a fixed-name conflict instead of changing the hostname", async () => {
    const packageRoot = path.dirname(
      fileURLToPath(import.meta.resolve("@homebridge/ciao/package.json")),
    );
    const { Prober } = (await import(
      pathToFileURL(path.join(packageRoot, "lib", "responder", "Prober.js")).href
    )) as {
      Prober: new (
        responder: unknown,
        server: unknown,
        service: unknown,
      ) => { probe: () => Promise<void>; handleNameChange: () => void };
    };
    const incrementName = vi.fn();
    const fixedService = {
      serviceState: "probing",
      fixedName: true,
      getFQDN: () => "showtime-foh._http._tcp.local.",
      getHostname: () => "showtime-foh.local.",
      incrementName,
    };
    const prober = new Prober({}, {}, fixedService);
    const probing = prober.probe();
    prober.handleNameChange();

    await expect(probing).rejects.toThrow("fixed service name");
    expect(incrementName).not.toHaveBeenCalled();
    expect(fixedService.serviceState).toBe("unannounced");
  });

  it("does not contain process termination in responder failure paths", async () => {
    const packageRoot = path.dirname(
      fileURLToPath(import.meta.resolve("@homebridge/ciao/package.json")),
    );
    const sources = await Promise.all([
      readFile(path.join(packageRoot, "lib", "CiaoService.js"), "utf8"),
      readFile(path.join(packageRoot, "lib", "Responder.js"), "utf8"),
    ]);
    expect(sources.join("\n")).not.toContain("process.exit(1)");
    expect(sources.join("\n")).toContain('emit("republish-error"');
    expect(sources.join("\n")).toContain("service.fixedName");
  });
});
