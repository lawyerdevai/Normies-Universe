export type SearchHighlightBaseVisual = {
  coreSize: number;
  glowSize: number;
  glowOpacity: number;
  brightness: number;
  sparkle: number;
};

export type SearchHighlightStore = {
  enlarge: number;
  glimmer: number;
  dimOpacity: number;
  highlightPersist: boolean;
  wallet: string | null;
  starKind: "top75" | "outer" | null;
  pyreGleam: number;
  /** Fixed world position for highlight star — never camera-relative. */
  position: [number, number, number] | null;
  color: string | null;
  /** Lerp start sizes — the star's true appearance before highlight. */
  baseVisual: SearchHighlightBaseVisual | null;
};

export const searchHighlightStore: SearchHighlightStore = {
  enlarge: 0,
  glimmer: 1,
  dimOpacity: 0,
  highlightPersist: false,
  wallet: null,
  starKind: null,
  pyreGleam: 0,
  position: null,
  color: null,
  baseVisual: null,
};
