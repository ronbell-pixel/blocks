import type {
  FinishResponse,
  LeaderboardRow,
  Period,
  PlayerSummary,
  StartGameResponse,
} from '../shared/api.ts';
import type { Move } from '../shared/game.ts';
import { load, save } from './storage';

let player: PlayerSummary | null = load('player', null);

export const currentPlayer = () => player;

export function setPlayer(p: PlayerSummary | null) {
  player = p;
  save('player', p);
}

async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (player) headers['x-player-id'] = String(player.id);
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(path, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? `Request failed (${res.status})`), { status: res.status });
  return data as T;
}

export const api = {
  players: () => request<PlayerSummary[]>('/api/players'),
  join: (name: string, avatar: string) => request<PlayerSummary>('/api/players', { method: 'POST', body: { name, avatar } }),
  startGame: (theme: string) => request<StartGameResponse>('/api/games', { method: 'POST', body: { theme } }),
  finish: (id: number, moves: Move[], theme: string) =>
    request<FinishResponse>(`/api/games/${id}/finish`, { method: 'POST', body: { moves, theme } }),
  leaderboard: (period: Period) => request<LeaderboardRow[]>(`/api/leaderboard?period=${period}`),
};
