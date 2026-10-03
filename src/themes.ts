// Every theme is one entry in THEMES. To add a holiday, copy an entry, change
// the values, and (optionally) give it a date window in autoThemeId().

export type BlockStyle = 'gloss' | 'pumpkin' | 'leaf' | 'present' | 'egg' | 'star';
export type Ambient = 'sparkles' | 'bats' | 'leaves' | 'snow' | 'petals' | 'stars';

export interface SoundProfile {
  wave: OscillatorType;
  root: number; // Hz
  scale: number[]; // semitone steps from the root
  decay: number; // seconds
  bell?: boolean; // add bell-like overtones
  vibrato?: boolean;
  boom?: boolean; // firework thump on clears
}

export interface Theme {
  id: string;
  name: string;
  emoji: string;
  season: string; // when it shows automatically, for the theme picker
  background: string; // CSS background for the page
  text: string;
  muted: string;
  accent: string;
  panel: string;
  board: string;
  cell: string;
  blocks: string[]; // 7 block colors
  blockStyle: BlockStyle;
  ambient: Ambient;
  ambientEmojis: string[];
  clearEmojis: string[];
  fireworks?: boolean;
  sound: SoundProfile;
  gameOver: string[]; // Janey lines for the game-over card
}

export const THEMES: Theme[] = [
  {
    id: 'classic',
    name: 'Classic',
    emoji: '🎩',
    season: 'Rest of the year',
    background: 'radial-gradient(circle at 20% 0%, #3b1d6e 0%, transparent 55%), radial-gradient(circle at 100% 100%, #0d4d6b 0%, transparent 50%), #120f2a',
    text: '#f6f3ff',
    muted: '#b7b0d6',
    accent: '#ff3d8b',
    panel: 'rgba(255,255,255,0.07)',
    board: '#1c1840',
    cell: 'rgba(255,255,255,0.06)',
    blocks: ['#ff3d8b', '#ff9a3d', '#ffd23d', '#2de2c4', '#4d7cff', '#9b5cff', '#5ee05e'],
    blockStyle: 'gloss',
    ambient: 'sparkles',
    ambientEmojis: [],
    clearEmojis: ['✨', '🎩', '⭐'],
    sound: { wave: 'triangle', root: 392, scale: [0, 2, 4, 7, 9, 12, 14, 16], decay: 0.35 },
    gameOver: ['Janey still can\'t win.', 'Ron: 1. Janey: 0.', 'Even Janey\'s best wasn\'t this good.', 'More Ron. Less Janey.'],
  },
  {
    id: 'spooky',
    name: 'Spooky',
    emoji: '🎃',
    season: 'October',
    background: 'radial-gradient(circle at 50% -10%, #4a1d6b 0%, transparent 60%), radial-gradient(circle at 0% 100%, #1d3b12 0%, transparent 45%), #0b0812',
    text: '#fff2e0',
    muted: '#c4a8d6',
    accent: '#ff8a1f',
    panel: 'rgba(255,138,31,0.08)',
    board: '#17101f',
    cell: 'rgba(180,120,255,0.07)',
    blocks: ['#ff7b1a', '#ffa53d', '#9b4dff', '#6a2fc0', '#7cff4d', '#3bd16f', '#e8e2f0'],
    blockStyle: 'pumpkin',
    ambient: 'bats',
    ambientEmojis: ['🦇', '👻'],
    clearEmojis: ['🎃', '👻', '🦇', '🕷️'],
    sound: { wave: 'sawtooth', root: 220, scale: [0, 3, 6, 7, 10, 12, 15, 18], decay: 0.5, vibrato: true },
    gameOver: ['Janey\'s ghost can\'t win either.', 'Boo! Janey loses again.', 'Janey got a rock in her trick-or-treat bag.', 'Spookier than Janey\'s high score.'],
  },
  {
    id: 'thanksgiving',
    name: 'Thanksgiving',
    emoji: '🦃',
    season: 'November',
    background: 'radial-gradient(circle at 80% 0%, #7a3a12 0%, transparent 55%), radial-gradient(circle at 0% 100%, #5c4210 0%, transparent 50%), #24140a',
    text: '#fff4e2',
    muted: '#e0c39a',
    accent: '#ffb02e',
    panel: 'rgba(255,176,46,0.09)',
    board: '#3a2414',
    cell: 'rgba(255,220,170,0.07)',
    blocks: ['#d9531e', '#f28c28', '#f6c445', '#a8321d', '#8a5a2b', '#9bb03a', '#c97b3d'],
    blockStyle: 'leaf',
    ambient: 'leaves',
    ambientEmojis: ['🍂', '🍁'],
    clearEmojis: ['🦃', '🥧', '🍁', '🌽'],
    sound: { wave: 'sine', root: 294, scale: [0, 2, 4, 7, 9, 12, 14, 16], decay: 0.25 },
    gameOver: ['Janey gets the short end of the wishbone.', 'Janey\'s sitting at the kids\' table.', 'Thankful Janey can\'t win.', 'Janey burned the pie.'],
  },
  {
    id: 'christmas',
    name: 'Christmas',
    emoji: '🎄',
    season: 'Dec 1 – 26',
    background: 'radial-gradient(circle at 20% 0%, #0f5132 0%, transparent 55%), radial-gradient(circle at 100% 100%, #6b0f1a 0%, transparent 50%), #07131f',
    text: '#f4fbff',
    muted: '#b6d3e6',
    accent: '#ff3b47',
    panel: 'rgba(255,255,255,0.08)',
    board: '#0e2233',
    cell: 'rgba(200,235,255,0.07)',
    blocks: ['#e3262f', '#1fa045', '#f2c230', '#0f7a3a', '#b5121b', '#5fb6ff', '#f4f4f4'],
    blockStyle: 'present',
    ambient: 'snow',
    ambientEmojis: ['❄️'],
    clearEmojis: ['🎄', '🎁', '❄️', '⭐', '🔔'],
    sound: { wave: 'sine', root: 523, scale: [0, 2, 4, 7, 9, 12, 14, 16], decay: 0.8, bell: true },
    gameOver: ['Janey got coal again.', 'Santa says Janey can\'t win.', 'All Janey wants for Christmas is a win.', 'Ho ho ho, Janey. No.'],
  },
  {
    id: 'easter',
    name: 'Easter',
    emoji: '🐣',
    season: 'Two weeks before Easter',
    background: 'radial-gradient(circle at 0% 0%, #ffd6ec 0%, transparent 50%), radial-gradient(circle at 100% 30%, #d6f0ff 0%, transparent 50%), radial-gradient(circle at 50% 100%, #dcffd6 0%, transparent 55%), #fff8e8',
    text: '#3d2a4f',
    muted: '#7d6a8f',
    accent: '#e85d9e',
    panel: 'rgba(255,255,255,0.65)',
    board: '#f3e8ff',
    cell: 'rgba(120,80,160,0.08)',
    blocks: ['#ff9ec7', '#ffd36e', '#9fe0a8', '#8fcfff', '#c7a6ff', '#ffb38a', '#7fdcd0'],
    blockStyle: 'egg',
    ambient: 'petals',
    ambientEmojis: ['🌸', '🌼'],
    clearEmojis: ['🐣', '🥚', '🐰', '🌷'],
    sound: { wave: 'triangle', root: 440, scale: [0, 2, 4, 7, 9, 12, 14, 16], decay: 0.3 },
    gameOver: ['Janey couldn\'t find a single egg.', 'The Easter Bunny skipped Janey.', 'Janey\'s basket is empty.', 'Hop along, Janey.'],
  },
  {
    id: 'july4',
    name: 'July 4th',
    emoji: '🇺🇸',
    season: 'Jun 25 – Jul 7',
    background: 'radial-gradient(circle at 20% 0%, #1b2f7a 0%, transparent 55%), radial-gradient(circle at 100% 100%, #7a1b2a 0%, transparent 50%), #070b1f',
    text: '#ffffff',
    muted: '#b9c4ee',
    accent: '#ff3b4e',
    panel: 'rgba(255,255,255,0.08)',
    board: '#0f1638',
    cell: 'rgba(255,255,255,0.07)',
    blocks: ['#e8243a', '#f4f6ff', '#2a4bd7', '#b3122a', '#5c7cff', '#ffcf3d', '#1a2f99'],
    blockStyle: 'star',
    ambient: 'stars',
    ambientEmojis: [],
    clearEmojis: ['🎆', '🇺🇸', '⭐', '🎇'],
    fireworks: true,
    sound: { wave: 'square', root: 349, scale: [0, 4, 7, 12, 16, 19, 24, 28], decay: 0.3, boom: true },
    gameOver: ['Janey\'s fireworks fizzled.', 'Land of the free, home of the Janey-can\'t-win.', 'Janey\'s sparkler went out.', 'Red, white and Ron.'],
  },
];

export const THEME_BY_ID = new Map(THEMES.map((t) => [t.id, t]));

/** Easter Sunday for a year (Gregorian calendar, anonymous algorithm). */
export function easterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

/** Which theme shows automatically on a given date. */
export function autoThemeId(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const today = new Date(date.getFullYear(), month - 1, day).getTime();
  const easter = easterDate(date.getFullYear()).getTime();
  const DAY = 86_400_000;

  if (today >= easter - 14 * DAY && today <= easter) return 'easter';
  if ((month === 6 && day >= 25) || (month === 7 && day <= 7)) return 'july4';
  if (month === 10) return 'spooky';
  if (month === 11) return 'thanksgiving';
  if (month === 12 && day <= 26) return 'christmas';
  return 'classic';
}
