import './style.css';
import { ASPECT, BoardView } from './board';
import { Effects } from './effects';
import { api, currentPlayer, setPlayer } from './api';
import { canUndo, newGame, place, revive, shapeOf, undo, type GameState, type Move, type PlaceResult } from '../shared/game.ts';
import { randomSeed } from '../shared/rng.ts';
import { AVATARS, type FinishResponse, type Period, type PlayerSummary } from '../shared/api.ts';
import { playClear, playClick, playGameOver, playPickUp, playPlace, setMuted, unlockAudio } from './sound';
import { load, save } from './storage';
import { autoThemeId, THEME_BY_ID, THEMES, type Theme } from './themes';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------- State ----------

/** gameId is the server's id for a ranked game; null means unranked (guest or offline). */
const saved = revive(load('game', null));
const hadSavedGame = saved !== null && !saved.over;
let state: GameState = hadSavedGame ? saved : newGame(randomSeed());
let gameId: number | null = hadSavedGame ? load('gameId', null) : null;
let best = Math.max(load('best', 0), state.score);
let muted = load('muted', false);
let themeChoice = load('theme', 'auto');
const urlTheme = new URLSearchParams(location.search).get('theme');
let themeOverride = urlTheme && THEME_BY_ID.has(urlTheme) ? urlTheme : null;
let theme: Theme = THEMES[0];
let shownScore = state.score;
let starting = false;

interface PendingFinish {
  gameId: number;
  playerId: number;
  moves: Move[];
  theme: string;
}

// ---------- Views ----------

const effects = new Effects($<HTMLCanvasElement>('bg'), $<HTMLCanvasElement>('fx'));
const view = new BoardView($<HTMLCanvasElement>('game'), () => state, onDrop, () => playPickUp(theme.sound));

function currentThemeId() {
  if (themeOverride) return themeOverride;
  return themeChoice === 'auto' ? autoThemeId(new Date()) : themeChoice;
}

function applyTheme() {
  theme = THEME_BY_ID.get(currentThemeId()) ?? THEMES[0];
  const root = document.documentElement.style;
  root.setProperty('--bg-full', theme.background);
  root.setProperty('--bg', theme.board);
  root.setProperty('--text', theme.text);
  root.setProperty('--muted', theme.muted);
  root.setProperty('--accent', theme.accent);
  root.setProperty('--panel', theme.panel);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.board);
  $('theme-btn').textContent = theme.emoji;
  effects.setTheme(theme);
  view.setTheme(theme);
}

function layout() {
  const app = document.querySelector('.app') as HTMLElement;
  const wrap = document.querySelector('.board-wrap') as HTMLElement;
  const maxW = Math.min(480, app.clientWidth - 32);
  const width = Math.floor(Math.max(240, Math.min(maxW, wrap.clientHeight / ASPECT)));
  view.resize(width);
  effects.resize();
}

function updateHud() {
  $('best').textContent = best.toLocaleString();
  const combo = $('combo');
  combo.textContent = state.combo >= 2 ? `🔥 Combo x${state.combo}` : '';
  combo.classList.toggle('on', state.combo >= 2);
  $<HTMLButtonElement>('undo-btn').disabled = !canUndo(state);
  $('sound-btn').textContent = muted ? '🔇' : '🔊';
  const p = currentPlayer();
  const chip = $('player-btn');
  chip.innerHTML = p ? `<span>${p.avatar}</span><span class="name"></span>` : 'Sign in';
  if (p) chip.querySelector('.name')!.textContent = p.name;
}

function saveGame() {
  save('game', state.over ? null : state);
  save('gameId', state.over ? null : gameId);
}

// ---------- Game flow ----------

function onDrop(index: number, row: number, col: number) {
  if (starting) return;
  const piece = state.tray[index];
  if (!piece) return;
  const result = place(state, index, row, col);
  if (!result) return;
  state = result.state;
  const shape = shapeOf(piece);
  view.animatePlace(result, row, col, shape, piece.color);
  playPlace(theme.sound);
  celebrate(result, row + shape.rows / 2 - 0.5, col + shape.cols / 2 - 0.5);

  if (state.score > best) {
    best = state.score;
    save('best', best);
  }
  updateHud();
  if (state.over) {
    const finished = { state, gameId };
    saveGame();
    setTimeout(() => gameOver(finished.state, finished.gameId), 700);
  } else {
    saveGame();
  }
}

