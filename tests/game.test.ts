import { describe, expect, it } from 'vitest';
import { canPlace, clearPoints, deal, EMPTY, hasMoves, idx, newGame, place, replay, SIZE, undo, canUndo, type GameState, type Move } from '../shared/game.ts';
import { SHAPES, SHAPE_BY_ID } from '../shared/pieces.ts';

const seeded = (seed = 1) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

const emptyBoard = () => new Array(SIZE * SIZE).fill(EMPTY);

function stateWith(board: number[], shapeIds: string[]): GameState {
  return {
    seed: 1,
    rng: 1,
    board,
    tray: shapeIds.map((shapeId) => ({ shapeId, color: 0 })),
    score: 0,
    combo: 0,
    movesSinceClear: 0,
    moves: [],
    undoUsed: false,
    undo: null,
    over: false,
  };
}

const id = (name: string) => SHAPES.find((s) => s.id.startsWith(name))!.id;

describe('pieces', () => {
  it('generates distinct orientations', () => {
    const count = (name: string) => SHAPES.filter((s) => s.id.startsWith(name + '-')).length;
    expect(count('dot')).toBe(1);
    expect(count('o2')).toBe(1);
    expect(count('i3')).toBe(2);
    expect(count('t4')).toBe(4);
    expect(count('l4')).toBe(8);
    expect(count('s4')).toBe(4);
  });
});

describe('placement', () => {
  it('rejects out-of-bounds and overlapping placements', () => {
    const board = emptyBoard();
    const i3 = SHAPE_BY_ID.get(id('i3'))!;
    expect(canPlace(board, i3, 0, 0)).toBe(true);
    expect(canPlace(board, i3, 0, SIZE - 2)).toBe(false);
    board[idx(0, 1)] = 2;
    expect(canPlace(board, i3, 0, 0)).toBe(false);
  });

  it('clears a full row and scores it', () => {
    const board = emptyBoard();
    for (let c = 0; c < SIZE - 1; c++) board[idx(3, c)] = 1;
    const s = stateWith(board, [id('dot'), id('dot'), id('dot')]);
    const r = place(s, 0, 3, SIZE - 1)!;
    expect(r.rows).toEqual([3]);
    expect(r.lines).toBe(1);
    expect(r.state.board.every((v) => v === EMPTY)).toBe(true);
    expect(r.boardCleared).toBe(true);
    expect(r.points).toBe(1 + clearPoints(1, 1) + 300);
  });

  it('clears a row and column together', () => {
    const board = emptyBoard();
    for (let i = 1; i < SIZE; i++) {
      board[idx(0, i)] = 1;
      board[idx(i, 0)] = 1;
    }
    board[idx(5, 5)] = 1;
    const r = place(stateWith(board, [id('dot'), id('dot'), id('dot')]), 0, 0, 0)!;
    expect(r.lines).toBe(2);
    expect(r.clearedCells.length).toBe(SIZE * 2 - 1);
    expect(r.state.board[idx(5, 5)]).toBe(1);
  });

  it('builds a combo and resets it after three moves without a clear', () => {
    let s = stateWith(emptyBoard(), [id('dot'), id('dot'), id('dot')]);
    s.combo = 2;
    for (let i = 0; i < 2; i++) s = place(s, i, 7, i * 2)!.state;
    expect(s.combo).toBe(2);
    s = place(s, 2, 7, 6)!.state;
    expect(s.combo).toBe(0);
  });

  it('deals a new tray once all three pieces are used', () => {
    let s = stateWith(emptyBoard(), [id('dot'), id('dot'), id('dot')]);
    s = place(s, 0, 0, 0)!.state;
    s = place(s, 1, 0, 2)!.state;
    expect(s.tray.filter(Boolean).length).toBe(1);
    s = place(s, 2, 0, 4)!.state;
    expect(s.tray.filter(Boolean).length).toBe(3);
  });

  it('ends the game when nothing fits', () => {
    const board = emptyBoard().map((_, i) => (i % 2 === (Math.floor(i / SIZE) % 2) ? 1 : EMPTY));
    const s = stateWith(board, [id('i2')]);
    expect(hasMoves(s)).toBe(false);
  });

  it('allows exactly one undo per game', () => {
    let s = stateWith(emptyBoard(), [id('dot'), id('dot'), id('dot')]);
    s = place(s, 0, 0, 0)!.state;
    expect(canUndo(s)).toBe(true);
    s = undo(s);
    expect(s.board[idx(0, 0)]).toBe(EMPTY);
    expect(s.tray[0]).not.toBeNull();
    s = place(s, 0, 0, 0)!.state;
    expect(canUndo(s)).toBe(false);
  });
});

describe('dealing', () => {
  it('gives at least one piece that fits when one exists', () => {
    const board = emptyBoard().map(() => 1);
    board[idx(4, 4)] = EMPTY;
    const rng = seeded(7);
    for (let i = 0; i < 20; i++) {
      const tray = deal(board, rng);
      expect(tray.some((p) => p.shapeId.startsWith('dot'))).toBe(true);
    }
  });

  it('starts with a playable game', () => {
    const s = newGame(3);
    expect(s.tray).toHaveLength(3);
    expect(hasMoves(s)).toBe(true);
  });
});

/** The first legal placement on the board, scanning tray slots then rows then columns. */
function firstLegal(s: GameState): [number, number, number] {
  for (let i = 0; i < 3; i++) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) if (place(s, i, r, c)) return [i, r, c];
    }
  }
  throw new Error('no legal move');
}

/** Play a whole game by always taking the first legal placement, optionally undoing once. */
function autoplay(seed: number, undoAt = -1) {
  let s = newGame(seed);
  while (!s.over) {
    if (s.moves.length === undoAt && canUndo(s)) {
      s = undo(s);
      continue;
    }
    s = place(s, ...firstLegal(s))!.state;
  }
  return s;
}

describe('replay', () => {
  it('reproduces a whole game exactly from its seed and moves', () => {
    for (const seed of [1, 42, 99_999]) {
      const played = autoplay(seed);
      const replayed = replay(seed, played.moves)!;
      expect(replayed).not.toBeNull();
      expect(replayed.over).toBe(true);
      expect(replayed.score).toBe(played.score);
      expect(replayed.board).toEqual(played.board);
    }
  });

  it('handles the undo in the move list', () => {
    const played = autoplay(7, 5);
    expect(played.moves).toContain('u');
    expect(replay(7, played.moves)!.score).toBe(played.score);
  });

  it('rejects illegal or tampered moves', () => {
    const played = autoplay(11);
    const otherSeed = replay(12, played.moves);
    expect(otherSeed === null || otherSeed.board.join() !== played.board.join()).toBe(true);
    expect(replay(11, [[0, 9, 9]])).toBeNull();
    expect(replay(11, ['u'])).toBeNull();
    expect(replay(11, [firstLegal(newGame(11)), 'u', 'u'] as Move[])).toBeNull();
    expect(replay(11, 'nope')).toBeNull();
    expect(replay(11, [[0, 0.5, 0]])).toBeNull();
  });

  it('undo restores the deal, so it cannot fish for better pieces', () => {
    let s = newGame(5);
    for (let i = 0; i < 3; i++) s = place(s, ...firstLegal(s))!.state;
    const dealt = s.tray;
    const lastMove = s.moves[2] as [number, number, number];
    s = undo(s);
    expect(place(s, ...lastMove)!.state.tray).toEqual(dealt);
  });
});
