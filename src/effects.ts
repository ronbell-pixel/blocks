// Two full-screen canvases: ambient theme decor behind the game, and
// celebration effects (confetti, emoji pops, fireworks) on top of it.

import type { Theme } from './themes';

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

interface Decor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  phase: number;
  emoji?: string;
  color?: string;
}

interface Flyer {
  emoji: string;
  x: number;
  y: number;
  vx: number;
  size: number;
  t: number;
  kind: 'bat' | 'bunny';
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  kind: 'square' | 'spark' | 'emoji';
  emoji?: string;
  rot: number;
  vr: number;
  gravity: number;
  drag: number;
  alpha: number;
}

export class Effects {
  private bg: CanvasRenderingContext2D;
  private fx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private theme!: Theme;
  private decor: Decor[] = [];
  private fog: Decor[] = [];
  private flyers: Flyer[] = [];
  private particles: Particle[] = [];
  private nextEvent = 0;
  private time = 0;
  private reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(private bgCanvas: HTMLCanvasElement, private fxCanvas: HTMLCanvasElement) {
    this.bg = bgCanvas.getContext('2d')!;
    this.fx = fxCanvas.getContext('2d')!;
    this.resize();
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    for (const c of [this.bgCanvas, this.fxCanvas]) {
      c.width = Math.round(this.w * this.dpr);
      c.height = Math.round(this.h * this.dpr);
    }
    if (this.theme) this.seedDecor();
  }

  setTheme(theme: Theme) {
    this.theme = theme;
    this.flyers = [];
    this.seedDecor();
  }

  private seedDecor() {
    const t = this.theme;
    const area = (this.w * this.h) / (390 * 844);
    const scale = (n: number) => Math.max(4, Math.round(n * Math.min(area, 2.5) * (this.reduced ? 0.35 : 1)));
    const counts: Record<Theme['ambient'], number> = { sparkles: 40, bats: 4, leaves: 16, snow: 110, petals: 16, stars: 90 };
    this.decor = Array.from({ length: scale(counts[t.ambient]) }, () => this.makeDecor(true));
    this.fog =
      t.ambient === 'bats'
        ? Array.from({ length: 6 }, () => ({
            x: rand(0, this.w), y: rand(this.h * 0.3, this.h), vx: rand(-8, 8), vy: 0,
            size: rand(160, 320), rot: 0, vr: 0, phase: rand(0, 6),
          }))
        : [];
    this.nextEvent = this.time + rand(2, 5);
  }

  private makeDecor(anywhere: boolean): Decor {
    const t = this.theme;
    const d: Decor = {
      x: rand(0, this.w), y: anywhere ? rand(0, this.h) : -30,
      vx: 0, vy: 0, size: 0, rot: rand(0, Math.PI * 2), vr: 0, phase: rand(0, Math.PI * 2),
    };
    switch (t.ambient) {
      case 'sparkles':
        Object.assign(d, { vy: rand(-12, -4), size: rand(2, 5), color: pick(t.blocks) });
        if (!anywhere) d.y = this.h + 10;
        break;
      case 'bats': // floating ghosts; bats fly past as events
        Object.assign(d, { emoji: '👻', size: rand(22, 34), vx: rand(-6, 6), vy: rand(-4, 4) });
        break;
      case 'leaves':
        Object.assign(d, { emoji: pick(t.ambientEmojis), size: rand(16, 28), vy: rand(25, 50), vr: rand(-1, 1) });
        break;
      case 'snow':
        Object.assign(d, { size: rand(1, 3.5), vy: rand(20, 55), color: '#ffffff' });
        if (Math.random() < 0.06) Object.assign(d, { emoji: '❄️', size: rand(12, 18), vr: rand(-0.6, 0.6) });
        break;
      case 'petals':
        Object.assign(d, { emoji: pick(t.ambientEmojis), size: rand(14, 22), vx: rand(8, 22), vy: rand(14, 30), vr: rand(-1, 1) });
        break;
      case 'stars':
        Object.assign(d, { size: rand(0.6, 2), color: Math.random() < 0.2 ? '#ffd9df' : '#ffffff' });
        break;
    }
    return d;
  }