function celebrate(result: PlaceResult, row: number, col: number) {
  view.floatText(`+${result.points}`, row, col, 26, '#ffffff');
  if (result.lines === 0) return;

  playClear(theme.sound, result.lines, result.combo);
  const power = Math.min(5, result.lines + Math.max(0, result.combo - 1));
  const cells = result.clearedCells.map((c) => ({ ...view.cellToPage(c.row, c.col), color: theme.blocks[c.color] }));
  const center = cells.reduce((acc, c) => ({ x: acc.x + c.x / cells.length, y: acc.y + c.y / cells.length }), { x: 0, y: 0 });
  effects.burst(cells, center, power);

  const words = ['', '', 'Double!', 'Triple!', 'Ron-tastic!', 'Ron-tastic!', 'Janey could never!'];
  const word = words[Math.min(result.lines, words.length - 1)];
  if (word) view.floatText(word, row - 1.2, col, 34, theme.accent, 120);
  if (result.combo >= 2) view.floatText(`Combo x${result.combo}`, row + 1.2, col, 26, '#ffd23d', 220);
  if (result.boardCleared) view.floatText('Board clear! +300', 3.5, 3.5, 32, '#ffd23d', 350);
}

function gameOver(final: GameState, finishedId: number | null) {
  view.shake();
  playGameOver(theme.sound);
  const rank = $('rank');
  const player = currentPlayer();
  if (finishedId !== null && player) {
    rank.textContent = 'Checking the leaderboard…';
    const pending: PendingFinish = { gameId: finishedId, playerId: player.id, moves: final.moves, theme: theme.id };
    save('pending', pending);
    submitFinish(pending)
      .then((res) => {
        rank.textContent = rankText(res);
        if (res.newBest) $('new-best').hidden = false;
      })
      .catch(() => (rank.textContent = "Couldn't reach the leaderboard. Will retry later."));
  } else {
    rank.textContent = player ? 'This game was not ranked.' : 'Sign in to get on the leaderboard.';
  }

  setTimeout(() => {
    $('final-score').textContent = final.score.toLocaleString();
    $('new-best').hidden = !(final.score > 0 && final.score >= best);
    $('janey').textContent = theme.gameOver[Math.floor(Math.random() * theme.gameOver.length)];
    open('over');
  }, 500);
}

async function submitFinish(p: PendingFinish): Promise<FinishResponse> {
  try {
    const res = await api.finish(p.gameId, p.moves, p.theme);
    save('pending', null);
    best = Math.max(best, res.best);
    save('best', best);
    updateHud();
    return res;
  } catch (err) {
    // A rejected game (bad moves, already finished) will never succeed, so drop it.
    if ((err as { status?: number }).status && (err as { status: number }).status < 500) save('pending', null);
    throw err;
  }
}

function rankText(res: FinishResponse) {
  const medal = (n: number) => (n === 1 ? '🥇' : n === 2 ? '🥈' : n === 3 ? '🥉' : `#${n}`);
  if (res.rankToday === 1 && res.rankAll === 1) return '🥇 #1 of all time!';
  return `${medal(res.rankToday)} today · ${medal(res.rankWeek)} this week · ${medal(res.rankAll)} all time`;
}

/** Start a new game: ranked (seed from the server) when signed in, otherwise local. */
async function startNewGame() {
  starting = true;
  let seed = randomSeed();
  gameId = null;
  if (currentPlayer()) {
    try {
      const g = await api.startGame(currentThemeId());
      seed = g.seed;
      gameId = g.id;
    } catch (err) {
      if ((err as { status?: number }).status === 401) {
        setPlayer(null); // the server no longer knows this player
        open('signin');
        void renderSignin();
      }
    }
  }
  state = newGame(seed);
  shownScore = 0;
  $('score').textContent = '0';
  starting = false;
  saveGame();
  updateHud();
}

