import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CiaoService } from "@homebridge/ciao";
import { describe, expect, it } from "vite-plus/test";

const fakeNetworkManager = {
  getInterfaceMap: () => new Map(),
};

const service = (hostname: string) =>
  new CiaoService(fakeNetworkManager as never, {
    name: "Showtime",
    type: "http",
    hostname,
    port: 8585,
    disabledIpv6: true,
  });

describe("patched @homebridge/ciao hostname policy", () => {
  it("uses exact Showtime suffixes and resumes after a persisted suffix", () => {
    const first = service("showtime");
    first.incrementName();
    expect(first.getHostname()).toBe("showtime-1.local.");

    const restarted = service("showtime-1");
    restarted.incrementName();
    expect(restarted.getHostname()).toBe("showtime-2.local.");
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
  });
});
