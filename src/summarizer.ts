import type { IncomingMessage } from './demo-data';

/** Ringkasan satu baris yang muat di HUD 576×288: maks ~48 karakter. */
export function summarize(msg: IncomingMessage): string {
  const first = msg.text.split(/(?<=[.!?])\s/)[0] ?? msg.text;
  const clean = first.replace(/\s+/g, ' ').trim();
  return clean.length > 48 ? clean.slice(0, 45).trimEnd() + '…' : clean;
}

export type DraftIntent = 'schedule' | 'file' | 'acknowledge';

export function detectIntent(msg: IncomingMessage): DraftIntent {
  const t = msg.text.toLowerCase();
  if (/(jam berapa|kapan|jadwal|slot|pitch)/.test(t)) return 'schedule';
  // "video call" bukan minta file — perbaiki di hari ke-2 (server menemukan kasus ini).
  if (/(kirim|file|link|drive|video(?! call))/.test(t)) return 'file';
  return 'acknowledge';
}

/**
 * Draf balasan deterministik (tanpa LLM) — placeholder yang diganti
 * pemanggilan LLM pada 24–26 Nov. Template dipilih dari intent pesan.
 */
export function draftReply(msg: IncomingMessage): string {
  switch (detectIntent(msg)) {
    case 'schedule':
      return `Hai ${msg.sender}, demo day jam 15.00 — slot latihan pitch kamu jam 14.00, aman sebelum flight jam 19.00.`;
    case 'file':
      return `Siap ${msg.sender}, video demo 90 detik versi terbaru kukirim sekarang lewat Drive.`;
    default:
      return `Oke ${msg.sender}, besok jam 08.00 video call sama ibu — sudah kumasukkan pengingat.`;
  }
}
