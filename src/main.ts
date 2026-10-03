import './style.css';
import { ASPECT, BoardView } from './board';
import { Effects } from './effects';
import { canUndo, newGame, place, revive, shapeOf, undo, type GameState, type PlaceResult } from './game';
import { playClear, playClick, playGameOver, playPickUp, playPlace, setMuted, unlockAudio } from './sound';
import { load, save } from './storage';
import { autoThemeId, THEME_BY_ID, THEMES, type Theme } from './themes';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// ---------- State ----------

let state: GameState = revive(load('game', null)) ?? newGame();
if (state.over) state = newGame();
let best = Math.max(load('best', 0), state.score);
let muted = load('muted', false);
let themeChoice = load('theme', 'auto');
const urlTheme = new URLSearchParams(location.search).get('theme');
let themeOverride = urlTheme && THEME_BY_ID.has(urlTheme) ? urlTheme : null;
let theme: Theme = THEMES[0];
let shownScore = state.score;

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
  $('sound-btn').innerHTML = muted ? '<span>🔇</span> Sound' : '<span>🔊</span> Sound';
}

// ---------- Game flow ----------

function onDrop(index: number, row: number, col: number) {
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
  save('game', state.over ? null : state);
  updateHud();
  if (state.over) setTimeout(gameOver, 700);
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

function gameOver() {
  view.shake();
  playGameOver(theme.sound);
  setTimeout(() => {
    $('final-score').textContent = state.score.toLocaleString();
    $('new-best').hidden = !(state.score > 0 && state.score >= best);
    $('janey').textContent = theme.gameOver[Math.floor(Math.random() * theme.gameOver.length)];
    open('over');
  }, 500);
}

function startNewGame() {
  state = newGame();
  shownScore = 0;
  save('game', state);
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
    if (overlay.id === 'over') return; // only "Play again" closes it
    if (target === overlay || target.closest('[data-close]')) overlay.hidden = true;
  });
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    close('theme-sheet');
    close('confirm');
  }
});

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

$('theme-btn').addEventListener('click', () => {
  renderThemeList();
  open('theme-sheet');
});

$('undo-btn').addEventListener('click', () => {
  if (!canUndo(state)) return;
  state = undo(state);
  shownScore = state.score;
  save('game', state);
  playClick(theme.sound);
  updateHud();
});

$('new-btn').addEventListener('click', () => {
  if (state.score > 0 && !state.over) open('confirm');
  else startNewGame();
});
$('confirm-yes').addEventListener('click', () => {
  close('confirm');
  startNewGame();
});
$('again-btn').addEventListener('click', () => {
  close('over');
  startNewGame();
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
