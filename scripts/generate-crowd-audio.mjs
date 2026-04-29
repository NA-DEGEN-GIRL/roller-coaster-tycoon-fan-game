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
    filename: 'crowd-chatter-1.mp3',
    voice: 'nova',
    text: '와, 저기 회전목마 봐. 줄이 조금 있지만 금방 탈 수 있겠다. 오늘 사람 많다.',
    instructions:
      'Distant cheerful amusement park chatter. Natural Korean speech, relaxed, not too clear, like background ambience.',
  },
  {
    filename: 'crowd-chatter-2.mp3',
    voice: 'shimmer',
    text: '어디부터 갈까? 저쪽 길로 가보자. 사진도 찍고, 다음에는 간식도 먹자.',
    instructions:
      'Soft happy crowd murmur for a theme park. Keep it casual, slightly distant, no dramatic acting.',
  },
  {
    filename: 'crowd-chatter-3.mp3',
    voice: 'echo',
    text: '사람들 많네. 음악 들린다. 저 놀이기구 끝나면 우리도 한번 타자.',
    instructions:
      'Background park guest chatter. Friendly, low-detail, slightly muffled and spacious.',
  },
  {
    filename: 'crowd-chatter-4.mp3',
    voice: 'sage',
    text: '여기 길로 가면 입구가 나올 거야. 천천히 가자. 생각보다 분위기 좋다.',
    instructions:
      'Casual crowd ambience voice, quiet and distant. Blendable loop material, not announcer-like.',
  },
  {
    filename: 'crowd-laugh-1.mp3',
    voice: 'coral',
    text: '하하, 재밌다. 우와, 또 타고 싶어. 진짜 웃기다.',
    instructions:
      'Short cheerful laughter and excited amusement park reaction. Light, friendly, not loud.',
  },
  {
    filename: 'crowd-laugh-2.mp3',
    voice: 'ash',
    text: '와, 방금 봤어? 하하, 좋다. 저쪽도 가보자.',
    instructions:
      'Small group laughter and happy reaction from a theme park crowd. Keep it subtle and distant.',
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
