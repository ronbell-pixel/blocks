import Fastify, { type FastifyRequest } from 'fastify';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import { finishGame, getLeaderboard, HttpError, joinPlayer, listPlayers, parsePeriod, startGame } from './service.ts';

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' }, bodyLimit: 1_048_576 });

function playerId(req: FastifyRequest): number {
  const id = Number(req.headers['x-player-id']);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(401, 'Missing player');
  return id;
}

app.setErrorHandler((err, _req, reply) => {
  if (err instanceof HttpError) return reply.status(err.status).send({ error: err.message });
  app.log.error(err);
  return reply.status(500).send({ error: 'Something went wrong' });
});

type Body = Record<string, unknown>;

app.get('/api/health', async () => ({ ok: true }));
app.get('/api/players', async () => listPlayers());
app.post<{ Body: Body }>('/api/players', async (req) => joinPlayer(req.body ?? {}));
app.post<{ Body: Body }>('/api/games', async (req) => startGame(playerId(req), req.body ?? {}));
app.post<{ Params: { id: string }; Body: Body }>('/api/games/:id/finish', async (req) =>
  finishGame(playerId(req), Number(req.params.id), req.body ?? {}),
);
app.get<{ Querystring: { period?: string } }>('/api/leaderboard', async (req) => getLeaderboard(parsePeriod(req.query.period)));

// Serve the built game in production.
const distDir = path.resolve('dist');
if (fs.existsSync(distDir)) {
  await app.register(fastifyStatic, { root: distDir });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) return reply.status(404).send({ error: 'Not found' });
    return reply.sendFile('index.html');
  });
}

const port = Number(process.env.PORT ?? 3000);
await app.listen({ port, host: '0.0.0.0' });
