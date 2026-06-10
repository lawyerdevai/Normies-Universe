/** Canonical lowercase wallet key — matches placement hashSeed(seed.toLowerCase()). */
export function normalizeWalletAddress(address: string): string {
  let normalized = address.trim().toLowerCase();
  if (normalized.startsWith("holder-")) {
    normalized = normalized.slice(7);
  }
  if (normalized.startsWith("outer-")) {
    normalized = normalized.slice(6);
  }
  return normalized;
}
