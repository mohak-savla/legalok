import { Document, Paragraph, HeadingLevel, TextRun, AlignmentType, LineRuleType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun,
  type IParagraphOptions, type ITableCellOptions, type IRunOptions,
  type INumberingOptions } from 'docx';
import { parse as parseHtml, type HTMLElement as HElement } from 'node-html-parser';

const BORDER = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const CELL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

export interface DocxElement {
  type: 'heading' | 'paragraph' | 'list-item' | 'table' | 'image' | 'pagebreak' | 'empty';
  level?: number;
  text?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  align?: 'left' | 'center' | 'right' | 'justify';
  listType?: 'bullet' | 'numbered';
  tableData?: string[][];
  imageSrc?: string;
  children?: DocxElement[];
  /** .sig-typed — render like the website (Segoe Script, large). */
  script?: boolean;
  /** .sig-label — render like the website (small, gray, uppercase look). */
  label?: boolean;
  /** Points of extra space before this block (.sig-block / .sig-execution margin). */
  before?: number;
}

/** Parse resolved HTML into structured DOCX elements (node-html-parser tree walk) */
export function parseHtmlToElements(html: string): DocxElement[] {
  try {
    const root = parseHtml(html || '', { blockTextElements: { script: false, style: false, pre: true } });
    if (!root) return fallbackParse(html);
    const out = walkNode(root);
    return out.length > 0 ? out : fallbackParse(html);
  } catch {
    return fallbackParse(html);
  }
}

/** Fallback: strip tags and return plain text paragraphs */
function fallbackParse(html: string): DocxElement[] {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? [{ type: 'paragraph', text }] : [];
}

function tagOf(node: HElement): string {
  return String(node.rawTagName ?? node.tagName ?? '').toLowerCase();
}

function textOf(n: unknown): string {
  const t = n as { text?: string; textContent?: string };
  return String(t?.text ?? t?.textContent ?? '').trim();
}

function walkNode(node: HElement): DocxElement[] {
  const elements: DocxElement[] = [];
  for (const child of node.childNodes ?? []) {
    if (child.nodeType === 3) {
      const text = textOf(child);
      if (text) elements.push({ type: 'paragraph', text });
    } else if (child.nodeType === 1) {
      elements.push(...elementFromNode(child as HElement));
    }
  }
  return elements;
}

const BLOCK_TAGS = new Set(['p', 'div', 'ol', 'ul', 'table', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'hr']);

