import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), 'data');
const dataFile = join(dataDir, 'messages.json');

/**
 * Store JSON lokal sederhana: { ownerChatId, messages: [...] }.
 * Pesan: { id, sender, chat, chatId, time, text, important, summary, draft, engine, sent }.
 */
export class Store {
  constructor() {
    this.ownerChatId = null;
    this.messages = [];
    if (existsSync(dataFile)) {
      try {
        const parsed = JSON.parse(readFileSync(dataFile, 'utf8'));
        this.ownerChatId = parsed.ownerChatId ?? null;
        this.messages = Array.isArray(parsed.messages) ? parsed.messages : [];
      } catch {
        console.warn('[store] messages.json rusak — mulai dari kosong');
      }
    }
  }

  save() {
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(dataFile, JSON.stringify({ ownerChatId: this.ownerChatId, messages: this.messages }, null, 2));
  }

  setOwner(chatId) {
    this.ownerChatId = chatId;
    this.save();
  }

  add(msg) {
    if (this.messages.some((m) => m.id === msg.id)) return false;
    this.messages.push(msg);
    this.save();
    return true;
  }

  markSent(id) {
    const m = this.messages.find((x) => x.id === id);
    if (m) {
      m.sent = true;
      this.save();
    }
    return m ?? null;
  }

  latest(n = 20) {
    return this.messages.slice(-n);
  }
}

/** Data contoh yang sama dengan src/demo-data.ts di frontend. */
export const DEMO_SEED = [
  {
    id: 'm1',
    sender: 'Rani',
    chat: 'Tim Hackathon',
    time: '18:42',
    text: 'Mas, demo day Even Realities jadi jam berapa? Aku butuh slot latihan pitch sebelum jam 3 sore, soalnya flight-ku jam 7 malam.',
  },
  {
    id: 'm2',
    sender: 'Dimas',
    chat: 'Tim Hackathon',
    time: '18:47',
    text: 'Tolong kirim file video demo yang terbaru ya, yang durasi 90 detik. Link drive kemarin ternyata masih versi lama.',
  },
  {
    id: 'm3',
    sender: 'Sinta',
    chat: 'Keluarga',
    time: '19:05',
    text: 'Jangan lupa besok pagi video call sama ibu jam 8, beliau mau cerita soal rencana liburan akhir tahun.',
  },
];
