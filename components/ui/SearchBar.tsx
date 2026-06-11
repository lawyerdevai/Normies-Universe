"use client";

import { useCallback, useState } from "react";

interface SearchBarProps {
  onSearch?: (query: string) => void;
  notFound?: boolean;
}

export default function SearchBar({ onSearch, notFound = false }: SearchBarProps) {
  const [value, setValue] = useState("");

  const submit = useCallback(() => {
    onSearch?.(value);
  }, [onSearch, value]);

  return (
    <div className="pointer-events-auto fixed left-1/2 top-6 z-50 w-64 -translate-x-1/2 sm:w-80">
      <input
        type="search"
        placeholder="SEARCH"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        aria-label="Search wallet or Normie ID"
        className="normie-universe-title w-full rounded-full border border-white/30 bg-black/45 px-4 py-2.5 text-sm font-normal text-white/80 shadow-lg backdrop-blur-md outline-none transition placeholder:text-white/30 focus:border-violet-400/30 focus:ring-1 focus:ring-violet-400/20"
      />
      {notFound ? (
        <p className="mt-1.5 text-center text-xs text-white/45">Not found</p>
      ) : null}
    </div>
  );
}
