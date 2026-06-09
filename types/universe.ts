export type HolderGroupTier = "core" | "inner" | "middle" | "outer";

export type HolderGroupStar = {
  id: string;
  label: string;
  rankStart: number;
  rankEnd: number;
  holderCount: number;
  totalNormies: number;
  tier: HolderGroupTier;
  size: number;
  brightness: number;
  color: string;
  position: [number, number, number];
  distanceFromCenter: number;
  clickable: true;
  wallet?: string;
  walletDisplay?: string;
  collectionRank?: number;
};

export type AmbientStar = {
  id: string;
  position: [number, number, number];
  size: number;
  brightness: number;
  color: string;
};

export type CameraTarget =
  | { type: "overview" }
  | { type: "group"; group: HolderGroupStar }
  | { type: "core" };

export type UniverseSceneState = {
  hoveredGroup: HolderGroupStar | null;
  selectedGroup: HolderGroupStar | null;
  hoveredCore: boolean;
  selectedCore: boolean;
  cameraTarget: CameraTarget;
};
