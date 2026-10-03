// Pure game rules: board, dealing, placement, line clears, scoring, game over.
// No DOM here. The browser and the server both use this file: the server
// replays a finished game's moves from its seed to verify the score.

import { randomShape, SHAPE_BY_ID, type Shape } from './pieces.ts';
import { rngFrom } from './rng.ts';

export const SIZE = 8;
export const COLORS = 7;
export const EMPTY = -1;
const COMBO_GRACE = 3; // placements without a clear before the combo resets
const BOARD_CLEAR_BONUS = 300;
export const MAX_MOVES = 20_000;

export interface Piece {
  shapeId: string;
  color: number;
}

/** A placement [trayIndex, row, col], or 'u' for the one undo. */
export type Move = [number, number, number] | 'u';

export interface GameState {
  seed: number;
  rng: number; // current random state; advances whenever pieces are dealt
  board: number[]; // SIZE*SIZE color indexes, EMPTY when open
  tray: (Piece | null)[];
  score: number;
  combo: number;
  movesSinceClear: number;
  moves: Move[];
  undoUsed: boolean;
  undo: Snapshot | null;
  over: boolean;
}

type Snapshot = Pick<GameState, 'rng' | 'board' | 'tray' | 'score' | 'combo' | 'movesSinceClear'>;

export interface PlaceResult {
  state: GameState;
  rows: number[];
  cols: number[];
  clearedCells: { row: number; col: number; color: number }[];
  points: number;
  lines: number;
  combo: number;
  boardCleared: boolean;
}

export const shapeOf = (piece: Piece): Shape => SHAPE_BY_ID.get(piece.shapeId)!;
export const idx = (row: number, col: number) => row * SIZE + col;

export function canPlace(board: number[], shape: Shape, row: number, col: number): boolean {
  for (const [r, c] of shape.cells) {
    const rr = row + r;
    const cc = col + c;
    if (rr < 0 || cc < 0 || rr >= SIZE || cc >= SIZE) return false;
    if (board[idx(rr, cc)] !== EMPTY) return false;
  }
  return true;
}

export function fitsAnywhere(board: number[], shape: Shape): boolean {
  for (let row = 0; row <= SIZE - shape.rows; row++) {
    for (let col = 0; col <= SIZE - shape.cols; col++) {
      if (canPlace(board, shape, row, col)) return true;
    }
  }
  return false;
}

/** Rows and columns that would be full if `shape` were placed at row/col. */
export function linesCompletedBy(board: number[], shape: Shape, row: number, col: number) {
  const filled = board.slice();
  for (const [r, c] of shape.cells) filled[idx(row + r, col + c)] = 0;
  const rows: number[] = [];
  const cols: number[] = [];
  for (let i = 0; i < SIZE; i++) {
    let rowFull = true;
    let colFull = true;
    for (let j = 0; j < SIZE; j++) {
      if (filled[idx(i, j)] === EMPTY) rowFull = false;
      if (filled[idx(j, i)] === EMPTY) colFull = false;
    }
    if (rowFull) rows.push(i);
    if (colFull) cols.push(i);
  }
  return { rows, cols };
}

/** Deal three pieces, re-rolling a few times so at least one of them fits when that is possible. */
export function deal(board: number[], rng: () => number): Piece[] {
  let tray: Piece[] = [];
  for (let attempt = 0; attempt < 25; attempt++) {
    tray = [0, 1, 2].map(() => ({ shapeId: randomShape(rng).id, color: Math.floor(rng() * COLORS) }));
    if (tray.some((p) => fitsAnywhere(board, shapeOf(p)))) break;
  }
  return tray;
}

export function newGame(seed: number): GameState {
  const board = new Array(SIZE * SIZE).fill(EMPTY);
  const rng = rngFrom(seed);
  const tray = deal(board, rng.next);
  return {
    seed: seed >>> 0,
    rng: rng.state,
    board,
    tray,
    score: 0,
    combo: 0,
    movesSinceClear: 0,
    moves: [],
    undoUsed: false,
    undo: null,
    over: false,
  };
}

export function hasMoves(state: GameState): boolean {
  return state.tray.some((p) => p !== null && fitsAnywhere(state.board, shapeOf(p)));
}

