import { GoogleGenAI } from '@google/genai';
import { config } from './config.js';

const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

export class GeminiError extends Error {
  constructor(message: string, public readonly rateLimited = false) {
    super(message);
  }
}

// Serializes calls and spaces them out to stay under the free-tier RPM.
let chain: Promise<unknown> = Promise.resolve();
const minGapMs = Math.ceil(60_000 / Math.max(1, config.geminiRpm));
let lastStart = 0;

function schedule<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = lastStart + minGapMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastStart = Date.now();
    return fn();
  });
  chain = run.catch(() => undefined);
  return run;
}

export function generateImage(prompt: string): Promise<Buffer> {
  return schedule(async () => {
    let res;
    try {
      res = await ai.models.generateContent({
        model: config.geminiModel,
        contents: prompt,
        config: { responseModalities: ['TEXT', 'IMAGE'] },
      });
    } catch (e: any) {
      const limited = e?.status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(String(e?.message));
      throw new GeminiError(String(e?.message ?? e), limited);
    }
    const parts = res.candidates?.[0]?.content?.parts ?? [];
    const img = parts.find((p) => p.inlineData?.data);
    if (!img?.inlineData?.data) throw new GeminiError('Gemini returned no image');
    return Buffer.from(img.inlineData.data, 'base64');
  });
}
