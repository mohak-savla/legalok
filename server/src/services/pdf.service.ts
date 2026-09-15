import PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { parseHtmlToElements, validateImageForEmbed, type DocxElement } from './docx.service';

const MARGIN = 56;
const BODY_SIZE = 11;

// Layout parity targets — derived from doc.css and the DOCX exporter so the
// PDF looks like the on-screen preview and the Word download:
//   body copy -> line-height 1.7, justified
//   paragraph -> ~6.5pt after
//   h1        -> centered, 20pt after
//   h2        -> 22px before / 8px after
//   h3        -> 12px before / 6px after
//   li        -> 4pt after
const LINE_MULT = 1.7;          // matches doc.css line-height:1.7 & DOCX w:line=408
const BASE_FONT_LH = 1.15;      // pdfkit intrinsic line-height factor (base-14 fonts)
const PARAGRAPH_GAP = 6.5;      // pts after each body paragraph
const LIST_GAP = 4;

/** lineGap so each rendered line lands at size × LINE_MULT */
function lineGapFor(size: number): number {
  return size * (LINE_MULT - BASE_FONT_LH);
}

interface Run { text: string; bold?: boolean; italic?: boolean; script?: boolean }

type FontPair = { regular: string | null; bold: string | null; italic: string | null; boldItalic: string | null };

/** Locate system/bundled font files (Georgia family + Segoe UI for ₹). */
function fontCandidates(): { family: 'georgia' | 'segoe' | 'script'; variant: keyof FontPair; file: string }[] {
  const windir = process.env.WINDIR || 'C:\\Windows';
  const win = path.join(windir, 'Fonts');
  const bundle = (name: string) => path.join(__dirname, '..', '..', 'assets', 'fonts', `${name}.ttf`);
  const pick = (winName: string, bundleName: string): string | null =>
    fs.existsSync(path.join(win, winName)) ? path.join(win, winName)
      : (fs.existsSync(bundle(bundleName)) ? bundle(bundleName) : null);
  const pairs: ['georgia' | 'segoe' | 'script', keyof FontPair, string, string][] = [
    ['georgia', 'regular', 'georgia.ttf', 'Georgia-Regular'],
    ['georgia', 'bold', 'georgiab.ttf', 'Georgia-Bold'],
    ['georgia', 'italic', 'georgiai.ttf', 'Georgia-Italic'],
    ['georgia', 'boldItalic', 'georgiaz.ttf', 'Georgia-BoldItalic'],
    ['segoe', 'regular', 'segoeui.ttf', 'SegoeUI-Regular'],
    ['segoe', 'bold', 'segoeuib.ttf', 'SegoeUI-Bold'],
    ['segoe', 'italic', 'segoeuii.ttf', 'SegoeUI-Italic'],
    ['segoe', 'boldItalic', 'segoeuiz.ttf', 'SegoeUI-BoldItalic'],
    ['script', 'regular', 'segoesc.ttf', 'SegoeScript-Regular'],
    ['script', 'bold', 'segoescb.ttf', 'SegoeScript-Bold'],
  ];
  return pairs
    .map(([family, variant, winName, bundleName]) => {
      const file = pick(winName, bundleName);
      return file ? { family, variant, file } : null;
    })
    .filter((x): x is { family: 'georgia' | 'segoe' | 'script'; variant: keyof FontPair; file: string } => !!x);
}

function fontFiles(): { family: 'georgia' | 'segoe' | 'script'; variant: keyof FontPair; file: string }[] {
  if (resolved) return resolved;
  resolved = fontCandidates();
  return resolved;
}

let resolved: { family: 'georgia' | 'segoe' | 'script'; variant: keyof FontPair; file: string }[] | null = null;

interface DocFonts { georgia: FontPair; segoe: FontPair; script: FontPair; hasRupeeFont: boolean }

const EMPTY_FONT: FontPair = { regular: null, bold: null, italic: null, boldItalic: null };

