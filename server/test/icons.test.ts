import { createHmac } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';

const TOKEN = '123:TEST';
let auth: typeof import('../src/auth.js');
let icons: typeof import('../src/icons.js');
let storage: typeof import('../src/storage.js');

beforeAll(async () => {
  process.env.BOT_TOKEN = TOKEN;
  process.env.GEMINI_API_KEY = 'x';
  process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'randommer-'));
  auth = await import('../src/auth.js');
  icons = await import('../src/icons.js');
  storage = await import('../src/storage.js');
});

function signed(user: object, authDate: number, token = TOKEN): string {
  const p = new URLSearchParams({ auth_date: String(authDate), user: JSON.stringify(user) });
  const dcs = [...p.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  p.set('hash', createHmac('sha256', secret).update(dcs).digest('hex'));
  return p.toString();
}

describe('validateInitData', () => {
  const now = Date.now();
  const sec = Math.floor(now / 1000);
  it('accepts valid data', () => {
    expect(auth.validateInitData(signed({ id: 42 }, sec), TOKEN, now)).toBe(42);
  });
  it('rejects a forged signature', () => {
    expect(auth.validateInitData(signed({ id: 42 }, sec, 'other:token'), TOKEN, now)).toBeNull();
  });
  it('rejects expired data', () => {
    expect(auth.validateInitData(signed({ id: 42 }, sec - 2 * 86400), TOKEN, now)).toBeNull();
  });
});

describe('getOrCreateIcon', () => {
  it('calls Gemini exactly once for concurrent requests and stores a 512x512 PNG', async () => {
    let calls = 0;
    const gen = async () => {
      calls++;
      return sharp({ create: { width: 800, height: 600, channels: 3, background: '#f00' } }).png().toBuffer();
    };
    for (let i = 0; i < 10; i++) icons.getOrCreateIcon(7, gen);
    while (icons.pollIcon(7) !== 'ready') await new Promise((r) => setTimeout(r, 20));

    expect(calls).toBe(1);
    const meta = await sharp((await storage.readIcon(7))!).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['png', 512, 512]);

    // Already generated: no new call.
    expect(icons.getOrCreateIcon(7, gen)).toBe('ready');
    expect(calls).toBe(1);
  });

  it('allows a retry after a failed generation and stores nothing', async () => {
    const bad = async () => {
      throw new Error('boom');
    };
    icons.getOrCreateIcon(8, bad);
    let s;
    while ((s = icons.pollIcon(8)) === 'pending') await new Promise((r) => setTimeout(r, 20));
    expect(s).toBe('error');
    expect(await storage.readIcon(8)).toBeNull();

    const ok = async () => sharp({ create: { width: 64, height: 64, channels: 3, background: '#0f0' } }).png().toBuffer();
    icons.getOrCreateIcon(8, ok);
    while (icons.pollIcon(8) !== 'ready') await new Promise((r) => setTimeout(r, 20));
  });
});
