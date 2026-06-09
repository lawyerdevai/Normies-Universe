"use client";

export default function Legend() {
  return (
    <div className="pointer-events-none fixed bottom-6 left-6 z-40 rounded-xl border border-white/8 bg-black/45 px-4 py-3 backdrop-blur-md">
      <ul className="space-y-1.5 text-[11px] text-white/45">
        <li className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-100 shadow-[0_0_8px_rgba(255,230,180,0.8)]" />
          Bright stars = holder groups
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-200/90 shadow-[0_0_12px_rgba(255,200,120,0.9)]" />
          Center core = collection center
        </li>
        <li className="flex items-center gap-2">
          <span className="inline-block h-1 w-1 rounded-full bg-white/40" />
          Tiny stars = ambient space
        </li>
      </ul>
    </div>
  );
}
