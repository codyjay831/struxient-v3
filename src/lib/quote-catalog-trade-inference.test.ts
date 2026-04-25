import { describe, expect, it } from "vitest";
import {
  CATALOG_TRADES,
  inferPacketTrade,
  inferPresetTrade,
  type CatalogTrade,
  type PacketTradeInferenceInput,
  type PresetTradeInferenceInput,
} from "./quote-catalog-trade-inference";

function preset(overrides: Partial<PresetTradeInferenceInput> = {}): PresetTradeInferenceInput {
  return {
    presetKey: null,
    displayName: "Untitled preset",
    defaultScopePacket: null,
    ...overrides,
  };
}

function packet(overrides: Partial<PacketTradeInferenceInput> = {}): PacketTradeInferenceInput {
  return {
    packetKey: "pkt-untitled",
    displayName: "Untitled packet",
    ...overrides,
  };
}

describe("CATALOG_TRADES", () => {
  it("includes the six required trades in display order with General last", () => {
    expect([...CATALOG_TRADES]).toEqual([
      "Roofing",
      "Electrical",
      "Solar",
      "HVAC",
      "Gutters",
      "General",
    ]);
  });
});

describe("inferPresetTrade — exact presetKey map (Slice E demo catalog)", () => {
  // Validates every seeded demo preset routes to its canonical trade.
  const cases: Array<{ key: string; trade: CatalogTrade }> = [
    { key: "solar-8kw-standard", trade: "Solar" },
    { key: "service-panel-200a", trade: "Electrical" },
    { key: "ev-charger-l2-install", trade: "Electrical" },
    { key: "reroof-30sq-architectural", trade: "Roofing" },
    { key: "chimney-flashing-repair", trade: "Roofing" },
    { key: "commercial-bur-roof-patch", trade: "Roofing" },
    { key: "hvac-condenser-changeout-3t", trade: "HVAC" },
    { key: "gutter-replacement-5in", trade: "Gutters" },
    { key: "permit-residential-standard", trade: "General" },
    { key: "annual-roof-inspection-y1", trade: "Roofing" },
    { key: "permit-fee-passthrough", trade: "General" },
    { key: "travel-mobilization-out-of-region", trade: "General" },
  ];
  for (const c of cases) {
    it(`maps presetKey="${c.key}" → ${c.trade}`, () => {
      expect(inferPresetTrade(preset({ presetKey: c.key, displayName: "Anything" }))).toBe(
        c.trade,
      );
    });
  }

  it("exact-key map wins over substring rules", () => {
    // annual-roof-inspection-y1 contains both "roof" (Roofing) and "inspection"
    // (General). Exact map says Roofing — must win.
    expect(
      inferPresetTrade(
        preset({ presetKey: "annual-roof-inspection-y1", displayName: "Annual roof inspection" }),
      ),
    ).toBe("Roofing");
  });
});

describe("inferPacketTrade — exact packetKey map (Slice E demo catalog)", () => {
  const cases: Array<{ key: string; trade: CatalogTrade }> = [
    { key: "pkt-solar-8kw", trade: "Solar" },
    { key: "pkt-panel-200a", trade: "Electrical" },
    { key: "pkt-ev-charger-install", trade: "Electrical" },
    { key: "pkt-reroof-30sq", trade: "Roofing" },
    { key: "pkt-chimney-flash", trade: "Roofing" },
    { key: "pkt-roof-builtup-repair", trade: "Roofing" },
    { key: "pkt-hvac-condenser-3t", trade: "HVAC" },
    { key: "pkt-gutter-replacement", trade: "Gutters" },
    { key: "pkt-permit-residential", trade: "General" },
    { key: "pkt-roof-annual-inspection", trade: "Roofing" },
  ];
  for (const c of cases) {
    it(`maps packetKey="${c.key}" → ${c.trade}`, () => {
      expect(inferPacketTrade(packet({ packetKey: c.key, displayName: "Anything" }))).toBe(
        c.trade,
      );
    });
  }
});

