# 🧱 Ron Buster — Janey can't win

A no-timer block puzzle with holiday themes and a friends leaderboard. Play at **https://blocks.more-ron.com**.

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

## Friends leaderboard

Like Slot Party, players pick their name (no password) and an emoji. Signed-in games are
ranked on **Today**, **This week** and **All time** boards (days start at midnight Central).
Guests can still play; their games just aren't ranked.

Scores can't be faked from the browser: when a ranked game starts, the server hands out a
random **seed**, and the pieces you're dealt all come from it. At game over the browser sends
the list of moves, and the server replays them with the same rules (`shared/game.ts`) to work
out the score itself. If a result can't be sent (offline), it's retried on the next visit.

## Development

```bash
npm install
npm run dev        # API on :3000, game on http://localhost:5173
npm test           # game rules, replay checks, server and theme dates
npm run build      # typecheck + production build in dist/
npm start          # serves the API and the built game on :3000
```

- `shared/` — game rules, pieces, seeded random numbers, API types (used by both sides)
- `server/` — Fastify + SQLite (better-sqlite3): players, games, leaderboard
- `src/` — the game in the browser: canvas board and effects, themes, Web Audio sound

## Deploying to Railway

1. Create a Railway service from this repo. `railway.json` sets the build/start commands
   and health check.
2. Add a **volume** (mount path e.g. `/data`). The server stores `blocks.db` in
   `RAILWAY_VOLUME_MOUNT_PATH`, so players and scores survive redeploys.
3. Add the custom domain `blocks.more-ron.com` in Railway, then add the CNAME (and TXT
   verification record) Railway shows you in Cloudflare, with the proxy **off** (DNS only).

Environment variables (all optional): `PORT`, `DATABASE_PATH`, `LOG_LEVEL`,
`TIME_ZONE` (default `America/Chicago`, used for the "Today" board).
