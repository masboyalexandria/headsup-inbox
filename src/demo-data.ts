export interface IncomingMessage {
  id: string;
  sender: string;
  chat: string;
  time: string;
  text: string;
  important: boolean;
  /** Diisi backend (server/) bila terjangkau; fallback lokal di src/summarizer.ts. */
  summary?: string;
  draft?: string;
  sent?: boolean;
}

/**
 * Skenario demo scripted — dipakai sebagai fallback bila backend tidak
 * terjangkau. Backend (server/) men-seed data yang sama persis dalam
 * mode DEMO, dan menggantinya dengan pesan bot Telegram asli dalam
 * mode BOT. Tiga pesan = tiga pola yang dinilai juri: tanya jadwal,
 * minta file, kabar penting yang butuh balasan cepat.
 */
export const DEMO_MESSAGES: IncomingMessage[] = [
  {
    id: 'm1',
    sender: 'Rani',
    chat: 'Tim Hackathon',
    time: '18:42',
    text: 'Mas, demo day Even Realities jadi jam berapa? Aku butuh slot latihan pitch sebelum jam 3 sore, soalnya flight-ku jam 7 malam.',
    important: true,
  },
  {
    id: 'm2',
    sender: 'Dimas',
    chat: 'Tim Hackathon',
    time: '18:47',
    text: 'Tolong kirim file video demo yang terbaru ya, yang durasi 90 detik. Link drive kemarin ternyata masih versi lama.',
    important: true,
  },
  {
    id: 'm3',
    sender: 'Sinta',
    chat: 'Keluarga',
    time: '19:05',
    text: 'Jangan lupa besok pagi video call sama ibu jam 8, beliau mau cerita soal rencana liburan akhir tahun.',
    important: false,
  },
];