/** Register usable fonts onto a fresh PDFDocument (font registries are per-document). */
function registerFonts(doc: InstanceType<typeof PDFDocument>): DocFonts {
  const georgia: FontPair = { ...EMPTY_FONT };
  const segoe: FontPair = { ...EMPTY_FONT };
  const script: FontPair = { ...EMPTY_FONT };
  for (const c of fontFiles()) {
    try {
      doc.registerFont(`${c.family}-${c.variant}`, c.file);
      const target = c.family === 'georgia' ? georgia : c.family === 'segoe' ? segoe : script;
      target[c.variant] = `${c.family}-${c.variant}`;
    } catch { /* font failed to load — fall back */ }
  }
  return { georgia, segoe, script, hasRupeeFont: !!segoe.regular };
}

function pickFont(fonts: DocFonts, bold: boolean | undefined, italic: boolean | undefined,
  text: string | undefined, script = false): string {
  const helv: FontPair = { regular: 'Helvetica', bold: 'Helvetica-Bold', italic: 'Helvetica-Oblique', boldItalic: 'Helvetica-BoldOblique' };
  // .sig-typed — cursive signature font matching the website (Segoe Script).
  if (script) {
    const fallback = fonts.georgia.italic || fonts.georgia.regular || helv.regular!;
    const base = fonts.script.regular
      ? fonts.script
      : { regular: fallback, bold: fallback, italic: fallback, boldItalic: fallback };
    return (bold && italic ? base.boldItalic : bold ? (base.bold || base.regular) : italic ? (base.italic || base.regular) : base.regular) ?? 'Helvetica';
  }
  const needsRupee = !!(text ?? '').includes('₹');
  // Use the ₹-capable family only for runs that actually contain the glyph.
  const base = needsRupee && fonts.hasRupeeFont ? (fonts.segoe.regular ? fonts.segoe : helv)
    : (fonts.georgia.regular ? fonts.georgia : helv);
  return (bold && italic ? base.boldItalic : bold ? base.bold : italic ? base.italic : base.regular) ?? 'Helvetica';
}