// ---------- Overlays ----------

function open(id: string) {
  $(id).hidden = false;
}
function close(id: string) {
  $(id).hidden = true;
}

document.querySelectorAll<HTMLElement>('.overlay').forEach((overlay) => {
  overlay.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (overlay.id === 'over') return; // only its buttons close it
    if (target === overlay || target.closest('[data-close]')) overlay.hidden = true;
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') ['theme-sheet', 'confirm', 'signin', 'leaders'].forEach(close);
});

// Theme picker

function renderThemeList() {
  const list = $('theme-list');
  const auto = THEME_BY_ID.get(autoThemeId(new Date()))!;
  const options = [
    { id: 'auto', emoji: '📅', name: 'Auto', when: `Follows the calendar · ${auto.emoji} ${auto.name} today`, colors: auto.blocks },
    ...THEMES.map((t) => ({ id: t.id, emoji: t.emoji, name: t.name, when: t.season, colors: t.blocks })),
  ];
  const selected = themeOverride ?? themeChoice;
  list.innerHTML = '';
  for (const o of options) {
    const btn = document.createElement('button');
    btn.className = 'theme-opt' + (o.id === selected ? ' selected' : '');
    btn.innerHTML = `<span class="emoji">${o.emoji}</span><span class="info"><span class="name"></span><span class="when"></span><span class="swatches">${o.colors.map((c) => `<i style="background:${c}"></i>`).join('')}</span></span>`;
    btn.querySelector('.name')!.textContent = o.name;
    btn.querySelector('.when')!.textContent = o.when;
    btn.addEventListener('click', () => {
      themeChoice = o.id;
      themeOverride = null;
      save('theme', themeChoice);
      applyTheme();
      playClick(theme.sound);
      renderThemeList();
      setTimeout(() => close('theme-sheet'), 150);
    });
    list.appendChild(btn);
  }
}

// Sign in

let pickedAvatar = currentPlayer()?.avatar ?? AVATARS[Math.floor(Math.random() * AVATARS.length)];

function renderAvatars() {
  const grid = $('avatar-grid');
  grid.innerHTML = '';
  for (const a of AVATARS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = a;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(a === pickedAvatar));
    b.addEventListener('click', () => {
      pickedAvatar = a;
      renderAvatars();
    });
    grid.appendChild(b);
  }
}

async function renderSignin() {
  renderAvatars();
  $('join-error').hidden = true;
  const list = $('player-list');
  list.innerHTML = '';
  try {
    const players = await api.players();
    for (const p of players) {
      const b = document.createElement('button');
      b.className = 'player-pick' + (p.id === currentPlayer()?.id ? ' me' : '');
      b.innerHTML = `<span>${p.avatar}</span><span></span>`;
      b.lastElementChild!.textContent = p.name;
      b.addEventListener('click', () => choosePlayer(p));
      list.appendChild(b);
    }
  } catch {
    list.innerHTML = '<p class="error">Couldn\'t load players. Check your connection.</p>';
  }
}

function choosePlayer(p: PlayerSummary) {
  const changed = p.id !== currentPlayer()?.id;
  setPlayer(p);
  save('signin-seen', true);
  close('signin');
  playClick(theme.sound);
  updateHud();
  // A ranked game belongs to the player who started it, so switching players starts a
  // new one. An untouched unranked game is swapped for a ranked one; an unranked game
  // already in progress is left alone.
  const needsNew = (gameId !== null && changed) || (gameId === null && state.moves.length === 0);
  if (needsNew) void startNewGame();
}

$<HTMLFormElement>('join-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $<HTMLInputElement>('join-name').value.trim();
  if (!name) return;
  const err = $('join-error');
  err.hidden = true;
  try {
    choosePlayer(await api.join(name, pickedAvatar));
    $<HTMLInputElement>('join-name').value = '';
  } catch (ex) {
    err.textContent = (ex as Error).message || "Couldn't join. Try again.";
    err.hidden = false;
  }
});

