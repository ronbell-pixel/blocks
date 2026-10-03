import { describe, expect, it } from 'vitest';
import { autoThemeId, easterDate, THEMES } from '../src/themes';

const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

describe('themes', () => {
  it('every theme has 7 block colors and Janey lines', () => {
    for (const t of THEMES) {
      expect(t.blocks).toHaveLength(7);
      expect(t.gameOver.length).toBeGreaterThan(0);
      expect(t.clearEmojis.length).toBeGreaterThan(0);
    }
  });

  it('computes Easter', () => {
    expect(easterDate(2026)).toEqual(d(2026, 4, 5));
    expect(easterDate(2027)).toEqual(d(2027, 3, 28));
    expect(easterDate(2030)).toEqual(d(2030, 4, 21));
  });

  it('picks the theme from the date', () => {
    expect(autoThemeId(d(2026, 10, 3))).toBe('spooky');
    expect(autoThemeId(d(2026, 11, 26))).toBe('thanksgiving');
    expect(autoThemeId(d(2026, 12, 25))).toBe('christmas');
    expect(autoThemeId(d(2026, 12, 28))).toBe('classic');
    expect(autoThemeId(d(2026, 3, 25))).toBe('easter');
    expect(autoThemeId(d(2026, 4, 5))).toBe('easter');
    expect(autoThemeId(d(2026, 4, 6))).toBe('classic');
    expect(autoThemeId(d(2026, 7, 4))).toBe('july4');
    expect(autoThemeId(d(2026, 6, 24))).toBe('classic');
    expect(autoThemeId(d(2026, 2, 14))).toBe('classic');
  });
});
