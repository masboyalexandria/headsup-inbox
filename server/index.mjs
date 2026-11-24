import { createServer } from 'node:http';
import { loadEnv } from './env.mjs';
import { Store, DEMO_SEED } from './store.mjs';
import { TelegramBot, formatTime } from './telegram.mjs';
import { enrichMessage } from './summarizer.mjs';

/**
 * HeadsUp Inbox backend.
 *
 * Mode BOT  : BOT_TOKEN terisi → long polling Telegram, pesan dari chat
 *             pemilik disimpan, /api/send mengirim beneran via bot.
 * Mode DEMO : tanpa BOT_TOKEN → store di-seed 3 pesan contoh yang sama
 *             dengan frontend; /api/send TIDAK menyentuh Telegram,
 *             hanya mencatat draf yang "akan dikirim" ke log.
 */

const cfg = loadEnv();
const store = new Store();
const demo = !cfg.botToken;
const bot = demo ? null : new TelegramBot(cfg.botToken);

if (cfg.ownerChatId && !store.ownerChatId) store.setOwner(String(cfg.ownerChatId));

async function seedDemo() {
  if (store.messages.length > 0) return;
  for (const seed of DEMO_SEED) {
    const enriched = await enrichMessage(cfg, seed);
    store.add({ ...seed, chatId: null, sent: false, ...enriched });
  }
  console.log(`[server] DEMO seed: ${store.messages.length} pesan contoh`);
}

async function pollLoop() {
  const me = await bot.getMe();
  console.log(`[server] bot aktif sebagai @${me.username} — long polling mulai`);
  for (;;) {
    try {
      const updates = await bot.getUpdates();
      for (const u of updates) {
        const msg = u.message;
        if (!msg?.text || msg.chat?.type !== 'private') continue;
        const chatId = String(msg.chat.id);
        // Chat privat pertama yang menulis ke bot = pemilik; chat lain diabaikan.
        if (!store.ownerChatId) {
          store.setOwner(chatId);
          console.log(`[server] owner chat terdaftar: ${chatId} (${msg.from?.first_name ?? '?'})`);
        }
        if (chatId !== String(store.ownerChatId)) {
          console.log(`[server] abaikan pesan dari chat bukan pemilik: ${chatId}`);
          continue;
        }
        const raw = {
          id: `tg-${chatId}-${msg.message_id}`,
          sender: msg.from?.first_name ?? 'Unknown',
          chat: 'Telegram',
          chatId,
          time: formatTime(msg.date),
          text: msg.text,
        };
        const enriched = await enrichMessage(cfg, raw);
        if (store.add({ ...raw, sent: false, ...enriched })) {
          console.log(`[server] pesan baru dari ${raw.sender}: ${enriched.summary}`);
        }
      }
    } catch (err) {
      console.warn('[server] polling error, retry 3s:', err.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

function json(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (req.method === 'OPTIONS') return json(res, 204, {});

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return json(res, 200, { ok: true, mode: demo ? 'demo' : 'bot', messages: store.messages.length });
  }

  if (req.method === 'GET' && url.pathname === '/api/digest') {
    const messages = store.latest(20);
    const engine = messages.length ? messages[messages.length - 1].engine : 'deterministic';
    return json(res, 200, { mode: demo ? 'demo' : 'bot', engine, messages });
  }

  if (req.method === 'POST' && url.pathname === '/api/send') {
    let body;
    try {
      body = await readBody(req);
    } catch {
      return json(res, 400, { ok: false, error: 'body bukan JSON valid' });
    }
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) return json(res, 400, { ok: false, error: 'field "text" wajib diisi' });
    const target = store.messages.find((m) => m.id === body.id);
    const chatId = target?.chatId ?? store.ownerChatId;

    if (demo) {
      // DEMO: jangan panggil Telegram sama sekali — catat saja.
      console.log(`[demo] WOULD SEND ke owner chat (${chatId ?? 'belum ada'}): "${text}"`);
      if (body.id) store.markSent(body.id);
      return json(res, 200, { ok: true, demo: true, sent: false, note: 'demo mode — tidak dikirim ke Telegram, hanya dicatat di log server' });
    }

    if (!chatId) return json(res, 409, { ok: false, error: 'owner chat belum terdaftar — kirim pesan apa pun ke bot dulu' });
    try {
      await bot.sendMessage(chatId, text);
      if (body.id) store.markSent(body.id);
      console.log(`[server] terkirim ke ${chatId}: "${text}"`);
      return json(res, 200, { ok: true, demo: false, sent: true });
    } catch (err) {
      return json(res, 502, { ok: false, error: `Telegram sendMessage gagal: ${err.message}` });
    }
  }

  return json(res, 404, { ok: false, error: 'endpoint tidak dikenal' });
});

if (demo) await seedDemo();

server.listen(cfg.port, '127.0.0.1', () => {
  console.log(`[server] HeadsUp Inbox backend di http://127.0.0.1:${cfg.port} — mode: ${demo ? 'DEMO (tanpa BOT_TOKEN)' : 'BOT'}`);
  if (demo) console.log('[server] isi BOT_TOKEN di .env untuk mode bot asli.');
});

if (!demo) {
  pollLoop().catch((err) => console.error('[server] polling berhenti:', err));
}
