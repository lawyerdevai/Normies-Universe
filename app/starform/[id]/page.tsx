import StarformView from "@/components/starform/StarformView";

function parseNormieId(raw: string): number | null {
  const id = Number.parseInt(raw, 10);
  if (!Number.isInteger(id) || id < 0 || id > 9999) return null;
  return id;
}

export default async function StarformPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const tokenId = parseNormieId(rawId);

  if (tokenId === null) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black">
        <p className="text-sm text-white/45">Invalid Normie ID</p>
      </div>
    );
  }

  return <StarformView tokenId={tokenId} />;
}
