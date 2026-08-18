import { describe, expect, it } from "vitest";
import { NETWORK_METADATA_BY_PASSPHRASE } from "./network-metadata.js";
import { WELL_KNOWN_NETWORKS } from "./networks.js";

describe("network metadata", () => {
  it("defines one entry per known SDF network passphrase", () => {
    expect(Object.keys(NETWORK_METADATA_BY_PASSPHRASE)).toEqual([
      "Test SDF Network ; September 2015",
      "Public Global Stellar Network ; September 2015",
      "Test SDF Future Network ; October 2022",
    ]);
  });

  it("derives WELL_KNOWN_NETWORKS from the CLI shorthand networks", () => {
    const shorthandEntries = Object.entries(NETWORK_METADATA_BY_PASSPHRASE).filter(
      ([, metadata]) => metadata.stellarCliShorthand
    );

    expect(Object.keys(WELL_KNOWN_NETWORKS)).toEqual(shorthandEntries.map(([, m]) => m.sdkName));

    for (const [networkPassphrase, metadata] of shorthandEntries) {
      expect(WELL_KNOWN_NETWORKS[metadata.sdkName]).toEqual({
        rpcUrl: metadata.rpcUrl,
        networkPassphrase,
      });
    }
  });

  it("excludes futurenet from WELL_KNOWN_NETWORKS but keeps its boilerplate metadata", () => {
    expect(WELL_KNOWN_NETWORKS.futurenet).toBeUndefined();
    expect(NETWORK_METADATA_BY_PASSPHRASE["Test SDF Future Network ; October 2022"]).toBeDefined();
  });

  it("exposes Horizon URLs only for networks with Horizon (not futurenet)", () => {
    for (const [networkPassphrase, metadata] of Object.entries(NETWORK_METADATA_BY_PASSPHRASE)) {
      if (networkPassphrase === "Test SDF Future Network ; October 2022") {
        expect(metadata.horizonUrl).toBeUndefined();
      } else {
        expect(metadata.horizonUrl).toMatch(/^https:\/\/horizon/);
      }
    }
  });

  it("keeps sdk names unique across metadata entries", () => {
    const sdkNames = Object.values(NETWORK_METADATA_BY_PASSPHRASE).map(
      (metadata) => metadata.sdkName
    );
    expect(new Set(sdkNames).size).toBe(sdkNames.length);
  });
});