  private ambientEvent() {
    const t = this.theme;
    if (t.ambient === 'bats') this.flyBy('bat');
    else if (t.ambient === 'petals') this.flyBy('bunny');
    else if (t.ambient === 'stars') {
      this.firework(rand(this.w * 0.1, this.w * 0.9), rand(this.h * 0.08, this.h * 0.4), 0.35, 28);
    }
    this.nextEvent = this.time + rand(3.5, 8);
  }

  /** A bat swoops (Spooky) or a bunny hops (Easter) across the screen. */
  flyBy(kind: 'bat' | 'bunny') {
    const leftToRight = Math.random() < 0.5;
    const size = kind === 'bat' ? rand(26, 40) : rand(34, 44);
    this.flyers.push({
      emoji: kind === 'bat' ? '🦇' : '🐰',
      kind,
      size,
      x: leftToRight ? -size : this.w + size,
      y: kind === 'bat' ? rand(this.h * 0.08, this.h * 0.5) : this.h - size * 0.6,
      vx: (leftToRight ? 1 : -1) * (kind === 'bat' ? rand(140, 220) : rand(110, 150)),
      t: 0,
    });
  }

  /** Confetti from cleared cells plus theme emoji pops. Points are in page (CSS) pixels. */
  burst(cells: { x: number; y: number; color: string }[], center: { x: number; y: number }, power: number) {
    const per = this.reduced ? 1 : Math.min(5, 2 + power);
    for (const c of cells) {
      for (let i = 0; i < per; i++) {
        const a = rand(0, Math.PI * 2);
        const s = rand(60, 220) * (0.8 + power * 0.15);
        this.particles.push({
          x: c.x, y: c.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, life: 0, max: rand(0.6, 1.1),
          size: rand(4, 8), color: c.color, kind: 'square', rot: rand(0, 6), vr: rand(-10, 10),
          gravity: 600, drag: 0.985, alpha: 1,
        });
      }
    }
    const emojis = this.reduced ? 2 : Math.min(14, 3 + power * 3);
    for (let i = 0; i < emojis; i++) {
      const a = rand(-Math.PI * 0.9, -Math.PI * 0.1);
      const s = rand(180, 380);
      this.particles.push({
        x: center.x + rand(-30, 30), y: center.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: rand(1, 1.5),
        size: rand(22, 36), color: '', kind: 'emoji', emoji: pick(this.theme.clearEmojis), rot: rand(-0.5, 0.5),
        vr: rand(-2, 2), gravity: 420, drag: 0.99, alpha: 1,
      });
    }
    if (this.theme.fireworks) {
      const shots = Math.min(5, 1 + power);
      for (let i = 0; i < shots; i++) {
        setTimeout(() => this.firework(center.x + rand(-140, 140), center.y - rand(60, 220), 1, 46), i * 160);
      }
    }
    if (power >= 2 && this.theme.ambient === 'petals') this.flyBy('bunny');
    if (power >= 2 && this.theme.ambient === 'bats') this.flyBy('bat');
  }

