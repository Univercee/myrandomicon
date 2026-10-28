const SUBJECTS = ['fox', 'owl', 'whale', 'cactus', 'rocket', 'mushroom', 'cat', 'robot', 'lighthouse', 'dragon', 'crystal', 'paper plane'];
const COLORS = ['coral', 'teal', 'amber', 'violet', 'emerald', 'sky blue', 'rose', 'lime'];
const MOODS = ['cheerful', 'calm', 'mysterious', 'energetic', 'cozy'];

const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

export interface IconParams {
  subject: string;
  color: string;
  mood: string;
}

export function randomParams(): IconParams {
  return { subject: pick(SUBJECTS), color: pick(COLORS), mood: pick(MOODS) };
}

export function buildPrompt(p: IconParams): string {
  return (
    `Flat vector app icon of a ${p.mood} ${p.subject}, ${p.color} as the dominant color. ` +
    `Single centered subject, simple shapes, soft gradients, solid plain background, ` +
    `square 1:1 composition, no text, no letters, no watermark.`
  );
}
