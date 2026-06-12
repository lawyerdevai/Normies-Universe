const OPENSEA_BASE = "https://api.opensea.io/api/v2";
const CACHE_SECONDS = 3600;

type OpenSeaAccount = {
  username?: string;
};

async function fetchAccountUsername(
  address: string,
  apiKey: string,
): Promise<string | null> {
  const normalized = address.trim().toLowerCase();

  const res = await fetch(`${OPENSEA_BASE}/accounts/${normalized}`, {
    headers: {
      accept: "application/json",
      "x-api-key": apiKey,
    },
    next: { revalidate: CACHE_SECONDS },
  });

  if (res.status === 404) return null;
  if (!res.ok) return null;

  const data = (await res.json()) as OpenSeaAccount;
  const username = data.username?.trim();
  return username || null;
}

export async function fetchOpenSeaAccountUsernames(
  addresses: string[],
  apiKey: string,
): Promise<Record<string, string | null>> {
  const unique = [
    ...new Set(
      addresses
        .filter((address) => typeof address === "string" && address.trim())
        .map((address) => address.trim().toLowerCase()),
    ),
  ];

  const entries = await Promise.all(
    unique.map(async (address) => {
      const username = await fetchAccountUsername(address, apiKey);
      return [address, username] as const;
    }),
  );

  return Object.fromEntries(entries);
}
