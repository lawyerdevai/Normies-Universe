"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_LAYER_DEBUG,
  isLayerDebugEnabled,
  LAYER_DEBUG_META,
  type LayerDebugKey,
  type LayerDebugState,
} from "./layerDebug";

interface LayerDebugPanelProps {
  layers: LayerDebugState;
  onChange: (layers: LayerDebugState) => void;
}

export default function LayerDebugPanel({
  layers,
  onChange,
}: LayerDebugPanelProps) {
  const [open, setOpen] = useState(true);

  const toggle = useCallback(
    (key: LayerDebugKey) => {
      onChange({ ...layers, [key]: !layers[key] });
    },
    [layers, onChange],
  );

  useEffect(() => {
    if (!isLayerDebugEnabled()) return;

    const shortcutMap = Object.fromEntries(
      LAYER_DEBUG_META.map((m) => [m.shortcut.toLowerCase(), m.key]),
    ) as Record<string, LayerDebugKey>;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === "`") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }

      const layerKey = shortcutMap[e.key.toLowerCase()];
      if (!layerKey) return;
      e.preventDefault();
      onChange({ ...layers, [layerKey]: !layers[layerKey] });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [layers, onChange]);

  if (!isLayerDebugEnabled()) return null;

  return (
    <div className="pointer-events-auto fixed bottom-4 right-4 z-[60] font-mono text-[10px] text-white/80">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-1 rounded border border-white/15 bg-black/70 px-2 py-1 text-[10px] text-white/60 backdrop-blur-sm hover:text-white/90"
      >
        {open ? "Hide layer debug (`)" : "Show layer debug (`)"}
      </button>

      {open && (
        <div className="max-h-[70vh] w-[280px] overflow-y-auto rounded border border-white/15 bg-black/80 p-3 backdrop-blur-sm">
          <p className="mb-2 text-[9px] uppercase tracking-wider text-white/40">
            Layer isolation — visibility only
          </p>
          <ul className="space-y-1.5">
            {LAYER_DEBUG_META.map(({ key, label, shortcut, note }) => (
              <li key={key}>
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    checked={layers[key]}
                    onChange={() => toggle(key)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="text-white/75">{label}</span>
                    <span className="ml-1 text-white/30">[{shortcut}]</span>
                    {note ? (
                      <span className="block text-[9px] text-white/35">
                        {note}
                      </span>
                    ) : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_LAYER_DEBUG })}
            className="mt-3 w-full rounded border border-white/10 px-2 py-1 text-white/50 hover:text-white/80"
          >
            Reset all layers
          </button>
        </div>
      )}
    </div>
  );
}
