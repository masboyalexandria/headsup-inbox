import {
  CreateStartUpPageContainer,
  ListContainerProperty,
  ListItemContainerProperty,
  MenuContainerProperty,
  MenuItemProperty,
  RebuildPageContainer,
  StartUpPageCreateResult,
  TextContainerProperty,
  TextContainerUpgrade,
  waitForEvenAppBridge,
  type EvenAppBridge,
} from '@evenrealities/even_hub_sdk';
import { DEMO_MESSAGES, type IncomingMessage } from './demo-data';
import { fetchBackendDigest, sendDraftViaBackend } from './api';
import { draftReply, summarize } from './summarizer';

const modeEl = document.getElementById('mode')!;
const hudEl = document.getElementById('hud')!;
const inboxEl = document.getElementById('inbox')!;
const draftPanelEl = document.getElementById('draft-panel')!;

type Screen = 'digest' | 'draft';
let screen: Screen = 'digest';
let selected = 0;
let sent: Record<string, boolean> = {};
let bridge: EvenAppBridge | null = null;

/** Sumber data aktif: backend bila terjangkau, kalau tidak data demo lokal. */
let messages: IncomingMessage[] = [...DEMO_MESSAGES];
const summaryOf = (m: IncomingMessage) => m.summary ?? summarize(m);
const draftOf = (m: IncomingMessage) => m.draft ?? draftReply(m);

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const importantCount = () => messages.filter((m) => m.important).length;
const digestItems = () =>
  messages.map((m) => `${m.important ? '! ' : ''}${m.sender}: ${summaryOf(m)}${sent[m.id] ? ' ✓' : ''}`);

/** ---- Render pratinjau HUD di DOM (isi sama dengan yang dikirim ke kacamata) ---- */
function renderHud() {
  if (screen === 'digest') {
    const items = messages.map((m, i) => {
      const tag = m.important ? '[!]' : '[ ]';
      const mark = sent[m.id] ? ' ✓' : '';
      return `<div class="hud-item${i === selected ? ' sel' : ''}"><span class="tag">${tag}</span> ${esc(m.sender)}: ${esc(summaryOf(m))}${mark}</div>`;
    }).join('');
    hudEl.innerHTML = `<div class="hud-head"><span>HEADSUP INBOX</span><span>${importantCount()} PENTING</span></div>${items}<div class="hud-foot">Tap = lihat draf · Menu = kirim / kembali</div>`;
  } else {
    const m = messages[selected];
    hudEl.innerHTML = `<div class="hud-head"><span>DRAF → ${esc(m.sender.toUpperCase())}</span><span>${esc(m.time)}</span></div><div class="hud-draft">${esc(draftOf(m))}</div><div class="hud-foot">Menu: [Kirim draf] [Kembali]</div>`;
  }
}

function renderPhone() {
  inboxEl.innerHTML = messages.map((m, i) => {
    return `<div class="msg"><b>${esc(m.sender)}</b> <span class="meta">· ${esc(m.chat)} · ${esc(m.time)}${m.important ? ' · PENTING' : ''}${sent[m.id] ? ' · <span class="sent">TERKIRIM ✓</span>' : ''}</span><p class="digest">${esc(summaryOf(m))}</p><button data-act="draft" data-i="${i}">Lihat draf</button></div>`;
  }).join('');
  const m = messages[selected];
  draftPanelEl.innerHTML = screen === 'draft'
    ? `<div class="draft-box"><p><b>Draf balasan → ${esc(m.sender)}:</b></p><p>${esc(draftOf(m))}</p><button data-act="send">Kirim draf</button><button class="ghost" data-act="back">Kembali</button></div>`
    : '';
}

function renderAll() {
  renderHud();
  renderPhone();
}

inboxEl.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
  if (!t) return;
  if (t.dataset.act === 'draft') {
    selected = Number(t.dataset.i);
    void showDraft();
  }
});

draftPanelEl.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
  if (!t) return;
  if (t.dataset.act === 'send') void sendDraft();
  if (t.dataset.act === 'back') void showDigest();
});

/** ---- Halaman kacamata via Even Hub SDK (class SDK, bukan plain object) ---- */
const DIGEST_LIST_ID = 1;
const DIGEST_HEAD_ID = 2;
const DRAFT_TEXT_ID = 3;

function digestPage() {
  return new RebuildPageContainer({
    containerTotalNum: 2,
    listObject: [new ListContainerProperty({
      xPosition: 8, yPosition: 44, width: 560, height: 200,
      containerID: DIGEST_LIST_ID, containerName: 'digest-list', zOrderIndex: 2,
      itemContainer: new ListItemContainerProperty({ itemCount: messages.length, itemName: digestItems() }),
      isEventCapture: 1,
    })],
    textObject: [new TextContainerProperty({
      xPosition: 8, yPosition: 8, width: 560, height: 30,
      containerID: DIGEST_HEAD_ID, containerName: 'digest-head', zOrderIndex: 1,
      content: `HEADSUP INBOX — ${importantCount()} PENTING`,
      textColor: 4, isEventCapture: 0,
    })],
    menuObject: new MenuContainerProperty({ menuItems: [new MenuItemProperty({ itemName: 'Muat ulang', itemID: 1 })] }),
  });
}

