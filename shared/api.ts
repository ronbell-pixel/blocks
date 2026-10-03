// Request and response shapes shared by the server and the browser.

import type { Move } from './game.ts';

export interface PlayerSummary {
  id: number;
  name: string;
  avatar: string;
}

export interface JoinRequest {
  name: string;
  avatar?: string;
}

export interface StartGameResponse {
  id: number;
  seed: number;
}

export interface FinishRequest {
  moves: Move[];
  theme?: string;
}

export interface FinishResponse {
  score: number;
  best: number;
  newBest: boolean;
  rankToday: number;
  rankWeek: number;
  rankAll: number;
}

export type Period = 'today' | 'week' | 'all';

export interface LeaderboardRow extends PlayerSummary {
  best: number;
  games: number;
  theme: string | null; // theme of the best game
  lastPlayed: number;
}

export const AVATARS = ['😎', '🎩', '🤠', '👑', '🦄', '🐸', '🐶', '🐱', '🦊', '🐼', '🐵', '🦖', '👻', '🎃', '🤖', '🍕'];
