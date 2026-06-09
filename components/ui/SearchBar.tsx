"use client";

import { useCallback, useState } from "react";

interface SearchBarProps {
  onSearch?: (query: string) => void;
}

export default function SearchBar({ onSearch }: SearchBarProps) {
  const [value, setValue] = useState("");

  const submit = useCallback(() => {
    onSearch?.(value);
  }, [onSearch, value]);

  return (
    <div className="pointer-events-auto fixed right-6 top-6 z-40 w-64 sm:w-80">
      <input
        type="search"
        placeholder="Search wallet or Normie ID"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        aria-label="Search wallet or Normie ID"
        className="w-full rounded-full border border-white/10 bg-black/45 px-4 py-2.5 text-sm text-white/80 shadow-lg backdrop-blur-md outline-none transition placeholder:text-white/30 focus:border-violet-400/30 focus:ring-1 focus:ring-violet-400/20"
      />
    </div>
  );
}
