import sharp from 'sharp';
import { db } from './db.js';
import { generateImage, GeminiError } from './gemini.js';
import { buildPrompt, randomParams } from './prompt.js';
import { saveIcon } from './storage.js';

export type IconStatus = 'ready' | 'pending' | 'error' | 'rate_limited';

const STALE_PENDING_MS = 2 * 60_000;
const inFlight = new Set<number>();
// Last failure per user, reported once to the polling client.
const lastError = new Map<number, 'error' | 'rate_limited'>();

const getRow = db.prepare('SELECT status, created_at FROM icons WHERE user_id = ?');
const insertRow = db.prepare(
  "INSERT INTO icons (user_id, status, prompt, params_json, created_at) VALUES (?, 'pending', ?, ?, ?) ON CONFLICT(user_id) DO NOTHING",
);
const markReady = db.prepare("UPDATE icons SET status = 'ready' WHERE user_id = ?");
const deleteRow = db.prepare('DELETE FROM icons WHERE user_id = ?');

type GenFn = (prompt: string) => Promise<Buffer>;

/** Starts a single background generation if the user has no icon yet; returns current status. */
export function getOrCreateIcon(userId: number, generate: GenFn = generateImage): IconStatus {
  const row = getRow.get(userId) as { status: string; created_at: number } | undefined;
  if (row?.status === 'ready') return 'ready';
  if (row?.status === 'pending') {
    if (inFlight.has(userId) || Date.now() - row.created_at < STALE_PENDING_MS) return 'pending';
    deleteRow.run(userId); // orphaned by a crash
  }

  const params = randomParams();
  const prompt = buildPrompt(params);
  // Atomic claim: only one concurrent caller sees changes === 1.
  if (insertRow.run(userId, prompt, JSON.stringify(params), Date.now()).changes !== 1) return 'pending';

  lastError.delete(userId);
  inFlight.add(userId);
  void (async () => {
    try {
      const raw = await generate(prompt);
      const png = await sharp(raw).resize(512, 512, { fit: 'cover' }).png().toBuffer();
      await saveIcon(userId, png);
      markReady.run(userId);
    } catch (e) {
      // Nothing stored, so the user may retry: only a successful generation is final.
      deleteRow.run(userId);
      lastError.set(userId, e instanceof GeminiError && e.rateLimited ? 'rate_limited' : 'error');
      console.error(`icon generation failed for ${userId}:`, e instanceof Error ? e.message : e);
    } finally {
      inFlight.delete(userId);
    }
  })();
  return 'pending';
}

/** Side-effect-free status for polling. A failure is reported once, then cleared. */
export function pollIcon(userId: number): IconStatus | 'none' {
  const row = getRow.get(userId) as { status: string } | undefined;
  if (row?.status === 'ready') return 'ready';
  if (row) return 'pending';
  const err = lastError.get(userId);
  if (err) {
    lastError.delete(userId);
    return err;
  }
  return 'none';
}
