import { randomInt } from 'node:crypto';
import { db } from './db.ts';
import { replay, type Move } from '../shared/game.ts';
import { AVATARS, type FinishResponse, type LeaderboardRow, type Period, type PlayerSummary, type StartGameResponse } from '../shared/api.ts';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const TIME_ZONE = process.env.TIME_ZONE ?? 'America/Chicago';
const DAY = 86_400_000;

interface PlayerRow {
  id: number;
  name: string;
  avatar: string;
}

interface GameRow {
  id: number;
  player_id: number;
  seed: number;
  score: number | null;
}

const q = {
  listPlayers: db.prepare('SELECT id, name, avatar FROM players ORDER BY last_seen DESC'),
  playerById: db.prepare<[number], PlayerRow>('SELECT id, name, avatar FROM players WHERE id = ?'),
  playerByName: db.prepare<[string], PlayerRow>('SELECT id, name, avatar FROM players WHERE name = ?'),
  insertPlayer: db.prepare('INSERT INTO players (name, avatar, created_at, last_seen) VALUES (?, ?, ?, ?)'),
  setAvatar: db.prepare('UPDATE players SET avatar = ? WHERE id = ?'),
  touch: db.prepare('UPDATE players SET last_seen = ? WHERE id = ?'),
  insertGame: db.prepare('INSERT INTO games (player_id, seed, theme, created_at) VALUES (?, ?, ?, ?)'),
  gameById: db.prepare<[number], GameRow>('SELECT id, player_id, seed, score FROM games WHERE id = ?'),
  finishGame: db.prepare('UPDATE games SET score = ?, moves = ?, theme = ?, finished_at = ? WHERE id = ?'),
  bestBefore: db.prepare<[number, number], { best: number | null }>(
    'SELECT MAX(score) AS best FROM games WHERE player_id = ? AND finished_at IS NOT NULL AND id != ?',
  ),
  leaderboard: db.prepare<{ since: number }, LeaderboardRow>(
    `SELECT p.id, p.name, p.avatar,
       MAX(g.score) AS best,
       COUNT(g.id) AS games,
       MAX(g.finished_at) AS lastPlayed,
       (SELECT g2.theme FROM games g2
          WHERE g2.player_id = p.id AND g2.finished_at >= @since
          ORDER BY g2.score DESC, g2.finished_at ASC LIMIT 1) AS theme
     FROM players p JOIN games g ON g.player_id = p.id
     WHERE g.finished_at >= @since
     GROUP BY p.id
     ORDER BY best DESC, lastPlayed ASC`,
  ),
};

const cleanName = (value: unknown) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '');

function requirePlayer(id: number): PlayerRow {
  const p = q.playerById.get(id);
  if (!p) throw new HttpError(401, 'Unknown player');
  return p;
}

/** Midnight today in the friends' time zone, as a timestamp. */
export function startOfToday(now = Date.now(), timeZone = TIME_ZONE): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, hour12: false, hour: 'numeric', minute: 'numeric', second: 'numeric' })
      .formatToParts(new Date(now))
      .map((p) => [p.type, p.value]),
  );
  const hour = Number(parts.hour) % 24;
  return now - ((hour * 60 + Number(parts.minute)) * 60 + Number(parts.second)) * 1000 - (now % 1000);
}

export function periodStart(period: Period, now = Date.now()): number {
  if (period === 'all') return 0;
  const today = startOfToday(now);
  return period === 'today' ? today : today - 6 * DAY;
}

// ---------------------------------------------------------------------------
// Players

export function listPlayers(): PlayerSummary[] {
  return q.listPlayers.all() as PlayerSummary[];
}

export function joinPlayer(input: { name?: unknown; avatar?: unknown }): PlayerSummary {
  const name = cleanName(input.name);
  if (name.length < 1 || name.length > 20) throw new HttpError(400, 'Name must be 1–20 characters');
  const avatar = typeof input.avatar === 'string' && AVATARS.includes(input.avatar) ? input.avatar : null;

  const existing = q.playerByName.get(name);
  const now = Date.now();
  if (existing) {
    if (avatar && avatar !== existing.avatar) q.setAvatar.run(avatar, existing.id);
    q.touch.run(now, existing.id);
    return { ...existing, avatar: avatar ?? existing.avatar };
  }
  const info = q.insertPlayer.run(name, avatar ?? AVATARS[0], now, now);
  return requirePlayer(Number(info.lastInsertRowid));
}

// ---------------------------------------------------------------------------
// Games

export function startGame(playerId: number, input: { theme?: unknown }): StartGameResponse {
  requirePlayer(playerId);
  const seed = randomInt(0, 2 ** 32 - 1);
  const theme = typeof input.theme === 'string' ? input.theme.slice(0, 20) : null;
  const now = Date.now();
  const info = q.insertGame.run(playerId, seed, theme, now);
  q.touch.run(now, playerId);
  return { id: Number(info.lastInsertRowid), seed };
}

/** Replay the moves from the game's seed; only a verified, finished game is scored. */
export function finishGame(playerId: number, gameId: number, input: { moves?: unknown; theme?: unknown }): FinishResponse {
  const game = q.gameById.get(gameId);
  if (!game || game.player_id !== playerId) throw new HttpError(404, 'Game not found');
  if (game.score !== null) throw new HttpError(409, 'Game already finished');

  const final = replay(game.seed, input.moves);
  if (!final) throw new HttpError(400, 'Those moves are not valid for this game');
  if (!final.over) throw new HttpError(400, 'The game is not over yet');

  const now = Date.now();
  const theme = typeof input.theme === 'string' ? input.theme.slice(0, 20) : null;
  const bestBefore = q.bestBefore.get(playerId, gameId)?.best ?? 0;
  q.finishGame.run(final.score, JSON.stringify(input.moves as Move[]), theme, now, gameId);
  q.touch.run(now, playerId);

  const rank = (period: Period) => getLeaderboard(period, now).findIndex((r) => r.id === playerId) + 1;
  return {
    score: final.score,
    best: Math.max(bestBefore, final.score),
    newBest: final.score > bestBefore,
    rankToday: rank('today'),
    rankWeek: rank('week'),
    rankAll: rank('all'),
  };
}

// ---------------------------------------------------------------------------
// Leaderboard

export function getLeaderboard(period: Period, now = Date.now()): LeaderboardRow[] {
  return q.leaderboard.all({ since: periodStart(period, now) });
}

export function parsePeriod(value: unknown): Period {
  return value === 'today' || value === 'week' ? value : 'all';
}