describe("inferPresetTrade — defaultScopePacket exact-key fallback", () => {
  it("uses linked packet's exact map when presetKey is null", () => {
    expect(
      inferPresetTrade(
        preset({
          presetKey: null,
          displayName: "Tenant-authored preset",
          defaultScopePacket: { packetKey: "pkt-hvac-condenser-3t", displayName: "HVAC stuff" },
        }),
      ),
    ).toBe("HVAC");
  });

  it("uses linked packet's exact map when presetKey is unmapped", () => {
    expect(
      inferPresetTrade(
        preset({
          presetKey: "tenant-custom-preset",
          displayName: "Tenant preset",
          defaultScopePacket: { packetKey: "pkt-gutter-replacement", displayName: "Gutters" },
        }),
      ),
    ).toBe("Gutters");
  });
});

describe("inferPresetTrade — substring fallback", () => {
  it("matches Solar via displayName", () => {
    expect(inferPresetTrade(preset({ displayName: "Solar carport install (10 kW)" }))).toBe(
      "Solar",
    );
  });

  it("matches HVAC via displayName 'mini-split'", () => {
    expect(
      inferPresetTrade(preset({ displayName: "Ductless mini-split installation (single zone)" })),
    ).toBe("HVAC");
  });

  it("matches Gutters via displayName 'downspout'", () => {
    expect(inferPresetTrade(preset({ displayName: "Downspout extension and splash block" }))).toBe(
      "Gutters",
    );
  });

  it("matches Electrical via 'EV charger' before falling through to 'panel'", () => {
    // Both "ev charger" and "panel" appear; "ev charger" is more specific
    // and listed earlier so it must win deterministically.
    expect(
      inferPresetTrade(
        preset({ displayName: "Level 2 EV charger + dedicated sub-panel circuit" }),
      ),
    ).toBe("Electrical");
  });

  it("matches Roofing via 'chimney' before generic 'roof'", () => {
    expect(inferPresetTrade(preset({ displayName: "Chimney crown rebuild + roof tie-in" }))).toBe(
      "Roofing",
    );
  });

  it("matches Roofing via 'reroof'", () => {
    expect(inferPresetTrade(preset({ displayName: "Tear-off and reroof, 22 squares" }))).toBe(
      "Roofing",
    );
  });

  it("matches General via 'permit'", () => {
    expect(inferPresetTrade(preset({ displayName: "Trade permit pull (commercial)" }))).toBe(
      "General",
    );
  });

  it("falls back to General for unrecognized text", () => {
    expect(inferPresetTrade(preset({ displayName: "Window replacement (vinyl, double-hung)" }))).toBe(
      "General",
    );
  });

  it("uses linked packet displayName when preset fields are sparse", () => {
    expect(
      inferPresetTrade(
        preset({
          presetKey: null,
          displayName: "Standard package",
          defaultScopePacket: { packetKey: "tenant-custom", displayName: "HVAC retrofit" },
        }),
      ),
    ).toBe("HVAC");
  });
});

describe("inferPacketTrade — substring fallback", () => {
  it("matches Solar via packetKey alone", () => {
    expect(inferPacketTrade(packet({ packetKey: "pkt-tenant-solar-microgrid", displayName: "Custom" }))).toBe(
      "Solar",
    );
  });

  it("matches Roofing via displayName 'shingle'", () => {
    expect(
      inferPacketTrade(packet({ packetKey: "pkt-custom-1", displayName: "Asphalt shingle re-installation" })),
    ).toBe("Roofing");
  });

  it("falls back to General for unrecognized packets", () => {
    expect(
      inferPacketTrade(packet({ packetKey: "pkt-misc-1", displayName: "Generator install (standby)" })),
    ).toBe("General");
  });
});

describe("inferPresetTrade — purity / total", () => {
  it("never throws on minimal input", () => {
    expect(() => inferPresetTrade(preset())).not.toThrow();
  });

  it("returns General for fully empty-ish input", () => {
    expect(inferPresetTrade(preset({ presetKey: null, displayName: "" }))).toBe("General");
  });
});
