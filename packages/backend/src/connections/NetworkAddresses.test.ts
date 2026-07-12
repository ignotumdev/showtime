import type { networkInterfaces } from "node:os";
import { describe, expect, it } from "vite-plus/test";
import { discoverCandidates } from "./NetworkAddresses.js";

const address = (value: string) => ({
  address: value,
  family: "IPv4" as const,
  internal: false,
  netmask: "255.255.255.0",
  cidr: `${value}/24`,
  mac: "00:00:00:00:00:00",
});

describe("discoverCandidates", () => {
  it("only exposes private LAN IPv4 addresses", () => {
    const interfaces = {
      ethernet: [address("192.168.1.20"), address("203.0.113.10")],
      wifi: [address("10.0.0.8"), address("172.31.4.5"), address("172.32.4.5")],
    } as ReturnType<typeof networkInterfaces>;

    expect(discoverCandidates(interfaces, 4010, "pairing-token")).toEqual([
      {
        address: "192.168.1.20",
        interfaceName: "ethernet",
        url: "http://192.168.1.20:4010/#pair=pairing-token",
      },
      {
        address: "10.0.0.8",
        interfaceName: "wifi",
        url: "http://10.0.0.8:4010/#pair=pairing-token",
      },
      {
        address: "172.31.4.5",
        interfaceName: "wifi",
        url: "http://172.31.4.5:4010/#pair=pairing-token",
      },
    ]);
  });
});
