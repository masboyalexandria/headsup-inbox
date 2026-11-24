import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Loader .env minimal (tanpa dependensi): KEY=value per baris, # = komentar. */
export function loadEnv() {
  for (const candidate of [join(root, '.env'), join(root, 'server', '.env')]) {
    if (!existsSync(candidate)) continue;
    for (const line of readFileSync(candidate, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      const key = m[1];
      const val = m[2].replace(/^["']|["']$/g, '');
      if (process.env[key] === undefined) process.env[key] = val;
    }
    break;
  }
  return {
    botToken: process.env.BOT_TOKEN || '',
    ownerChatId: process.env.OWNER_CHAT_ID || '',
    port: Number(process.env.PORT || 8787),
    llmApiUrl: process.env.LLM_API_URL || '',
    llmApiKey: process.env.LLM_API_KEY || '',
    llmModel: process.env.LLM_MODEL || 'gpt-4o-mini',
  };
}
