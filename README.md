# HeadsUp Inbox — Even Realities “Heads Up” Hackathon

Pendamping Telegram untuk kacamata Even G2. Trek: **Messaging & News** (target juara 1
$1.250) + **Best Telegram Integration** ($1.000). Pool total $10.000, Demo Day 3 Des 2026,
submit tutup **30 Nov 2026 03.59 WITA**.

## Yang dilakukan app ini

1. **Digest** — pesan Telegram masuk diringkas jadi satu baris yang muat di HUD
   kacamata 576×288 (hijau monokrom), pesan penting ditandai `[!]`.
2. **Draf balasan AI** — tap pesan di kacamata → halaman draf; menu kacamata:
   **Kirim draf** / **Kembali**. Persetujuan tetap di tangan pengguna.
3. **Panel HP** — daftar pesan + draf yang sama, untuk demo dari browser biasa.

Mesin ringkas/draf saat ini: **deterministik** (bukan AI) — ringkasan
ekstraktif + template intent (jadwal / minta file / kabar), berjalan di
backend (`server/summarizer.mjs`) dan dicerminkan di frontend
(`src/summarizer.ts`) sebagai fallback offline. Hook LLM **opsional**
tersedia lewat env `LLM_API_URL`/`LLM_API_KEY` (endpoint kompatibel
OpenAI); label engine (`llm`/`deterministic`) dilaporkan apa adanya di
respons `/api/digest`.

## Stack

Vite + TypeScript + `@evenrealities/even_hub_sdk` **0.0.16** (PREP lama menulis
0.0.14 / simulator 0.9.3 — keduanya sudah naik: simulator **0.9.5**).
Backend: Node polos tanpa dependensi tambahan (`server/`, fetch bawaan)
— bot Telegram via long polling Bot API, store JSON lokal, HTTP API
`/api/digest` + `/api/send`.
Halaman kacamata memakai container API resmi: `createStartUpPageContainer`
(list digest + header teks) lalu `rebuildPageContainer` untuk halaman draf,
`textContainerUpgrade` untuk status “TERKIRIM ✓”. Di luar Even App, app
jatuh ke **mode pratinjau browser** (bridge ditunggu 3 detik, lalu DOM yang
sama dirender).

## Menjalankan

Frontend:

```bash
npm install
npm run dev      # http://127.0.0.1:5173
npm run build    # tsc + vite build -> dist/
```

Backend (bot Telegram + digest API, port 8787):

```bash
cp .env.example .env   # isi BOT_TOKEN dari @BotFather
npm run server         # node server/index.mjs
curl http://127.0.0.1:8787/api/digest
```

- **Mode DEMO** (tanpa `BOT_TOKEN`): server men-seed 3 pesan contoh yang
  sama dengan frontend; `POST /api/send` **tidak** menyentuh Telegram —
  draf hanya dicatat sebagai `WOULD SEND` di log server.
- **Mode BOT** (`BOT_TOKEN` terisi): bot long-polling; chat privat
  pertama yang menulis ke bot terdaftar sebagai pemilik (atau paksa via
  `OWNER_CHAT_ID`), hanya pesan pemilik yang dikumpulkan ke store
  (`server/data/messages.json`); `POST /api/send` mengirim beneran ke
  chat pemilik via bot.
- Frontend mengambil digest dari backend (dev/preview: `/api` di-proxy
  Vite ke 8787; build mandiri: set `VITE_API_BASE`). Bila backend tidak
  terjangkau, frontend jatuh ke data demo bawaan — alur kacamata
  digest → draf → Kirim draf tetap jalan end-to-end.

Simulator (headless):

```bash
npm install -g @evenrealities/evenhub-simulator   # butuh libwebkit2gtk-4.1 di Linux
xvfb-run -a evenhub-simulator http://127.0.0.1:5173/ --automation-port 9898
curl http://127.0.0.1:9898/api/ping
curl http://127.0.0.1:9898/api/screenshot/glasses -o glasses.png  # 576×288 RGBA
curl http://127.0.0.1:9898/api/console
```

## Status build week (diperbarui 24 Nov 2026)

- **24 Nov (hari 2):** backend `server/` jadi — bot Telegram long
  polling (Bot API via fetch, tanpa SDK), store JSON, endpoint
  `GET /api/digest` + `POST /api/send`, mesin ringkas/draf pluggable
  (deterministik default; hook LLM opsional via env). Frontend ter-wire
  ke backend dengan fallback data demo lokal; Vite proxy `/api` →
  8787. Terverifikasi: `tsc --noEmit && vite build` lolos (8 modul);
  server mode DEMO menjawab `/api/digest` dengan 3 pesan contoh
  (klasifikasi intent + flag penting cocok dengan data demo);
  `POST /api/send` mode DEMO hanya mencatat `WOULD SEND` di log, tidak
  memanggil Telegram; halaman + proxy `/api` via port 5173 menjawab
  200/JSON. Perbaikan intent hari ke-2: "video call" tidak lagi
  terbaca sebagai minta file (regex `video(?! call)` di server +
  frontend).
- **24 Nov malam:** mode BOT **AKTIF** — bot **@HeadsUpInboxBot** dibuat
  pemilik via @BotFather; server jalan mode BOT, chat pemilik terdaftar,
  pesan masuk terkumpul ke store, dan uji kirim beneran via
  `POST /api/send` **berhasil terkirim** ke Telegram pemilik. Alur
  ujung-ke-ujung (Telegram → backend → digest → draf → kirim) terbukti.

- **23 Nov (hari 1):** scaffold + build lolos (`tsc` + `vite build`, 7 modul).
  Bridge Even App + `createStartUpPageContainer` **success** terverifikasi di
  simulator 0.9.5 (console: "bridge ready", "createStartUpPageContainer:
  success", "ready: digest of 3 messages"); webview simulator merender app
  dengan sempurna (screenshot `/tmp/webview.png`). **Namun framebuffer
  kacamata tetap hijau polos** (576×288, 100% piksel (0,255,0)) di 3
  screenshot — bahkan untuk halaman uji minimal (satu text container ASCII
  "HELLO GLASSES", tanpa list/menu/zOrder). Jadi ini bukan salah container
  app: pipeline render kacamata simulator tidak menghasilkan gambar di VM
  headless ini (kemungkinan tanpa GPU — log simulator: DRI3 device tidak
  ada). Verifikasi visual kacamata pindah ke laptop Masboy.
  Bukti: `sim-glasses-digest.png` (framebuffer hijau) di folder ini.
- **25–26 Nov:** poles draf + uji pakai beneran dengan bot live.
- **27 Nov:** beku fitur, uji end-to-end.
- **28 Nov:** tulis BUIDL DoraHacks, submit awal.
- **29 Nov:** buffer + submit final sebelum 30 Nov 03.59 WITA.

## Catatan

- Semua kode proyek ini ditulis **setelah build week dibuka (23 Nov 2026 16.00
  WITA)** — tidak ada kode pre-built sebelum jendela resmi, sesuai aturan
  pengungkapan hackathon.
- Repo GitHub publik: https://github.com/masboyalexandria/headsup-inbox
  (akun GitHub yang login di Chrome pemilik saat build week; kode di-upload
  saat submit).
- Finalis presentasi 3 Des — Masboy tampil, deck + skrip disiapkan Maya.
- Payout (bila menang): USDT; alamat EVM default Masboy
  0xb1d3206f7f90a24f48c056b4ab74c77d5e79eaba, jaringan mengikuti aturan resmi.
