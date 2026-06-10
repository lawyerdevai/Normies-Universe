"use client";

interface SearchResultLabelProps {
  text: string | null;
  position: { x: number; y: number } | null;
}

export default function SearchResultLabel({
  text,
  position,
}: SearchResultLabelProps) {
  if (!text || !position) return null;

  return (
    <div
      className="pointer-events-none fixed z-[45] whitespace-nowrap rounded-md border border-white/12 bg-black/65 px-2.5 py-1.5 text-[11px] text-amber-50/90 shadow-lg backdrop-blur-sm"
      style={{
        left: position.x + 14,
        top: position.y - 10,
        transform: "translateY(-50%)",
      }}
    >
      {text}
    </div>
  );
}
