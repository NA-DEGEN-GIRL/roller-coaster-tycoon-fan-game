import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const envFileName = `.${'env'}`;
const rootDir = path.resolve(new URL('..', import.meta.url).pathname);
const outputDir = path.join(rootDir, 'public', 'audio', 'generated');

const loadLocalEnv = async () => {
  try {
    const text = await readFile(path.join(rootDir, envFileName), 'utf8');
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const equalsIndex = line.indexOf('=');
      if (equalsIndex < 1) continue;

      const key = line.slice(0, equalsIndex).trim();
      let value = line.slice(equalsIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // The script can also run with shell-provided environment variables.
  }
};

const speechJobs = [
  {
    filename: 'crowd-walla-1.mp3',
    voice: 'nova',
    text: '음, 와, 아, 그래, 저기, 응, 좋아, 어, 하하, 음.',
    instructions:
      'Indistinct cheerful amusement park walla. Do not make clear sentences. Soft overlapping murmur feel, distant and blendable.',
  },
  {
    filename: 'crowd-walla-2.mp3',
    voice: 'shimmer',
    text: '아, 음, 저쪽, 응, 와, 좋아, 어어, 하하, 그래.',
    instructions:
      'Theme park background crowd walla. Mostly indistinct syllables, not readable dialogue, casual and distant.',
  },
  {
    filename: 'crowd-walla-3.mp3',
    voice: 'echo',
    text: '오, 아, 음, 저기, 와, 응, 잠깐, 그래, 하.',
    instructions:
      'Low-detail amusement park guest murmur. Make it soft, muffled, and not like a single clear spoken line.',
  },
  {
    filename: 'crowd-walla-4.mp3',
    voice: 'sage',
    text: '음, 어, 좋아, 와, 하하, 응, 아, 그래, 저기.',
    instructions:
      'Distant crowd bed texture for a park. Keep it mumbled, small, cheerful, and hard to understand.',
  },
  {
    filename: 'crowd-walla-5.mp3',
    voice: 'fable',
    text: '아, 음, 와, 오, 응, 하하, 좋아, 어, 그래.',
    instructions:
      'Children and families style background walla, but one subtle voice only. Distant, soft, no clear sentence.',
  },
  {
    filename: 'crowd-walla-6.mp3',
    voice: 'onyx',
    text: '음, 그래, 어, 오, 저기, 응, 와, 하.',
    instructions:
      'Low male background murmur for a busy theme park. Quiet, muffled, indistinct, no clear dialogue.',
  },
  {
    filename: 'crowd-reaction-1.mp3',
    voice: 'coral',
    text: '하하하, 와!',
    instructions:
      'Short cheerful amusement park laugh and tiny excited reaction. Natural, quick, not loud.',
  },
  {
    filename: 'crowd-reaction-2.mp3',
    voice: 'ash',
    text: '오, 와, 하하.',
    instructions:
      'Small happy crowd reaction, short and distant. Laughter plus a quick wow.',
  },
  {
    filename: 'crowd-reaction-3.mp3',
    voice: 'ballad',
    text: '꺄, 하하하.',
    instructions:
      'Very short playful theme park laugh reaction. Light, quick, and not harsh.',
  },
  {
    filename: 'crowd-reaction-4.mp3',
    voice: 'verse',
    text: '와아, 좋다!',
    instructions:
      'Short happy amusement park cheer. Distant, natural, quick.',
  },
];

const generateSpeech = async ({ filename, voice, text, instructions }) => {
  const key = process.env.OPENAI_KEY;
  if (!key) {
    throw new Error('OPENAI_KEY is not set. Add it to your local environment file or shell environment.');
  }

  const model = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
  const responseFormat = process.env.OPENAI_TTS_FORMAT || 'mp3';
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      voice,
      input: text,
      instructions,
      response_format: responseFormat,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI speech request failed for ${filename}: ${response.status} ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  await writeFile(path.join(outputDir, filename), Buffer.from(arrayBuffer));
  console.log(`generated ${filename}`);
};

await loadLocalEnv();
await mkdir(outputDir, { recursive: true });

for (const job of speechJobs) {
  await generateSpeech(job);
}

console.log(`done: ${outputDir}`);
