// Draws the board and the tray of pieces on one canvas, and handles drag and drop.

import { canPlace, fitsAnywhere, idx, linesCompletedBy, shapeOf, SIZE, EMPTY, type GameState, type PlaceResult } from './game';
import type { Shape } from './pieces';
import type { BlockStyle, Theme } from './themes';

interface Layout {
  w: number;
  h: number;
  pad: number;
  cell: number;
  boardX: number;
  boardY: number;
  trayY: number;
  trayH: number;
}

interface Drag {
  index: number;
  x: number;
  y: number;
  touch: boolean;
}

interface Anim {
  row: number;
  col: number;
  color: number;
  start: number;
}

interface FloatText {
  text: string;
  x: number;
  y: number;
  start: number;
  size: number;
  color: string;
}

/** Height of the canvas as a multiple of its width. */
export const ASPECT = 1.45;

export class BoardView {
  private ctx: CanvasRenderingContext2D;
  private layout!: Layout;
  private dpr = 1;
  private drag: Drag | null = null;
  private clearing: Anim[] = [];
  private placed: Anim[] = [];
  private texts: FloatText[] = [];
  private shakeUntil = 0;
  private theme!: Theme;

  constructor(
    private canvas: HTMLCanvasElement,
    private getState: () => GameState,
    private onDrop: (index: number, row: number, col: number) => void,
    private onPickUp: () => void,
  ) {
    this.ctx = canvas.getContext('2d')!;
    canvas.addEventListener('pointerdown', this.down);
    canvas.addEventListener('pointermove', this.move);
    canvas.addEventListener('pointerup', this.up);
    canvas.addEventListener('pointercancel', () => (this.drag = null));
  }

  setTheme(theme: Theme) {
    this.theme = theme;
  }

  resize(width: number) {
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = width;
    const pad = w * 0.03;
    const cell = (w - pad * 2) / SIZE;
    const trayY = pad + cell * SIZE + cell * 0.55;
    const trayH = cell * 3.2;
    const h = w * ASPECT;
    this.layout = { w, h, pad, cell, boardX: pad, boardY: pad, trayY, trayH };
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
  }

  /** Page coordinates of a board cell's center, for effects drawn on other canvases. */
  cellToPage(row: number, col: number) {
    const rect = this.canvas.getBoundingClientRect();
    const { boardX, boardY, cell } = this.layout;
    return { x: rect.left + boardX + (col + 0.5) * cell, y: rect.top + boardY + (row + 0.5) * cell };
  }

  animatePlace(result: PlaceResult, row: number, col: number, shape: Shape, color: number) {
    const now = performance.now();
    this.placed = shape.cells.map(([r, c]) => ({ row: row + r, col: col + c, color, start: now }));
    const center = { row: row + shape.rows / 2, col: col + shape.cols / 2 };
    this.clearing = result.clearedCells.map((c) => ({
      ...c,
      start: now + Math.hypot(c.row - center.row, c.col - center.col) * 18,
    }));
  }

  floatText(text: string, row: number, col: number, size: number, color: string, delay = 0) {
    const { boardX, boardY, cell } = this.layout;
    const x = Math.min(Math.max(boardX + (col + 0.5) * cell, size * 3), this.layout.w - size * 3);
    this.texts.push({ text, x, y: boardY + (row + 0.5) * cell, start: performance.now() + delay, size, color });
  }

  shake() {
    this.shakeUntil = performance.now() + 450;
  }

  // ---------- Input ----------