export function clearPoints(lines: number, combo: number): number {
  return lines === 0 ? 0 : 10 * lines * lines * Math.max(1, combo);
}

export function place(state: GameState, trayIndex: number, row: number, col: number): PlaceResult | null {
  const piece = state.tray[trayIndex];
  if (!piece || state.over || state.moves.length >= MAX_MOVES) return null;
  const shape = shapeOf(piece);
  if (!canPlace(state.board, shape, row, col)) return null;

  const snapshot: Snapshot = {
    rng: state.rng,
    board: state.board,
    tray: state.tray,
    score: state.score,
    combo: state.combo,
    movesSinceClear: state.movesSinceClear,
  };

  const { rows, cols } = linesCompletedBy(state.board, shape, row, col);
  const board = state.board.slice();
  for (const [r, c] of shape.cells) board[idx(row + r, col + c)] = piece.color;

  const clearedCells: PlaceResult['clearedCells'] = [];
  const clearing = new Set<number>();
  for (const r of rows) for (let c = 0; c < SIZE; c++) clearing.add(idx(r, c));
  for (const c of cols) for (let r = 0; r < SIZE; r++) clearing.add(idx(r, c));
  for (const i of clearing) {
    clearedCells.push({ row: Math.floor(i / SIZE), col: i % SIZE, color: board[i] });
    board[i] = EMPTY;
  }

  const lines = rows.length + cols.length;
  let combo = state.combo;
  let movesSinceClear = state.movesSinceClear;
  if (lines > 0) {
    combo += 1;
    movesSinceClear = 0;
  } else {
    movesSinceClear += 1;
    if (movesSinceClear >= COMBO_GRACE) combo = 0;
  }

  const boardCleared = lines > 0 && board.every((v) => v === EMPTY);
  const points = shape.cells.length + clearPoints(lines, combo) + (boardCleared ? BOARD_CLEAR_BONUS : 0);

  let tray = state.tray.slice();
  tray[trayIndex] = null;
  let rngState = state.rng;
  if (tray.every((p) => p === null)) {
    const rng = rngFrom(rngState);
    tray = deal(board, rng.next);
    rngState = rng.state;
  }

  const next: GameState = {
    seed: state.seed,
    rng: rngState,
    board,
    tray,
    score: state.score + points,
    combo,
    movesSinceClear,
    moves: [...state.moves, [trayIndex, row, col]],
    undoUsed: state.undoUsed,
    undo: state.undoUsed ? null : snapshot,
    over: false,
  };
  next.over = !hasMoves(next);

  return { state: next, rows, cols, clearedCells, points, lines, combo, boardCleared };
}

export function canUndo(state: GameState): boolean {
  return !state.undoUsed && state.undo !== null;
}

/** Undo the last placement. Restoring the random state means undo can't fish for a better deal. */
export function undo(state: GameState): GameState {
  if (!canUndo(state)) return state;
  return { ...state, ...state.undo!, moves: [...state.moves, 'u'], undo: null, undoUsed: true, over: false };
}

/** Replay a game from its seed. Returns null if any move is illegal. */
export function replay(seed: number, moves: unknown): GameState | null {
  if (!Array.isArray(moves) || moves.length > MAX_MOVES) return null;
  let state = newGame(seed);
  for (const m of moves) {
    if (m === 'u') {
      if (!canUndo(state)) return null;
      state = undo(state);
      continue;
    }
    if (!Array.isArray(m) || m.length !== 3 || !m.every((n) => Number.isInteger(n))) return null;
    const result = place(state, m[0], m[1], m[2]);
    if (!result) return null;
    state = result.state;
  }
  return state;
}

/** Restore a saved game, returning null if it looks wrong (e.g. saved by an older version). */
export function revive(raw: unknown): GameState | null {
  const s = raw as GameState;
  if (!s || typeof s.seed !== 'number' || typeof s.rng !== 'number' || !Array.isArray(s.moves)) return null;
  if (!Array.isArray(s.board) || s.board.length !== SIZE * SIZE || !Array.isArray(s.tray)) return null;
  if (s.tray.some((p) => p !== null && !SHAPE_BY_ID.has(p.shapeId))) return null;
  if (s.undo && s.undo.tray.some((p) => p !== null && !SHAPE_BY_ID.has(p.shapeId))) return null;
  return s;
}
