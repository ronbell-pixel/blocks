// Block shapes. Each base shape lists its cells as [row, col]; every distinct
// rotation and mirror image is generated from it.

export type Cell = readonly [number, number];

export interface Shape {
  id: string;
  cells: Cell[];
  rows: number;
  cols: number;
  weight: number;
}

interface BaseShape {
  name: string;
  cells: Cell[];
  weight: number; // relative frequency of the base shape, split across its orientations
  mirror?: boolean;
}

const BASE: BaseShape[] = [
  { name: 'dot', cells: [[0, 0]], weight: 4 },
  { name: 'i2', cells: [[0, 0], [0, 1]], weight: 6 },
  { name: 'i3', cells: [[0, 0], [0, 1], [0, 2]], weight: 7 },
  { name: 'i4', cells: [[0, 0], [0, 1], [0, 2], [0, 3]], weight: 6 },
  { name: 'i5', cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], weight: 4 },
  { name: 'o2', cells: [[0, 0], [0, 1], [1, 0], [1, 1]], weight: 7 },
  { name: 'o3', cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]], weight: 3 },
  { name: 'r23', cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]], weight: 4 },
  { name: 'corner3', cells: [[0, 0], [1, 0], [1, 1]], weight: 6 },
  { name: 'corner5', cells: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], weight: 4 },
  { name: 'l4', cells: [[0, 0], [1, 0], [2, 0], [2, 1]], weight: 6, mirror: true },
  { name: 't4', cells: [[0, 0], [0, 1], [0, 2], [1, 1]], weight: 5 },
  { name: 's4', cells: [[0, 1], [0, 2], [1, 0], [1, 1]], weight: 4, mirror: true },
];

function normalize(cells: Cell[]): Cell[] {
  const minR = Math.min(...cells.map((c) => c[0]));
  const minC = Math.min(...cells.map((c) => c[1]));
  return cells
    .map(([r, c]) => [r - minR, c - minC] as Cell)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

const rotate = (cells: Cell[]): Cell[] => normalize(cells.map(([r, c]) => [c, -r] as Cell));
const flip = (cells: Cell[]): Cell[] => normalize(cells.map(([r, c]) => [r, -c] as Cell));
const key = (cells: Cell[]) => cells.map((c) => c.join(',')).join(';');

function orientations(base: BaseShape): Cell[][] {
  const seen = new Map<string, Cell[]>();
  const starts = base.mirror ? [normalize(base.cells), flip(base.cells)] : [normalize(base.cells)];
  for (let cells of starts) {
    for (let i = 0; i < 4; i++) {
      seen.set(key(cells), cells);
      cells = rotate(cells);
    }
  }
  return [...seen.values()];
}

export const SHAPES: Shape[] = BASE.flatMap((base) => {
  const all = orientations(base);
  return all.map((cells, i) => ({
    id: `${base.name}-${i}`,
    cells,
    rows: Math.max(...cells.map((c) => c[0])) + 1,
    cols: Math.max(...cells.map((c) => c[1])) + 1,
    weight: base.weight / all.length,
  }));
});

export const SHAPE_BY_ID = new Map(SHAPES.map((s) => [s.id, s]));
const TOTAL_WEIGHT = SHAPES.reduce((sum, s) => sum + s.weight, 0);

export function randomShape(rng: () => number): Shape {
  let roll = rng() * TOTAL_WEIGHT;
  for (const shape of SHAPES) {
    roll -= shape.weight;
    if (roll <= 0) return shape;
  }
  return SHAPES[SHAPES.length - 1];
}
