export const panelShell = (open: boolean) =>
  `pointer-events-auto fixed right-0 top-0 z-40 flex h-full w-[300px] flex-col rounded-l-md border-l border-[rgba(255,255,255,0.06)] bg-[rgba(0,0,0,0.80)] shadow-2xl backdrop-blur-sm transition-transform duration-300 ease-out ${
    open ? "translate-x-0" : "translate-x-full"
  }`;

export const panelHeader = "flex items-start justify-between gap-2 px-3 py-3";
export const panelBody = "scrollbar-none flex-1 overflow-y-auto px-3 pb-3";
export const panelCloseButton =
  "shrink-0 px-1 py-0.5 text-base text-white/40 transition-colors hover:text-white/70";
export const PANEL_ACCENT = "#FF6B00";

export const panelTitle = "text-[15px] font-medium tracking-tight text-amber-50/92";
export const panelAccentLine = "mt-1 text-sm text-white/55";
export const panelLabel = "text-[10px] text-white/35";
export const panelStatValue = "text-[10px] tabular-nums text-white/50";
export const panelValue = "mt-0.5 text-sm tabular-nums text-white/80";
export const panelSectionTitle =
  "mb-2 text-[10px] font-medium uppercase tracking-wide text-white/35";
export const panelEmpty = "text-xs text-white/35";
export const panelMetaButton =
  "shrink-0 rounded px-1.5 py-0.5 text-[9px] text-white/35 transition-colors hover:text-white/55";
