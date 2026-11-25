import type { ShareCard, YearShareCard } from './logic';

const W = 1080;
const H = 1350;
const C = {
  bg: '#0f1115',
  surface: '#181b22',
  text: '#eef0f4',
  muted: '#8b92a5',
  accent: '#ff6b3d',
  ok: '#3ccf7a',
  gold: '#f5c400',
};
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

/** Tegner opsummeringen som et billede i Løfts eget design (#144) */
export function drawShareCard(card: ShareCard): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.accent;
  ctx.fillRect(0, 0, W, 16);

  const pad = 80;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.accent;
  ctx.font = `800 64px ${FONT}`;
  ctx.fillText(card.app, pad, 150);
  ctx.fillStyle = C.muted;
  ctx.font = `400 36px ${FONT}`;
  ctx.fillText(card.date, pad, 210);

  ctx.fillStyle = C.text;
  ctx.font = `700 72px ${FONT}`;
  let title = card.title;
  while (ctx.measureText(title).width > W - 2 * pad && title.length > 1) title = title.slice(0, -2) + '…';
  ctx.fillText(title, pad, 320);

  // 2×2 felter med tal
  const gap = 32;
  const boxW = (W - 2 * pad - gap) / 2;
  const boxH = 200;
  card.stats.forEach((st, i) => {
    const x = pad + (i % 2) * (boxW + gap);
    const y = 380 + Math.floor(i / 2) * (boxH + gap);
    ctx.fillStyle = C.surface;
    roundRect(ctx, x, y, boxW, boxH, 28);
    ctx.fillStyle = C.muted;
    ctx.font = `400 34px ${FONT}`;
    ctx.fillText(st.label, x + 36, y + 70);
    ctx.fillStyle = C.text;
    ctx.font = `700 60px ${FONT}`;
    ctx.fillText(st.value, x + 36, y + 150);
  });

  let y = 380 + 2 * (boxH + gap) + 40;
  if (card.change) {
    ctx.fillStyle = card.change.startsWith('+') ? C.ok : C.muted;
    ctx.font = `700 44px ${FONT}`;
    ctx.fillText(card.change, pad, y);
    y += 80;
  }
  ctx.font = `500 38px ${FONT}`;
  ctx.fillStyle = C.gold;
  for (const r of card.records.slice(0, 5)) {
    let line = r;
    while (ctx.measureText(line).width > W - 2 * pad && line.length > 1) line = line.slice(0, -2) + '…';
    ctx.fillText(line, pad, y);
    y += 60;
  }

  ctx.fillStyle = C.muted;
  ctx.font = `400 30px ${FONT}`;
  ctx.fillText('Logget med Løft', pad, H - 70);
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/** Åbner telefonens del-menu med billedet, eller downloader det, hvis det ikke kan deles */
async function shareCanvas(canvas: HTMLCanvasElement, fileName: string, title: string): Promise<void> {
  const blob = await toBlob(canvas);
  if (!blob) return;
  const file = new File([blob], fileName, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title });
      return;
    } catch (e) {
      // Brugeren lukkede del-menuen – ikke en fejl
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Deler opsummeringen af en træning som billede (#144) */
export function shareSummaryImage(card: ShareCard): Promise<void> {
  return shareCanvas(drawShareCard(card), card.fileName, `${card.app} – ${card.title}`);
}

/** Tegner "Mit træningsår" som et kvadratisk billede (#310) */
export function drawYearCard(card: YearShareCard): HTMLCanvasElement {
  const S = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = C.accent;
  ctx.fillRect(0, 0, S, 16);

  const pad = 80;
  const fit = (text: string, max: number) => {
    let t = text;
    while (ctx.measureText(t).width > max && t.length > 1) t = t.slice(0, -2) + '…';
    return t;
  };
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.accent;
  ctx.font = `800 56px ${FONT}`;
  ctx.fillText(card.app, pad, 130);
  ctx.fillStyle = C.text;
  ctx.font = `800 76px ${FONT}`;
  ctx.fillText(fit(card.title, S - 2 * pad), pad, 240);

  const gap = 28;
  const boxW = (S - 2 * pad - gap) / 2;
  const boxH = 180;
  card.stats.forEach((st, i) => {
    const x = pad + (i % 2) * (boxW + gap);
    const y = 300 + Math.floor(i / 2) * (boxH + gap);
    ctx.fillStyle = C.surface;
    roundRect(ctx, x, y, boxW, boxH, 28);
    ctx.fillStyle = C.muted;
    ctx.font = `400 32px ${FONT}`;
    ctx.fillText(st.label, x + 34, y + 64);
    ctx.fillStyle = C.text;
    ctx.font = `700 56px ${FONT}`;
    ctx.fillText(fit(st.value, boxW - 68), x + 34, y + 140);
  });

  let y = 300 + 2 * (boxH + gap) + 50;
  ctx.font = `500 38px ${FONT}`;
  ctx.fillStyle = C.gold;
  for (const line of card.lines.slice(0, 3)) {
    ctx.fillText(fit(line, S - 2 * pad), pad, y);
    y += 58;
  }
  ctx.fillStyle = C.muted;
  ctx.font = `400 30px ${FONT}`;
  ctx.fillText('Logget med Løft', pad, S - 60);
  return canvas;
}

/** Deler "Mit træningsår" som billede (#310) */
export function shareYearImage(card: YearShareCard): Promise<void> {
  return shareCanvas(drawYearCard(card), card.fileName, `${card.app} – ${card.title}`);
}