  firework(x: number, y: number, alpha: number, count: number) {
    const palette = this.theme.fireworks ? ['#ff3b4e', '#ffffff', '#4d7cff', '#ffd23d'] : this.theme.blocks;
    const color = pick(palette);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rand(-0.05, 0.05);
      const s = rand(90, 200);
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: rand(0.9, 1.4), size: rand(1.5, 2.8),
        color: Math.random() < 0.25 ? '#ffffff' : color, kind: 'spark', rot: 0, vr: 0, gravity: 90, drag: 0.97, alpha,
      });
    }
  }

  frame(dt: number) {
    this.time += dt;
    if (this.time > this.nextEvent && !this.reduced) this.ambientEvent();
    this.drawBackground(dt);
    this.drawEffects(dt);
  }

  private drawBackground(dt: number) {
    const ctx = this.bg;
    const t = this.theme;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);

    for (const f of this.fog) {
      f.x += f.vx * dt;
      if (f.x < -f.size) f.x = this.w + f.size;
      if (f.x > this.w + f.size) f.x = -f.size;
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.size);
      g.addColorStop(0, 'rgba(170,140,220,0.10)');
      g.addColorStop(1, 'rgba(170,140,220,0)');
      ctx.fillStyle = g;
      ctx.fillRect(f.x - f.size, f.y - f.size, f.size * 2, f.size * 2);
    }

    for (let i = 0; i < this.decor.length; i++) {
      const d = this.decor[i];
      d.phase += dt;
      d.rot += d.vr * dt;
      if (t.ambient === 'leaves' || t.ambient === 'petals') d.x += (d.vx + Math.sin(d.phase * 1.5) * 30) * dt;
      else if (t.ambient === 'snow') d.x += Math.sin(d.phase) * 12 * dt;
      else d.x += d.vx * dt;
      d.y += d.vy * dt;

      const off = d.y > this.h + 40 || d.y < -50 || d.x > this.w + 50 || d.x < -50;
      if (off) {
        if (t.ambient === 'bats') {
          d.vx *= -1;
          d.vy *= -1;
          d.x = Math.min(Math.max(d.x, 0), this.w);
          d.y = Math.min(Math.max(d.y, 0), this.h);
        } else {
          this.decor[i] = this.makeDecor(false);
          if (t.ambient === 'petals') this.decor[i].x = rand(-this.w * 0.3, this.w);
        }
        continue;
      }

      if (d.emoji) {
        const alpha = t.ambient === 'bats' ? 0.18 + Math.sin(d.phase) * 0.06 : 0.85;
        drawEmoji(ctx, d.emoji, d.x, d.y + (t.ambient === 'bats' ? Math.sin(d.phase * 1.3) * 8 : 0), d.size, d.rot, alpha);
      } else if (t.ambient === 'sparkles' || t.ambient === 'stars') {
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(d.phase * (t.ambient === 'stars' ? 1.2 : 2)));
        ctx.globalAlpha = tw * (t.ambient === 'stars' ? 0.9 : 0.6);
        ctx.fillStyle = d.color!;
        if (t.ambient === 'sparkles') drawTwinkle(ctx, d.x, d.y, d.size * 2);
        else {
          ctx.beginPath();
          ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = d.color!;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    this.flyers = this.flyers.filter((f) => f.x > -f.size * 2 && f.x < this.w + f.size * 2);
    for (const f of this.flyers) {
      f.t += dt;
      f.x += f.vx * dt;
      const y = f.kind === 'bat' ? f.y + Math.sin(f.t * 6) * 18 : f.y - Math.abs(Math.sin(f.t * 5)) * 40;
      const flip = f.vx < 0 !== (f.kind === 'bunny');
      drawEmoji(ctx, f.emoji, f.x, y, f.size, 0, f.kind === 'bat' ? 0.85 : 0.95, flip);
    }
  }

  private drawEffects(dt: number) {
    const ctx = this.fx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    this.particles = this.particles.filter((p) => p.life < p.max);
    for (const p of this.particles) {
      p.life += dt;
      p.vx *= p.drag;
      p.vy = p.vy * p.drag + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      const fade = Math.max(0, 1 - p.life / p.max);
      if (p.kind === 'emoji') {
        drawEmoji(ctx, p.emoji!, p.x, p.y, p.size * (0.6 + 0.4 * Math.min(1, p.life * 6)), p.rot, Math.min(1, fade * 1.6));
        continue;
      }
      ctx.globalAlpha = fade * p.alpha;
      ctx.fillStyle = p.color;
      if (p.kind === 'spark') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }
}

function drawEmoji(
  ctx: CanvasRenderingContext2D, emoji: string, x: number, y: number, size: number, rot: number, alpha: number, flip = false,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  if (flip) ctx.scale(-1, 1);
  ctx.font = `${size}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 0, 0);
  ctx.restore();
}

function drawTwinkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}
