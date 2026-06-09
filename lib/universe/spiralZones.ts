export type SpiralZoneKey = "zone1" | "zone2" | "zone3" | "zone4";

export type SpiralZoneSpec = {
  key: SpiralZoneKey;
  label: string;
  radius: number;
  tube: number;
  /** Max radial distance in galaxy-local space for particle brightening. */
  rMax: number;
  rMin: number;
};

export const SPIRAL_ZONES: SpiralZoneSpec[] = [
  {
    key: "zone1",
    label:
      "Inner Core · 25 holders · 50+ Normies each · Top 1.3% of collection",
    radius: 20,
    tube: 12,
    rMin: 0,
    rMax: 30,
  },
  {
    key: "zone2",
    label:
      "Inner Spiral · 132 holders · 10–49 Normies each · 7% of collection",
    radius: 42,
    tube: 14,
    rMin: 30,
    rMax: 58,
  },
  {
    key: "zone3",
    label:
      "Outer Spiral · 382 holders · 2–9 Normies each · 20.2% of collection",
    radius: 68,
    tube: 13,
    rMin: 58,
    rMax: 88,
  },
  {
    key: "zone4",
    label:
      "Outer Reaches · 1,172 holders · 1 Normie each · 62% of collection",
    radius: 100,
    tube: 16,
    rMin: 88,
    rMax: 130,
  },
];

export function zoneIndexForRadius(r: number): number {
  if (r < 30) return 0;
  if (r < 58) return 1;
  if (r < 88) return 2;
  return 3;
}

export function zoneKeyToIndex(key: SpiralZoneKey | null): number {
  if (!key) return -1;
  return SPIRAL_ZONES.findIndex((z) => z.key === key);
}
