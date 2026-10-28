import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { validateInitData } from './auth.js';
import { getOrCreateIcon, pollIcon } from './icons.js';
import { readIcon } from './storage.js';
import { startBot } from './bot.js';

const app = Fastify({ logger: true });
await app.register(rateLimit, { max: 60, timeWindow: '1 minute' });

function authUser(header: string | undefined): number | null {
  if (!header?.startsWith('tma ')) return null;
  return validateInitData(header.slice(4), config.botToken);
}

// Creates the icon on first call; afterwards just reports status. Also used for polling.
app.post('/api/icon', async (req, reply) => {
  const userId = authUser(req.headers.authorization);
  if (!userId) return reply.code(401).send({ error: 'unauthorized' });
  const status = getOrCreateIcon(userId);
  return { status };
});

app.get('/api/icon/status', async (req, reply) => {
  const userId = authUser(req.headers.authorization);
  if (!userId) return reply.code(401).send({ error: 'unauthorized' });
  return { status: pollIcon(userId) };
});

// Image is only served to its owner. The client fetches it with the auth header and shows a blob URL.
app.get('/api/icon/image', async (req, reply) => {
  const userId = authUser(req.headers.authorization);
  if (!userId) return reply.code(401).send({ error: 'unauthorized' });
  const png = await readIcon(userId);
  if (!png) return reply.code(404).send({ error: 'not_found' });
  return reply
    .header('Cache-Control', 'private, max-age=31536000, immutable')
    .type('image/png')
    .send(png);
});

const webDir = path.resolve('web-dist');
if (fs.existsSync(webDir)) {
  await app.register(fastifyStatic, { root: webDir });
}

await app.listen({ port: config.port, host: '0.0.0.0' });
startBot();
