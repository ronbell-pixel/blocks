import { beforeAll, describe, expect, it } from 'vitest';
import { newGame, place, SIZE, type GameState } from '../shared/game.ts';

process.env.DATABASE_PATH = ':memory:';
const service = await import('../server/service.ts');

function playOut(seed: number): GameState {
  let s = newGame(seed);
  while (!s.over) {
    let next: GameState | null = null;
    for (let i = 0; i < 3 && !next; i++)
      for (let r = 0; r < SIZE && !next; r++) for (let c = 0; c < SIZE && !next; c++) next = place(s, i, r, c)?.state ?? null;
    s = next!;
  }
  return s;
}

describe('server', () => {
  let ron: { id: number };
  let janey: { id: number };

  beforeAll(() => {
    ron = service.joinPlayer({ name: 'Ron', avatar: '🎩' });
    janey = service.joinPlayer({ name: 'Janey' });
  });

  it('joins by name without a password, case-insensitively', () => {
    expect(service.joinPlayer({ name: '  ron ' }).id).toBe(ron.id);
    expect(() => service.joinPlayer({ name: '' })).toThrow();
    expect(service.listPlayers().map((p) => p.name).sort()).toEqual(['Janey', 'Ron']);
  });

  it('scores a game only by replaying its moves', () => {
    const g = service.startGame(ron.id, { theme: 'spooky' });
    const played = playOut(g.seed);
    const res = service.finishGame(ron.id, g.id, { moves: played.moves, theme: 'spooky' });
    expect(res.score).toBe(played.score);
    expect(res.newBest).toBe(true);
    expect(res.rankAll).toBe(1);
    expect(() => service.finishGame(ron.id, g.id, { moves: played.moves })).toThrow(/already finished/);
  });

  it('rejects unfinished, tampered, or someone else\'s games', () => {
    const g = service.startGame(janey.id, {});
    const played = playOut(g.seed);
    expect(() => service.finishGame(janey.id, g.id, { moves: played.moves.slice(0, 2) })).toThrow(/not over/);
    expect(() => service.finishGame(janey.id, g.id, { moves: [[0, 50, 50]] })).toThrow(/not valid/);
    expect(() => service.finishGame(ron.id, g.id, { moves: played.moves })).toThrow(/not found/);
  });

  it('ranks players by their best score', () => {
    const g = service.startGame(janey.id, {});
    service.finishGame(janey.id, g.id, { moves: playOut(g.seed).moves });
    const board = service.getLeaderboard('all');
    expect(board.map((r) => r.name)).toContain('Janey');
    expect(board[0].best).toBeGreaterThanOrEqual(board[1].best);
    expect(board.find((r) => r.name === 'Ron')!.theme).toBe('spooky');
    expect(service.getLeaderboard('today').length).toBe(2);
  });

  it('starts "today" at midnight Central time', () => {
    const noonCentral = Date.UTC(2026, 9, 3, 17, 0, 0); // 12:00 CDT
    expect(service.startOfToday(noonCentral)).toBe(Date.UTC(2026, 9, 3, 5, 0, 0));
  });
});