/** Convert resolved HTML to a real server-side PDF buffer */
export async function generatePdf(html: string, title?: string): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    info: { Title: title || 'Legalok Document' },
  });
  const fonts = registerFonts(doc);
  const fontFor = (bold: boolean | undefined, italic: boolean | undefined, text: string | undefined, script = false): string =>
    pickFont(fonts, bold, italic, text, script);
  // Helvetica has no ₹ glyph (WinAnsi). Only when no ₹-capable font is embedded
  // spell it out — never emit a broken glyph.
  const safe = fonts.hasRupeeFont ? (html || '') : (html || '').replace(/₹/g, 'Rs. ');
  const elements = parseHtmlToElements(safe);
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const W = doc.page.width - MARGIN * 2;
  const bottom = doc.page.height - MARGIN;

  const ensure = (h: number): void => { if (doc.y + h > bottom) doc.addPage(); };
  /** Move down by an absolute number of points using the current line height. */
  const gap = (pts: number): void => {
    const lh = doc.currentLineHeight() || BODY_SIZE * LINE_MULT;
    doc.moveDown(Math.max(0.02, pts / lh));
  };

  const drawRuns = (runs: Run[], size: number, align: 'left' | 'center' | 'right' | 'justify',
    color: string, afterPts: number): void => {
    ensure(size * LINE_MULT + afterPts);
    runs.forEach((r, idx) => {
      doc.font(fontFor(r.bold, r.italic, r.text, r.script)).fontSize(size).fillColor(color);
      const last = idx === runs.length - 1;
      doc.text(r.text, { width: W, align, lineGap: lineGapFor(size), continued: !last });
    });
    gap(afterPts);
  };

  const renderRuns = (el: DocxElement, size: number, gapAfter: number,
    align: 'left' | 'center' | 'right' | 'justify' = 'left', color = 'black'): void => {
    drawRuns(collectRuns(el), size, align, color, gapAfter);
  };

  const renderTable = (rows: string[][]): void => {
    const cols = Math.max(...rows.map((r) => r.length), 1);
    const colW = W / cols;
    const pad = 6;
    const T = 10, TLH = T * LINE_MULT;
    for (const row of rows) {
      let lines = 1;
      for (const cell of row) {
        const h = doc.heightOfString(cell || ' ', { width: colW - pad * 2, lineGap: lineGapFor(T) });
        lines = Math.max(lines, Math.max(1, Math.ceil(h / TLH)));
      }
      const rowH = lines * TLH + pad * 2;
      ensure(rowH);
      const y = doc.y;
      doc.lineWidth(0.6).strokeColor('#BBBBBB');
      for (let c = 0; c <= cols; c++) {
        doc.moveTo(MARGIN + c * colW, y).lineTo(MARGIN + c * colW, y + rowH).stroke();
      }
      doc.moveTo(MARGIN, y).lineTo(MARGIN + cols * colW, y).stroke();
      doc.moveTo(MARGIN, y + rowH).lineTo(MARGIN + cols * colW, y + rowH).stroke();
      for (let c = 0; c < cols; c++) {
        doc.font(fontFor(false, false, row[c] ?? '')).fontSize(T).fillColor('#111827');
        doc.text(row[c] || ' ', MARGIN + c * colW + pad, y + pad, { width: colW - pad * 2, lineGap: lineGapFor(T) });
      }
      doc.x = MARGIN;
      doc.y = y + rowH;
    }
    gap(LIST_GAP);
  };

  const renderImage = (src: string): void => {
    const img = validateImageForEmbed(src || '');
    if (!img) return;
    try {
      ensure(210);
      doc.image(img.buf, MARGIN, doc.y + 4, { fit: [220, 180] });
      doc.y += 195;
      doc.moveDown(0.2);
    } catch { /* malformed image — skip */ }
  };

  // Count consecutive list items for numbering
  const listNumbers = new Map<number, { n: number; isBullet: boolean }>();
  {
    let n = 0; let isBullet = false;
    elements.forEach((el, idx) => {
      if (el.type === 'list-item') {
        if (n === 0) isBullet = el.listType === 'bullet';
        n += 1;
        listNumbers.set(idx, { n, isBullet });
      } else { n = 0; }
    });
  }

  for (let idx = 0; idx < elements.length; idx++) {
    const el = elements[idx];
    doc.x = MARGIN;
    switch (el.type) {
      case 'pagebreak':
        doc.addPage();
        break;
      case 'empty':
        ensure(10);
        doc.moveDown(0.35);
        break;
      case 'heading': {
        const size = el.level === 1 ? 17 : el.level === 2 ? 13 : 11.5;
        const align = el.align ?? (el.level === 1 ? 'center' : 'left');
        const after = el.level === 1 ? 20 : el.level === 2 ? 8 : 6;
        if (el.level && el.level >= 2) gap(14); // top margin (≈22px web / 440 twips DOCX)
        renderRuns(el, size, after, align, '#111827');
        break;
      }
      case 'table':
        if (el.tableData && el.tableData.length > 0) renderTable(el.tableData);
        break;
      case 'image':
        if (el.imageSrc) renderImage(el.imageSrc);
        break;
      case 'list-item': {
        const info = listNumbers.get(idx);
        const label = info?.isBullet ? '•  ' : `${info?.n ?? 1}.  `;
        const runs = collectRuns(el);
        if (runs.length > 0) runs[0] = { text: label + runs[0].text, bold: runs[0].bold, italic: runs[0].italic };
        drawRuns(runs, BODY_SIZE, 'justify', '#111827', LIST_GAP);
        break;
      }
      default:
        if (el.before) gap(el.before);
        if (el.script) renderRuns(el, 18, 8, 'left', '#111827');      // ≈ website 24px script signature
        else if (el.label) renderRuns(el, 8, 4, 'left', '#6B7280');   // ≈ website 11px gray label
        else renderRuns(el, BODY_SIZE, PARAGRAPH_GAP, el.align ?? 'justify', '#111827');
    }
  }

  doc.end();
  return done;
}


function collectRuns(el: DocxElement): Run[] {
  const runs: Run[] = [];
  const walk = (n: DocxElement, b?: boolean, i?: boolean, s = false): void => {
    const bold = n.bold ?? b;
    const italic = n.italic ?? i;
    const script = !!n.script || s;
    if (n.text) runs.push({ text: n.text, bold, italic, script: script || undefined });
    for (const c of n.children ?? []) walk(c, bold, italic, script);
  };
  walk(el);
  if (runs.length === 0) runs.push({ text: '' });
  return runs;
}