$('guest-btn').addEventListener('click', () => save('signin-seen', true));
$('player-btn').addEventListener('click', () => {
  open('signin');
  void renderSignin();
});

// Leaderboard

let period: Period = 'today';

async function renderLeaders() {
  document.querySelectorAll<HTMLElement>('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.period === period)));
  const list = $('leader-list');
  list.innerHTML = '<li class="leader-empty">Loading…</li>';
  try {
    const rows = await api.leaderboard(period);
    if (!rows.length) {
      const when = period === 'today' ? 'today' : period === 'week' ? 'this week' : 'yet';
      list.innerHTML = `<li class="leader-empty">No games ${when}. Be the first!</li>`;
      return;
    }
    list.innerHTML = '';
    const me = currentPlayer()?.id;
    rows.forEach((r, i) => {
      const li = document.createElement('li');
      li.className = 'leader' + (r.id === me ? ' me' : '');
      const pos = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1);
      const themeEmoji = r.theme ? THEME_BY_ID.get(r.theme)?.emoji ?? '' : '';
      li.innerHTML = `<span class="pos">${pos}</span><span class="face">${r.avatar}</span><span class="who"><b></b><small></small></span><span class="pts">${r.best.toLocaleString()}</span>`;
      const name = li.querySelector('b')!;
      name.textContent = r.name;
      if (/\bjaney\b/i.test(r.name)) name.insertAdjacentHTML('beforeend', '<span class="janey-tag">can\'t win</span>');
      li.querySelector('small')!.textContent = `${r.games} game${r.games === 1 ? '' : 's'} ${themeEmoji}`;
      list.appendChild(li);
    });
  } catch {
    list.innerHTML = '<li class="leader-empty">Couldn\'t load the leaderboard. Check your connection.</li>';
  }
}

function openLeaders() {
  open('leaders');
  void renderLeaders();
}

document.querySelectorAll<HTMLElement>('.tab').forEach((t) =>
  t.addEventListener('click', () => {
    period = t.dataset.period as Period;
    void renderLeaders();
  }),
);
$('leaders-btn').addEventListener('click', openLeaders);
$('over-leaders-btn').addEventListener('click', openLeaders);

// Toolbar

$('theme-btn').addEventListener('click', () => {
  renderThemeList();
  open('theme-sheet');
});

$('undo-btn').addEventListener('click', () => {
  if (!canUndo(state)) return;
  state = undo(state);
  shownScore = state.score;
  saveGame();
  playClick(theme.sound);
  updateHud();
});

$('new-btn').addEventListener('click', () => {
  if (state.score > 0 && !state.over) open('confirm');
  else void startNewGame();
});
$('confirm-yes').addEventListener('click', () => {
  close('confirm');
  void startNewGame();
});
$('again-btn').addEventListener('click', () => {
  close('over');
  void startNewGame();
});

$('sound-btn').addEventListener('click', () => {
  muted = !muted;
  setMuted(muted);
  save('muted', muted);
  updateHud();
  playClick(theme.sound);
});

window.addEventListener('pointerdown', unlockAudio, { capture: true });
window.addEventListener('resize', layout);
window.visualViewport?.addEventListener('resize', layout);

// ---------- Main loop ----------

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  effects.frame(dt);
  view.draw(now);
  if (shownScore !== state.score) {
    const diff = state.score - shownScore;
    shownScore = Math.abs(diff) < 1 ? state.score : shownScore + diff * Math.min(1, dt * 10);
    $('score').textContent = Math.round(shownScore).toLocaleString();
  }
  requestAnimationFrame(frame);
}

setMuted(muted);
applyTheme();
layout();
updateHud();
$('score').textContent = state.score.toLocaleString();
requestAnimationFrame(frame);
document.fonts?.ready.then(layout);

// A finished game that couldn't be submitted last time.
const pending = load<PendingFinish | null>('pending', null);
if (pending && pending.playerId === currentPlayer()?.id) submitFinish(pending).catch(() => {});

if (!hadSavedGame) void startNewGame();
if (!currentPlayer() && !load('signin-seen', false)) {
  open('signin');
  void renderSignin();
}
