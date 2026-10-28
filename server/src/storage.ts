import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';

const dir = path.join(config.dataDir, 'icons');

// Path is derived from a numeric id only, never from user input.
function fileFor(userId: number): string {
  if (!Number.isSafeInteger(userId)) throw new Error('bad user id');
  return path.join(dir, `${userId}.png`);
}

export async function saveIcon(userId: number, png: Buffer): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
  const target = fileFor(userId);
  const tmp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(tmp, png);
  await fs.rename(tmp, target);
}

export async function readIcon(userId: number): Promise<Buffer | null> {
  try {
    return await fs.readFile(fileFor(userId));
  } catch {
    return null;
  }
}