  private point(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private slotRect(i: number) {
    const { w, trayY, trayH } = this.layout;
    return { x: (w / 3) * i, y: trayY, w: w / 3, h: trayH };
  }

  private down = (e: PointerEvent) => {
    const state = this.getState();
    if (state.over) return;
    const p = this.point(e);
    for (let i = 0; i < 3; i++) {
      const s = this.slotRect(i);
      if (state.tray[i] && p.x >= s.x && p.x < s.x + s.w && p.y >= s.y - this.layout.cell * 0.4 && p.y < s.y + s.h) {
        this.drag = { index: i, x: p.x, y: p.y, touch: e.pointerType !== 'mouse' };
        this.canvas.setPointerCapture(e.pointerId);
        this.onPickUp();
        e.preventDefault();
        return;
      }
    }
  };

  private move = (e: PointerEvent) => {
    if (!this.drag) {
      const p = this.point(e);
      const state = this.getState();
      const overPiece = [0, 1, 2].some((i) => {
        const s = this.slotRect(i);
        return state.tray[i] && p.x >= s.x && p.x < s.x + s.w && p.y >= s.y && p.y < s.y + s.h;
      });
      this.canvas.style.cursor = overPiece ? 'grab' : 'default';
      return;
    }
    const p = this.point(e);
    this.drag.x = p.x;
    this.drag.y = p.y;
  };

  private up = () => {
    const drag = this.drag;
    this.drag = null;
    if (!drag) return;
    const piece = this.getState().tray[drag.index];
    if (!piece) return;
    const target = this.dropTarget(drag, shapeOf(piece));
    if (target) this.onDrop(drag.index, target.row, target.col);
  };

  /** Top-left of the dragged piece in canvas pixels. Touch lifts it above the finger. */
  private dragOrigin(drag: Drag, shape: Shape) {
    const { cell } = this.layout;
    const pw = shape.cols * cell;
    const ph = shape.rows * cell;
    const x = drag.x - pw / 2;
    const y = drag.touch ? drag.y - ph - cell * 1.1 : drag.y - ph / 2;
    return { x, y };
  }

  private dropTarget(drag: Drag, shape: Shape) {
    const { boardX, boardY, cell } = this.layout;
    const o = this.dragOrigin(drag, shape);
    const col = Math.round((o.x - boardX) / cell);
    const row = Math.round((o.y - boardY) / cell);
    return canPlace(this.getState().board, shape, row, col) ? { row, col } : null;
  }

  // ---------- Drawing ----------

  draw(now: number) {
    const ctx = this.ctx;
    const L = this.layout;
    const t = this.theme;
    const state = this.getState();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, L.w, L.h);

    if (now < this.shakeUntil) {
      const k = (this.shakeUntil - now) / 450;
      ctx.translate(Math.sin(now / 25) * 8 * k, 0);
    }

    // Board
    const bs = L.cell * SIZE;
    ctx.fillStyle = t.board;
    roundRect(ctx, L.boardX - L.pad * 0.6, L.boardY - L.pad * 0.6, bs + L.pad * 1.2, bs + L.pad * 1.2, L.cell * 0.3);
    ctx.fill();
    ctx.strokeStyle = withAlpha(t.accent, 0.35);
    ctx.lineWidth = 2;
    ctx.stroke();

    // Drag preview
    let ghost: { row: number; col: number; shape: Shape; color: number } | null = null;
    const highlight = new Set<number>();
    if (this.drag) {
      const piece = state.tray[this.drag.index];
      if (piece) {
        const shape = shapeOf(piece);
        const target = this.dropTarget(this.drag, shape);
        if (target) {
          ghost = { ...target, shape, color: piece.color };
          const { rows, cols } = linesCompletedBy(state.board, shape, target.row, target.col);
          for (const r of rows) for (let c = 0; c < SIZE; c++) highlight.add(idx(r, c));
          for (const c of cols) for (let r = 0; r < SIZE; r++) highlight.add(idx(r, c));
        }
      }
    }

    const placedAt = new Map(this.placed.map((a) => [idx(a.row, a.col), a]));
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const x = L.boardX + c * L.cell;
        const y = L.boardY + r * L.cell;
        const v = state.board[idx(r, c)];
        if (v === EMPTY && !highlight.has(idx(r, c))) {
          ctx.fillStyle = t.cell;
          roundRect(ctx, x + L.cell * 0.05, y + L.cell * 0.05, L.cell * 0.9, L.cell * 0.9, L.cell * 0.16);
          ctx.fill();
          continue;
        }
        const color = highlight.has(idx(r, c)) && ghost ? ghost.color : v;
        if (color === EMPTY) continue;
        const anim = placedAt.get(idx(r, c));
        const pop = anim ? easeOutBack(Math.min(1, (now - anim.start) / 160)) : 1;
        const s = L.cell * pop;
        const glow = highlight.has(idx(r, c)) ? 0.6 + 0.4 * Math.sin(now / 90) : 0;
        drawBlock(ctx, x + (L.cell - s) / 2, y + (L.cell - s) / 2, s, t.blocks[color], t.blockStyle, 1, glow);
      }
    }

    if (ghost) {
      for (const [r, c] of ghost.shape.cells) {
        const x = L.boardX + (ghost.col + c) * L.cell;
        const y = L.boardY + (ghost.row + r) * L.cell;
        if (highlight.has(idx(ghost.row + r, ghost.col + c))) continue;
        drawBlock(ctx, x, y, L.cell, t.blocks[ghost.color], t.blockStyle, 0.4);
      }
    }

    // Clearing animation
    this.clearing = this.clearing.filter((a) => now - a.start < 320);
    for (const a of this.clearing) {
      const p = Math.max(0, (now - a.start) / 320);
      const s = L.cell * (1 - p * 0.7);
      const x = L.boardX + a.col * L.cell + (L.cell - s) / 2;
      const y = L.boardY + a.row * L.cell + (L.cell - s) / 2;
      drawBlock(ctx, x, y, s, t.blocks[a.color], t.blockStyle, 1 - p, p < 0.3 ? 1 : 0);
    }
    if (this.placed.length && now - this.placed[0].start > 200) this.placed = [];

    // Tray
    for (let i = 0; i < 3; i++) {
      const piece = state.tray[i];
      if (!piece || this.drag?.index === i) continue;
      const shape = shapeOf(piece);
      const slot = this.slotRect(i);
      const size = Math.min(L.cell * 0.56, (slot.w * 0.82) / shape.cols, (slot.h * 0.8) / shape.rows);
      const ox = slot.x + (slot.w - shape.cols * size) / 2;
      const oy = slot.y + (slot.h - shape.rows * size) / 2;
      const fits = fitsAnywhere(state.board, shape);
      for (const [r, c] of shape.cells) {
        drawBlock(ctx, ox + c * size, oy + r * size, size, fits ? t.blocks[piece.color] : '#808080', t.blockStyle, fits ? 1 : 0.35);
      }
    }

    // Dragged piece
    if (this.drag) {
      const piece = state.tray[this.drag.index];
      if (piece) {
        const shape = shapeOf(piece);
        const o = this.dragOrigin(this.drag, shape);
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 8;
        for (const [r, c] of shape.cells) drawBlock(ctx, o.x + c * L.cell, o.y + r * L.cell, L.cell, t.blocks[piece.color], t.blockStyle, 0.95);
        ctx.restore();
      }
    }

    // Floating score text
    this.texts = this.texts.filter((f) => now - f.start < 1200);
    for (const f of this.texts) {
      const p = (now - f.start) / 1200;
      if (p < 0) continue;
      const scale = p < 0.15 ? easeOutBack(p / 0.15) : 1;
      ctx.save();
      ctx.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1;
      ctx.translate(f.x, f.y - p * L.cell * 1.6);
      ctx.scale(scale, scale);
      ctx.font = `800 ${f.size}px "Bricolage Grotesque", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = f.size * 0.18;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.strokeText(f.text, 0, 0);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, 0, 0);
      ctx.restore();
    }
  }
}

// ---------- Block art ----------

export function drawBlock(
  ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, style: BlockStyle, alpha = 1, glow = 0,
) {
  if (s <= 1) return;
  const inset = s * 0.05;
  const bx = x + inset;
  const by = y + inset;
  const bs = s - inset * 2;
  const r = bs * 0.2;
  ctx.save();
  ctx.globalAlpha = alpha;

  const g = ctx.createLinearGradient(bx, by, bx, by + bs);
  g.addColorStop(0, mix(color, '#ffffff', 0.28));
  g.addColorStop(1, mix(color, '#000000', 0.18));
  ctx.fillStyle = g;
  roundRect(ctx, bx, by, bs, bs, r);
  ctx.fill();
  ctx.strokeStyle = mix(color, '#000000', 0.3);
  ctx.lineWidth = Math.max(1, bs * 0.04);
  ctx.stroke();

  if (glow > 0) {
    ctx.fillStyle = `rgba(255,255,255,${0.35 * glow})`;
    roundRect(ctx, bx, by, bs, bs, r);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  roundRect(ctx, bx + bs * 0.1, by + bs * 0.07, bs * 0.8, bs * 0.22, bs * 0.1);
  ctx.fill();

  const cx = bx + bs / 2;
  const cy = by + bs / 2;
  const light = isLight(color);
  switch (style) {
    case 'gloss':
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.ellipse(bx + bs * 0.3, by + bs * 0.32, bs * 0.1, bs * 0.06, -0.6, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'pumpkin': {
      ctx.fillStyle = light ? 'rgba(40,20,60,0.75)' : 'rgba(30,12,0,0.7)';
      const e = bs * 0.12;
      for (const ex of [cx - bs * 0.18, cx + bs * 0.18]) {
        ctx.beginPath();
        ctx.moveTo(ex - e, cy - bs * 0.02);
        ctx.lineTo(ex + e, cy - bs * 0.02);
        ctx.lineTo(ex, cy - bs * 0.2);
        ctx.closePath();
        ctx.fill();
      }
      ctx.beginPath();
      const my = cy + bs * 0.12;
      ctx.moveTo(cx - bs * 0.28, my);
      for (let i = 0; i <= 6; i++) ctx.lineTo(cx - bs * 0.28 + (i * bs * 0.56) / 6, my + (i % 2 ? bs * 0.1 : 0));
      ctx.lineTo(cx + bs * 0.22, my + bs * 0.16);
      ctx.lineTo(cx - bs * 0.22, my + bs * 0.16);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'leaf': {
      ctx.strokeStyle = withAlpha(mix(color, '#ffffff', 0.5), 0.75);
      ctx.lineWidth = Math.max(1, bs * 0.05);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(bx + bs * 0.22, by + bs * 0.78);
      ctx.lineTo(bx + bs * 0.78, by + bs * 0.24);
      for (const t of [0.35, 0.55, 0.72]) {
        const px = bx + bs * (0.22 + 0.56 * t);
        const py = by + bs * (0.78 - 0.54 * t);
        ctx.moveTo(px, py);
        ctx.lineTo(px - bs * 0.14, py - bs * 0.16);
        ctx.moveTo(px, py);
        ctx.lineTo(px + bs * 0.16, py + bs * 0.12);
      }
      ctx.stroke();
      break;
    }
    case 'present': {
      const ribbon = color === '#f2c230' ? '#e3262f' : '#f6d55c';
      const band = bs * 0.16;
      ctx.fillStyle = ribbon;
      ctx.fillRect(cx - band / 2, by + bs * 0.04, band, bs * 0.92);
      ctx.fillRect(bx + bs * 0.04, cy - band / 2, bs * 0.92, band);
      ctx.beginPath();
      ctx.ellipse(cx - bs * 0.13, cy - bs * 0.1, bs * 0.12, bs * 0.07, 0.6, 0, Math.PI * 2);
      ctx.ellipse(cx + bs * 0.13, cy - bs * 0.1, bs * 0.12, bs * 0.07, -0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = mix(ribbon, '#000000', 0.25);
      ctx.lineWidth = Math.max(1, bs * 0.025);
      ctx.stroke();
      break;
    }
    case 'egg': {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = Math.max(1, bs * 0.07);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const px = bx + bs * 0.12 + (i * bs * 0.76) / 6;
        const py = cy + (i % 2 ? -bs * 0.08 : bs * 0.08);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.fillStyle = withAlpha(mix(color, '#7a3cff', 0.5), 0.8);
      for (const [dx, dy] of [[-0.2, -0.26], [0.2, -0.26], [0, 0.28], [-0.24, 0.26], [0.24, 0.26]]) {
        ctx.beginPath();
        ctx.arc(cx + bs * dx, cy + bs * dy, bs * 0.045, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'star':
      ctx.fillStyle = light ? '#e8243a' : '#ffffff';
      star(ctx, cx, cy + bs * 0.03, bs * 0.3, bs * 0.13);
      ctx.fill();
      break;
  }
  ctx.restore();
}

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, outer: number, inner: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? inner : outer;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
  ctx.closePath();
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}

function easeOutBack(t: number) {
  const c = 1.7;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${m(r1, r2)}${m(g1, g2)}${m(b1, b2)}`;
}

export function withAlpha(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function isLight(hex: string): boolean {
  const [r, g, b] = rgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b > 200;
}
