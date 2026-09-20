export const ASFALTO_GRID = 48;

export const ASFALTO_TYPES = new Set([
  'asfalto_curva1', 'asfalto_curva2', 'asfalto_curva3', 'asfalto_curva4',
  'asfalto_h1', 'asfalto_h2', 'asfalto_v1', 'asfalto_v2', 'asfalto_t',
]);

export function isAsfalto(type: string): boolean {
  return ASFALTO_TYPES.has(type);
}

export function snapAsfalto(v: number): number {
  return Math.round(v / ASFALTO_GRID) * ASFALTO_GRID;
}

export type AsfaltoRotation = 0 | 90 | 180 | 270;

export type AsfaltoMeta = {
  type: string;
  mirrored: boolean;
  rotation: AsfaltoRotation;
};

type DecoLike = { id?: string; type: string; x: number; y: number };

const TOL = 6;

export function getNeighborMask(
  x: number, y: number,
  decos: DecoLike[],
  excludeId?: string,
): number {
  const g = ASFALTO_GRID;
  let mask = 0;
  for (const d of decos) {
    if (excludeId && d.id === excludeId) continue;
    if (!ASFALTO_TYPES.has(d.type)) continue;
    const dx = d.x - x;
    const dy = d.y - y;
    if (Math.abs(dx) < TOL && Math.abs(dy + g) < TOL) mask |= 1;
    if (Math.abs(dx - g) < TOL && Math.abs(dy) < TOL) mask |= 2;
    if (Math.abs(dx) < TOL && Math.abs(dy - g) < TOL) mask |= 4;
    if (Math.abs(dx + g) < TOL && Math.abs(dy) < TOL) mask |= 8;
  }
  return mask;
}

// Connectivity (verified against actual PNG images):
// curva1 = NE corner  (connects N and E)  bitmask 3
// curva2 = SE corner  (connects S and E)  bitmask 6
// curva3 = SW corner  (connects S and W)  bitmask 12
// curva4 = NW corner  (connects N and W)  bitmask 9
// h1     = horizontal (connects W and E)  bitmask 10
// v1     = vertical   (connects N and S)  bitmask 5
// t.png base (rotation=0): bar W+E, stem going UP → connects N+W+E (bitmask 11, missing S)
// t      = T-junction, rotation selects missing side:
//   rotation=0:   N+W+E  (bitmask 11) — base image, stem up, missing S
//   rotation=90:  N+E+S  (bitmask 7)  — stem right, missing W
//   rotation=180: W+E+S  (bitmask 14) — stem down, missing N
//   rotation=270: N+S+W  (bitmask 13) — stem left, missing E
export const ASFALTO_CONNECT_MAP: Record<number, AsfaltoMeta> = {
  0:  { type: 'asfalto_h1',     mirrored: false, rotation: 0 },
  1:  { type: 'asfalto_v1',     mirrored: false, rotation: 0 },
  2:  { type: 'asfalto_h1',     mirrored: false, rotation: 0 },
  3:  { type: 'asfalto_curva1', mirrored: false, rotation: 0 },
  4:  { type: 'asfalto_v1',     mirrored: false, rotation: 0 },
  5:  { type: 'asfalto_v1',     mirrored: false, rotation: 0 },
  6:  { type: 'asfalto_curva2', mirrored: false, rotation: 0 },
  7:  { type: 'asfalto_t',      mirrored: false, rotation: 90 },
  8:  { type: 'asfalto_h1',     mirrored: false, rotation: 0 },
  9:  { type: 'asfalto_curva4', mirrored: false, rotation: 0 },
  10: { type: 'asfalto_h1',     mirrored: false, rotation: 0 },
  11: { type: 'asfalto_t',      mirrored: false, rotation: 0 },
  12: { type: 'asfalto_curva3', mirrored: false, rotation: 0 },
  13: { type: 'asfalto_t',      mirrored: false, rotation: 270 },
  14: { type: 'asfalto_t',      mirrored: false, rotation: 180 },
  15: { type: 'asfalto_t',      mirrored: false, rotation: 0 },
};

export function resolveAsfaltoMeta(
  x: number, y: number,
  decos: DecoLike[],
  excludeId?: string,
): AsfaltoMeta {
  const mask = getNeighborMask(x, y, decos, excludeId);
  return ASFALTO_CONNECT_MAP[mask] ?? { type: 'asfalto_h1', mirrored: false, rotation: 0 };
}

export function isNeighborPos(ax: number, ay: number, bx: number, by: number): boolean {
  const g = ASFALTO_GRID;
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return (dx < TOL && Math.abs(dy - g) < TOL) || (dy < TOL && Math.abs(dx - g) < TOL);
}
