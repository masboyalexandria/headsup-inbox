/**
 * Klien Telegram Bot API tipis di atas fetch bawaan Node — tanpa SDK.
 * Hanya dua method yang dipakai: getUpdates (long polling) + sendMessage.
 */

export class TelegramBot {
  constructor(token) {
    this.base = `https://api.telegram.org/bot${token}`;
    this.offset = 0;
  }

  async call(method, params = {}, timeoutMs = 40000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(`${this.base}/${method}`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(`Telegram ${method} gagal: ${data?.description ?? res.status}`);
      }
      return data.result;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Long polling: tunggu sampai 25 detik untuk update baru. */
  async getUpdates() {
    const updates = await this.call('getUpdates', {
      offset: this.offset,
      timeout: 25,
      allowed_updates: ['message'],
    }, 35000);
    for (const u of updates) this.offset = Math.max(this.offset, u.update_id + 1);
    return updates;
  }

  async sendMessage(chatId, text) {
    return this.call('sendMessage', { chat_id: chatId, text });
  }

  async getMe() {
    return this.call('getMe');
  }
}

export function formatTime(unixSeconds) {
  const d = new Date(unixSeconds * 1000);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
