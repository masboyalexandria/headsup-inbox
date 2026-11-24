/**
 * Mesin ringkas + draf HeadsUp Inbox — PLUGGABLE.
 *
 * Default yang benar-benar bekerja: ringkasan EKSTRAKTIF deterministik
 * (kalimat pertama, dipotong ~48 char agar muat di HUD) + draf berbasis
 * template intent (jadwal / minta file / kabar). Bukan AI — jangan
 * diklaim sebagai AI.
 *
 * Hook LLM OPSIONAL: bila LLM_API_URL + LLM_API_KEY di-set (endpoint
 * kompatibel OpenAI /chat/completions), ringkasan & draf dicoba lewat
 * LLM dulu; kegagalan apa pun jatuh kembali ke mesin deterministik.
 * Setiap hasil membawa label `engine`: 'llm' | 'deterministic'.
 */

const MAX_SUMMARY = 48;

export function summarizeText(text) {
  const first = text.split(/(?<=[.!?])\s/)[0] ?? text;
  const clean = first.replace(/\s+/g, ' ').trim();
  return clean.length > MAX_SUMMARY ? clean.slice(0, MAX_SUMMARY - 3).trimEnd() + '…' : clean;
}

export function detectIntent(text) {
  const t = text.toLowerCase();
  if (/(jam berapa|kapan|jadwal|slot|pitch|meeting|rapat)/.test(t)) return 'schedule';
  // "video call" BUKAN minta file — video harus tidak diikuti "call".
  if (/(kirim|file|link|drive|dokumen|lampiran|video(?! call)|rekaman)/.test(t)) return 'file';
  return 'acknowledge';
}

const URGENT = /(penting|urgent|segera|darurat|deadline|asap|buru-buru)/;

export function isImportant(msg) {
  const intent = detectIntent(msg.text);
  return intent === 'schedule' || intent === 'file' || URGENT.test(msg.text.toLowerCase());
}

/** Template draf deterministik per intent — sama kategorinya dengan src/summarizer.ts. */
export function draftTemplate(msg) {
  switch (detectIntent(msg.text)) {
    case 'schedule':
      return `Hai ${msg.sender}, siap — jadwalnya kucatat, nanti kukonfirmasi lagi jam pastinya ya.`;
    case 'file':
      return `Siap ${msg.sender}, file-nya kukirim sekarang ya.`;
    default:
      return `Oke ${msg.sender}, sudah kucatat — makasih kabarnya!`;
  }
}

async function llmComplete(cfg, system, user) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(cfg.llmApiUrl.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${cfg.llmApiKey}`,
      },
      body: JSON.stringify({
        model: cfg.llmModel,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: 120,
        temperature: 0.3,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const out = data?.choices?.[0]?.message?.content?.trim();
    return out || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Perkaya pesan mentah {sender, text} menjadi item digest:
 * { summary, draft, important, engine }.
 */
export async function enrichMessage(cfg, msg) {
  const important = isImportant(msg);
  if (cfg.llmApiUrl && cfg.llmApiKey) {
    const [summary, draft] = await Promise.all([
      llmComplete(cfg, 'Ringkas pesan chat ini jadi SATU baris, maks 48 karakter, bahasa sama dengan pesan.', msg.text),
      llmComplete(cfg, 'Tulis draf balasan singkat, sopan, satu-dua kalimat, seolah dari penerima pesan.', `Dari ${msg.sender}: ${msg.text}`),
    ]);
    if (summary && draft) {
      return { summary: summary.slice(0, MAX_SUMMARY), draft, important, engine: 'llm' };
    }
  }
  return {
    summary: summarizeText(msg.text),
    draft: draftTemplate(msg),
    important,
    engine: 'deterministic',
  };
}