async function showDigest() {
  screen = 'digest';
  renderAll();
  if (!bridge) return;
  const ok = await bridge.rebuildPageContainer(digestPage());
  console.log('[HeadsUp] rebuild digest:', ok);
}

async function showDraft() {
  screen = 'draft';
  renderAll();
  if (!bridge) return;
  const m = messages[selected];
  const ok = await bridge.rebuildPageContainer(new RebuildPageContainer({
    containerTotalNum: 1,
    textObject: [new TextContainerProperty({
      xPosition: 8, yPosition: 8, width: 560, height: 240,
      containerID: DRAFT_TEXT_ID, containerName: 'draft-text', zOrderIndex: 1,
      content: `DRAF → ${m.sender}\n${draftOf(m)}`,
      textColor: 4, isEventCapture: 1,
    })],
    menuObject: new MenuContainerProperty({ menuItems: [
      new MenuItemProperty({ itemName: 'Kirim draf', itemID: 1 }),
      new MenuItemProperty({ itemName: 'Kembali', itemID: 2 }),
    ] }),
  }));
  console.log('[HeadsUp] rebuild draft:', ok);
}

async function sendDraft() {
  const m = messages[selected];
  const text = draftOf(m);
  sent = { ...sent, [m.id]: true };
  // Kirim lewat backend (mode BOT: beneran via Bot API; mode DEMO backend:
  // dicatat di log server). Backend tak terjangkau → tetap ditandai
  // terkirim lokal agar alur demo end-to-end tidak putus.
  const viaBackend = await sendDraftViaBackend(m.id, text);
  console.log(`[HeadsUp] draft → ${m.sender}: "${text}" — ${viaBackend ? 'diproses backend ✓' : 'backend tak terjangkau, terkirim lokal (demo)'}`);
  await showDigest();
  if (bridge) {
    await bridge.textContainerUpgrade(new TextContainerUpgrade({
      containerID: DIGEST_HEAD_ID, containerName: 'digest-head',
      content: `TERKIRIM ✓ → ${m.sender}`,
    }));
  }
}

async function initGlasses(b: EvenAppBridge) {
  bridge = b;
  const result = await bridge.createStartUpPageContainer(new CreateStartUpPageContainer({
    containerTotalNum: 2,
    listObject: [new ListContainerProperty({
      xPosition: 8, yPosition: 44, width: 560, height: 200,
      containerID: DIGEST_LIST_ID, containerName: 'digest-list', zOrderIndex: 2,
      itemContainer: new ListItemContainerProperty({ itemCount: messages.length, itemName: digestItems() }),
      isEventCapture: 1,
    })],
    textObject: [new TextContainerProperty({
      xPosition: 8, yPosition: 8, width: 560, height: 30,
      containerID: DIGEST_HEAD_ID, containerName: 'digest-head', zOrderIndex: 1,
      content: `HEADSUP INBOX — ${importantCount()} PENTING`,
      textColor: 4, isEventCapture: 0,
    })],
    menuObject: new MenuContainerProperty({ menuItems: [new MenuItemProperty({ itemName: 'Muat ulang', itemID: 1 })] }),
  }));
  console.log('[HeadsUp] createStartUpPageContainer:', StartUpPageCreateResult[result] ?? result);
  if (result !== StartUpPageCreateResult.success) {
    console.warn('[HeadsUp] startup page NOT success, continuing in preview mode');
  }

  bridge.onEvenHubEvent((event) => {
    if (event.listEvent) {
      const name = event.listEvent.currentSelectItemName ?? '';
      const idx = messages.findIndex((m) => name.includes(m.sender));
      console.log('[HeadsUp] list select:', name, '->', idx);
      if (idx >= 0) {
        selected = idx;
        void showDraft();
      }
    }
    if (event.menuItemClickEvent) {
      const id = event.menuItemClickEvent.itemID;
      console.log('[HeadsUp] menu click:', id, 'screen=', screen);
      if (screen === 'draft' && id === 1) void sendDraft();
      else if (screen === 'draft' && id === 2) void showDigest();
      else if (screen === 'digest' && id === 1) void showDigest();
    }
  });
}

/** ---- Boot: bridge bila ada (Even App / simulator), fallback pratinjau browser ---- */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p.then((v) => v as T | null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

async function boot() {
  renderAll();
  // Coba backend dulu: bila /api/digest menjawab, pakai data backend
  // (mode DEMO backend = seed yang sama; mode BOT = pesan Telegram asli).
  const backend = await fetchBackendDigest();
  if (backend) {
    messages = backend.messages;
    for (const m of backend.messages) if (m.sent) sent[m.id] = true;
    selected = 0;
    renderAll();
    modeEl.textContent = `Backend terhubung ✓ — mode ${backend.mode}, engine ${backend.engine}.`;
  }
  const b = await withTimeout(waitForEvenAppBridge(), 3000);
  if (b) {
    modeEl.textContent = 'Terhubung ke Even App ✓ — HUD kacamata aktif via SDK.';
    console.log('[HeadsUp] bridge ready');
    await initGlasses(b);
  } else if (!backend) {
    modeEl.textContent = 'Mode pratinjau browser — buka di Even App / simulator untuk HUD kacamata.';
    console.log('[HeadsUp] no Even App bridge after 3s — browser preview mode');
  }
  console.log('[HeadsUp] ready: digest of', messages.length, 'messages');
}

void boot();