function elementFromNode(node: HElement): DocxElement[] {
  const tag = tagOf(node);
  const style = node.getAttribute?.('style') || '';
  const align = style.match(/text-align:\s*(left|center|right|justify)/)?.[1] as DocxElement['align'];

  if (tag === 'br') return [{ type: 'empty' }];
  if (tag === 'hr') return [{ type: 'empty' }];
  if (tag === 'img') {
    const src = node.getAttribute?.('src') || '';
    return src ? [{ type: 'image', imageSrc: src }] : [];
  }

  if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
    return [{ type: 'heading', level: parseInt(tag[1]), align, children: trimInlineBounds(collectInline(node)) }];
  }

  if (tag === 'table') {
    const rows: string[][] = [];
    for (const tr of node.getElementsByTagName('tr')) {
      const cells: string[] = [];
      for (const td of [...tr.getElementsByTagName('th'), ...tr.getElementsByTagName('td')]) {
        cells.push((td.textContent ?? '').trim());
      }
      rows.push(cells);
    }
    return rows.length > 0 ? [{ type: 'table', tableData: rows }] : [];
  }

  if (tag === 'ul' || tag === 'ol') {
    return node.getElementsByTagName('li').map((li) => ({
      type: 'list-item' as const,
      listType: tag === 'ul' ? ('bullet' as const) : ('numbered' as const),
      children: trimInlineBounds(collectInline(li)),
    }));
  }

  if (tag === 'p' || tag === 'div' || tag === 'blockquote') {
    // Split content around embedded <img> so signatures/images stay visible
    const out: DocxElement[] = [];
    let inline: DocxElement[] = [];
    // Class-based styling hints so exporters keep the website look:
    //   .sig-typed -> script font · .sig-label -> small gray · .sig-block -> top gap
    const cls = String(node.getAttribute?.('class') || '');
    const isScript = /\bsig-typed\b/.test(cls);
    const isLabel = /\bsig-label\b/.test(cls);
    const isBlockGap = /\bsig-block\b/.test(cls);
    const stamp = (els: DocxElement[]): void => {
      for (const e of els) {
        if (isScript) e.script = true;
        if (isLabel) e.label = true;
        if (e.children) stamp(e.children);
      }
    };
    const flush = (): void => {
      const trimmed = trimInlineBounds(inline);
      if (trimmed.length > 0) { out.push({ type: 'paragraph', align, children: trimmed }); inline = []; }
    };
    for (const child of node.childNodes ?? []) {
      if (child.nodeType === 3) {
        const text = String((child as { text?: string; textContent?: string }).text ?? (child as { textContent?: string }).textContent ?? '').replace(/\s+/g, ' ');
        if (text) inline.push({ type: 'paragraph', text });
      } else if (child.nodeType === 1) {
        const c = child as HElement;
        const cTag = tagOf(c);
        if (cTag === 'img') {
          flush();
          const src = c.getAttribute?.('src') || '';
          if (src) out.push({ type: 'image', imageSrc: src });
        } else if (cTag === 'br') {
          flush();
          out.push({ type: 'empty' });
        } else if (BLOCK_TAGS.has(cTag)) {
          // Nested block-level element (sig-label div, <p> in sig-block, lists…)
          // must stay a separate block — never flatten into inline text.
          flush();
          out.push(...elementFromNode(c));
        } else {
          inline.push(...collectInline(c));
        }
      }
    }
    flush();
    if (isBlockGap && out.length > 0 && out[0].before == null) out[0].before = 30; // ≈ CSS .sig-block margin-top
    if (out.length > 0) {
      stamp(out);
      return out;
    }
    if (tag === 'p') return [{ type: 'empty' }];
    return walkNode(node);
  }

  return walkNode(node);
}

function collectInline(node: HElement): DocxElement[] {
  const out: DocxElement[] = [];
  const walk = (n: unknown, fmt: Partial<DocxElement> = {}): void => {
    if (!n) return;
    const anyN = n as { nodeType?: number; text?: string; textContent?: string; childNodes?: unknown[] };
    if (anyN.nodeType === 3) {
      // Preserve inter-run whitespace: collapse runs of spaces to one, keep edges.
      const text = String(anyN.text ?? anyN.textContent ?? '').replace(/\s+/g, ' ');
      if (text) out.push({ type: 'paragraph', text, ...fmt });
      return;
    }
    if (anyN.nodeType !== 1) return;
    const el = n as HElement;
    const tag = tagOf(el);
    const next = { ...fmt };
    if (tag === 'b' || tag === 'strong') next.bold = true;
    if (tag === 'i' || tag === 'em') next.italic = true;
    if (tag === 'u') next.underline = true;
    if (tag === 's' || tag === 'strike' || tag === 'del') next.strikethrough = true;
    if (tag === 'br') { out.push({ type: 'empty' }); return; }
    for (const c of el.childNodes ?? []) walk(c, next);
  };
  walk(node);
  return out; // callers apply trimInlineBounds at block boundaries
}

/** Trim block-edge whitespace while keeping single spaces between inline runs */
function trimInlineBounds(els: DocxElement[]): DocxElement[] {
  const out = [...els];
  const firstText = out.find((e) => typeof e.text === 'string');
  if (firstText?.text) firstText.text = firstText.text.replace(/^\s+/, '');
  const lastText = [...out].reverse().find((e) => typeof e.text === 'string');
  if (lastText?.text) lastText.text = lastText.text.replace(/\s+$/, '');
  while (out.length > 0 && out[0].text !== undefined && out[0].text === '') out.shift();
  while (out.length > 0 && out[out.length - 1].text !== undefined && out[out.length - 1].text === '') out.pop();
  return out;
}

/** Read intrinsic PNG/JPEG dimensions for DOCX embedding */
export function imageSize(buf: Buffer): { w: number; h: number } | null {
  try {
    if (buf.length > 24 && buf.subarray(12, 16).toString('latin1') === 'IHDR') {
      return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    }
    if (buf.length > 4 && buf[0] === 0xFF && buf[1] === 0xD8) {
      let off = 2;
      while (off + 9 < buf.length) {
        if (buf[off] !== 0xFF) { off++; continue; }
        const marker = buf[off + 1];
        if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
          return { h: buf.readUInt16BE(off + 5), w: buf.readUInt16BE(off + 7) };
        }
        off += 2 + buf.readUInt16BE(off + 2);
      }
    }
  } catch { /* fall through */ }
  return null;
}

