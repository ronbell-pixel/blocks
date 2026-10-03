# 🧱 Ron Buster — Janey can't win

A no-timer block puzzle with holiday themes. Play at **https://blocks.more-ron.com**.

## How to play

- Drag the three pieces from the tray onto the 8×8 board.
- Fill a whole row or column to clear it. Clearing several at once scores more.
- Clear on back-to-back turns to build a **combo** (it ends after 3 placements without a clear).
- No timer. The game ends when none of your pieces fits. One **undo** per game.
- Best score and the game in progress are saved in the browser.

| | Points |
|---|---|
| Each block placed | 1 |
| Lines cleared | 10 × lines² × combo |
| Clearing the whole board | +300 |

## Themes

The theme follows the calendar automatically, or players pick one with the button at the top right.

| Theme | Shows automatically |
|---|---|
| 🎩 Classic | Rest of the year |
| 🎃 Spooky | October |
| 🦃 Thanksgiving | November |
| 🎄 Christmas | Dec 1 – 26 |
| 🐣 Easter | Two weeks before Easter (calculated each year) |
| 🇺🇸 July 4th | Jun 25 – Jul 7 |

Add `?theme=christmas` (or any theme id) to the address to preview a theme.

### Adding a theme

Every theme is one entry in `src/themes.ts`: colors, block style, background decor, clear
emojis, sounds and the game-over Janey lines. Copy an entry, change the values, and add a
date window in `autoThemeId()` if it should show automatically.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # game rules and theme dates
npm run build      # production build in dist/
```

Built with TypeScript and Vite. The board and effects are drawn on canvas, and all
sound is synthesized with Web Audio.

## Deploying

Every push to `main` runs the tests, builds, and publishes to GitHub Pages
(`.github/workflows/deploy.yml`). One-time setup:

1. **Settings → Pages → Source: GitHub Actions**, then set the custom domain to `blocks.more-ron.com`.
2. In Cloudflare DNS, add `CNAME blocks → ronbell-pixel.github.io` with the proxy **off** (DNS only).

## Planned

- Friends leaderboard, using the same name sign-in as Slot Party.