function dataUrlBuffer(src: string): { buf: Buffer; kind: 'png' | 'jpg' } | null {
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/.exec(src || '');
  if (!m) return null;
  return { buf: Buffer.from(m[2], 'base64'), kind: m[1] === 'png' ? 'png' : 'jpg' };
}

import { inflateSync } from 'zlib';

/**
 * Synchronously validate an embedded image so corrupt payloads can never crash
 * async decoders (pdfkit's png-js inflates IDAT lazily — errors escape try/catch).
 * PNG: verify signature + IHDR sanity + IDAT inflates cleanly.
 * JPEG: verify SOFn marker parses (dimension scan).
 */
export function validateImageForEmbed(src: string): { buf: Buffer; kind: 'png' | 'jpg' } | null {
  const img = dataUrlBuffer(src);
  if (!img || img.buf.length < 8) return null;
  try {
    if (img.kind === 'png') {
      const b = img.buf;
      if (!b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return null;
      if (b.subarray(12, 16).toString('latin1') !== 'IHDR') return null;
      const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
      const bitDepth = b[24], colorType = b[25];
      if (w === 0 || h === 0 || w > 20000 || h > 20000) return null;
      if (![0, 2, 3, 4, 6].includes(colorType) || ![1, 2, 4, 8, 16].includes(bitDepth)) return null;
      const idat: Buffer[] = [];
      let off = 8;
      while (off + 8 <= b.length) {
        const len = b.readUInt32BE(off);
        const type = b.subarray(off + 4, off + 8).toString('latin1');
        if (type === 'IDAT') idat.push(b.subarray(off + 8, off + 8 + len));
        if (type === 'IEND') break;
        off += 12 + len;
      }
      if (idat.length === 0) return null;
      const raw = inflateSync(Buffer.concat(idat));
      if (raw.length === 0) return null;
      return img;
    }
    // JPEG — SOF parse already validates structure
    return imageSize(img.buf) ? img : null;
  } catch {
    return null;
  }
}

function runsFromElement(el: DocxElement): TextRun[] {
  const runs: TextRun[] = [];
  const collect = (n: DocxElement, script = false, label = false): void => {
    const s = script || !!n.script;
    const l = label || !!n.label;
    if (n.text) {
      // Keep the website look in Word: script font for .sig-typed, small gray
      // for .sig-label, and Segoe UI for the rupee glyph Georgia lacks.
      const opts: IRunOptions = {
        text: n.text,
        bold: n.bold,
        italics: n.italic,
        strike: n.strikethrough,
        ...(s ? { font: 'Segoe Script' as const, size: 48 as const } : {}), // 24pt script signature
        ...((!s && l) ? { size: 16 as const, color: '6B7280' as const } : {}), // ≈8pt gray label
        ...(n.text.includes('₹') ? { font: 'Segoe UI' as const } : {}),
      };
      runs.push(new TextRun(opts));
    }
    if (n.children) n.children.forEach((c) => collect(c, s, l));
  };
  collect(el);
  return runs.length > 0 ? runs : [new TextRun('')];
}

function elementToParagraph(el: DocxElement): Paragraph {
  // .doc-page p is justified (text-align: justify) — only override when the
  // element carries an explicit alignment style.
  const align = el.align === 'center' ? AlignmentType.CENTER
    : el.align === 'right' ? AlignmentType.RIGHT
    : el.align === 'left' ? AlignmentType.LEFT
    : AlignmentType.JUSTIFIED;
  const opts: IParagraphOptions = {
    alignment: align,
    children: runsFromElement(el),
    // Always set 1.7× line height + 6pt after to match PDF (line=408 = 1.7×11pt×20).
    // AT_LEAST lets Word expand for descenders; EXACT can clip them.
    spacing: {
      line: 408,
      lineRule: LineRuleType.AT_LEAST,
      after: 120,
      ...(el.before ? { before: el.before * 20 } : {}),
    },
  };
  return new Paragraph(opts);
}

/** Convert resolved HTML to a real .docx file buffer */
export async function generateDocx(html: string): Promise<Buffer> {
  const elements = parseHtmlToElements(html);
  const children: (Paragraph | Table)[] = [];
  let i = 0;

  while (i < elements.length) {
    const el = elements[i];

    if (el.type === 'pagebreak' || el.type === 'empty') {
      children.push(new Paragraph({ children: [new TextRun('')], pageBreakBefore: el.type === 'pagebreak' }));
      i++;
      continue;
    }

    if (el.type === 'image' && el.imageSrc) {
      const img = validateImageForEmbed(el.imageSrc);
      if (img) {
        const size = imageSize(img.buf);
        const MAXW = 200, MAXH = 140;
        let w = size?.w ?? MAXW, h = size?.h ?? MAXH;
        const scale = Math.min(MAXW / w, MAXH / h, 1);
        w = Math.max(1, Math.round(w * scale)); h = Math.max(1, Math.round(h * scale));
        children.push(new Paragraph({
          children: [new ImageRun({ data: img.buf, transformation: { width: w, height: h } })],
        }));
      }
      i++;
      continue;
    }

    if (el.type === 'heading') {
      const level = el.level === 1 ? HeadingLevel.HEADING_1
        : el.level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
      // doc.css centers h1 and left-aligns h2/h3 unless an explicit style says otherwise.
      const align = el.align === 'center' ? AlignmentType.CENTER
        : el.align === 'right' ? AlignmentType.RIGHT
        : el.align === 'left' ? AlignmentType.LEFT
        : (el.level === 1 ? AlignmentType.CENTER : AlignmentType.LEFT);
      children.push(new Paragraph({ heading: level, alignment: align, children: runsFromElement(el) }));
      i++;
      continue;
    }

    if (el.type === 'table' && el.tableData) {
      const rows = el.tableData.map((row) => new TableRow({
        children: row.map((cell) => new TableCell({
          borders: CELL_BORDERS,
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph(cell)],
        })),
      }));
      children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
      i++;
      continue;
    }

    if (el.type === 'list-item') {
      const listItems: DocxElement[] = [];
      while (i < elements.length && elements[i].type === 'list-item') {
        listItems.push(elements[i]);
        i++;
      }
      const isBullet = listItems[0]?.listType === 'bullet';
      for (const item of listItems) {
        children.push(new Paragraph({
          children: runsFromElement(item),
          alignment: AlignmentType.LEFT, // li inherits body default (left), not justified
          bullet: isBullet ? { level: 0 } : undefined,
          numbering: !isBullet ? { reference: 'numbered', level: 0 } : undefined,
        }));
      }
      continue;
    }

    children.push(elementToParagraph(el));
    i++;
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Georgia', size: 22, color: '111827' },
          paragraph: { alignment: AlignmentType.JUSTIFIED, spacing: { line: 408, lineRule: LineRuleType.EXACT, after: 120 } },
        },
        heading1: {
          run: { font: 'Georgia', size: 34, bold: true, color: '111827' }, // 17pt = PDF h1
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0, after: 400, line: 578, lineRule: LineRuleType.EXACT } },
        },
        heading2: {
          run: { font: 'Georgia', size: 26, bold: true, color: '111827' }, // 13pt = PDF h2
          paragraph: { alignment: AlignmentType.LEFT, spacing: { before: 280, after: 160, line: 442, lineRule: LineRuleType.EXACT } },
        },
        heading3: {
          run: { font: 'Georgia', size: 23, bold: true, color: '111827' }, // 11.5pt = PDF h3
          paragraph: { alignment: AlignmentType.LEFT, spacing: { before: 240, after: 120, line: 391, lineRule: LineRuleType.EXACT } },
        },
      },
    },
    numbering: {
      config: [
        { reference: 'numbered', levels: [
          { level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        ]},
      ],
    },
    sections: [{
      properties: {
        page: {
          // A4 + 56pt margins — identical geometry to the server-rendered PDF.
          size: { width: 11906, height: 16838 },
          margin: { top: 1120, bottom: 1120, left: 1120, right: 1120 },
        },
      },
      children,
    }],
  });
  const { Packer } = require('docx');
  return Packer.toBuffer(doc);
}
