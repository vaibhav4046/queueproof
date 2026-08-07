/**
 * Minimal, dependency-free PDF 1.7 writer.
 *
 * This exists because the repository is offline and may not add npm dependencies, and because
 * a fixture generator that shells out to a PDF library would hide the one thing the fixture has
 * to prove: that the bytes on disk are a real document. Everything here is written by hand from
 * the PDF specification's object model — header, indirect objects, cross-reference table,
 * trailer — so every offset in the xref table is computed from the actual serialized length.
 *
 * Scope on purpose:
 *   - Content streams are stored uncompressed. Valid PDF, greppable bytes, no zlib framing bugs.
 *   - Only the standard 14 Type1 fonts are used, so no font program has to be embedded.
 *   - The page tree is flat. Legal per the spec and fine at a few hundred pages.
 *
 * Encoding rule: page text is drawn with WinAnsiEncoding, so drawable text must be ASCII.
 * Non-ASCII copy (the Devanagari commitment) travels as a PDF *text string* -- UTF-16BE with a
 * byte order mark, hex encoded -- which is where the specification actually allows it: document
 * information entries and annotation /Contents. Never as a content-stream show-text operand,
 * where a simple font would decode it byte by byte into garbage.
 */
import { Buffer } from "node:buffer";

export const PAGE_WIDTH = 612;
export const PAGE_HEIGHT = 792;

const MARGIN_LEFT = 72;
const CONTENT_TOP = 726;
const CONTENT_BOTTOM = 60;
const FOOTER_RULE_Y = 52;
const FOOTER_TEXT_Y = 40;
const HEADER_TEXT_Y = 754;
const HEADER_RULE_Y = 748;
const RULE_RIGHT = PAGE_WIDTH - MARGIN_LEFT;

/** font id -> resource name; leading is the vertical space a line consumes after it is drawn. */
export const STYLES = {
  title: { font: "F2", size: 26, leading: 36 },
  h1: { font: "F2", size: 17, leading: 27 },
  h2: { font: "F2", size: 13, leading: 21 },
  h3: { font: "F2", size: 11, leading: 18 },
  body: { font: "F1", size: 10, leading: 13.6 },
  mono: { font: "F3", size: 9, leading: 11.6 },
  small: { font: "F1", size: 8, leading: 11 },
  blank: { font: "F1", size: 10, leading: 8 },
};

/** Characters a PDF literal string must not carry unescaped. */
function escapeLiteral(text) {
  return text.replace(/[\\()]/g, (match) => `\\${match}`);
}

/**
 * Guard against silently emitting bytes a WinAnsi simple font cannot render. Callers get a loud
 * failure at generation time instead of a document full of replacement glyphs.
 */
function assertDrawable(text, where) {
  const bad = [...text].find((character) => character.codePointAt(0) < 0x20 || character.codePointAt(0) > 0x7e);
  if (bad !== undefined) {
    throw new Error(`non-ASCII character ${JSON.stringify(bad)} in drawable text (${where}): ${text.slice(0, 60)}`);
  }
}

/**
 * Encode a JavaScript string as a PDF hex text string in UTF-16BE with a leading byte order mark,
 * which is the encoding the specification defines for text strings outside content streams.
 */
export function utf16BeHexString(text) {
  const utf16le = Buffer.from(text, "utf16le");
  const utf16be = Buffer.from(utf16le); // copy before swapping, swap16 mutates in place
  utf16be.swap16();
  return `<FEFF${utf16be.toString("hex").toUpperCase()}>`;
}

/** PDF literal string, parentheses form, escaped. */
export function literalString(text) {
  assertDrawable(text, "literal string");
  return `(${escapeLiteral(text)})`;
}

export class PdfBuilder {
  #objects = [null]; // index 0 is the free head of the xref chain, never a real object

  allocate() {
    this.#objects.push(null);
    return this.#objects.length - 1;
  }

  define(id, body) {
    if (id < 1 || id >= this.#objects.length) throw new RangeError(`object ${id} was never allocated`);
    this.#objects[id] = Buffer.isBuffer(body) ? body : Buffer.from(body, "latin1");
  }

  defineStream(id, dictEntries, data) {
    const payload = Buffer.isBuffer(data) ? data : Buffer.from(data, "latin1");
    const head = Buffer.from(`<< ${dictEntries} /Length ${payload.length} >>\nstream\n`, "latin1");
    const tail = Buffer.from("\nendstream", "latin1");
    this.define(id, Buffer.concat([head, payload, tail]));
  }

  get objectCount() {
    return this.#objects.length - 1;
  }

  /** Serialize to bytes, computing every xref offset from real serialized lengths. */
  serialize({ rootId, infoId, fileId }) {
    // /ID is two hex strings. A missing or malformed value produced a trailer that node ignored
    // but that a real parser choked on, so it is a hard error rather than a silent default.
    if (typeof fileId !== "string" || !/^[0-9A-Fa-f]{32}$/.test(fileId)) {
      throw new Error(`file identifier must be 32 hex characters, received ${JSON.stringify(fileId)}`);
    }
    const chunks = [];
    let cursor = 0;
    const push = (value) => {
      const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value, "latin1");
      chunks.push(buffer);
      cursor += buffer.length;
    };

    push("%PDF-1.7\n");
    push(Buffer.from([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // binary marker comment

    const offsets = new Array(this.#objects.length).fill(0);
    for (let id = 1; id < this.#objects.length; id += 1) {
      const body = this.#objects[id];
      if (!body) throw new Error(`object ${id} was allocated but never defined`);
      offsets[id] = cursor;
      push(`${id} 0 obj\n`);
      push(body);
      push("\nendobj\n");
    }

    const xrefOffset = cursor;
    const size = this.#objects.length;
    push(`xref\n0 ${size}\n`);
    push("0000000000 65535 f \n"); // each entry is exactly 20 bytes
    for (let id = 1; id < size; id += 1) push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
    push(
      `trailer\n<< /Size ${size} /Root ${rootId} 0 R /Info ${infoId} 0 R /ID [<${fileId}> <${fileId}>] >>\n` +
        `startxref\n${xrefOffset}\n%%EOF\n`,
    );

    return Buffer.concat(chunks);
  }
}

/**
 * Turn one page's line list into a content stream.
 * Each line is drawn in its own text object with an absolute text matrix, which keeps a font or
 * size change on any line from disturbing the ones after it.
 */
function pageContentStream(page, pageNumber, totalPages, footerLabel) {
  const operators = [];
  operators.push("0.6 w");
  operators.push(`${MARGIN_LEFT} ${HEADER_RULE_Y} m ${RULE_RIGHT} ${HEADER_RULE_Y} l S`);
  operators.push(`${MARGIN_LEFT} ${FOOTER_RULE_Y} m ${RULE_RIGHT} ${FOOTER_RULE_Y} l S`);

  const header = `${footerLabel}  |  ${page.runningHead ?? "Operations Handbook"}`;
  operators.push(
    `BT /F1 8 Tf 1 0 0 1 ${MARGIN_LEFT} ${HEADER_TEXT_Y} Tm ${literalString(header.slice(0, 110))} Tj ET`,
  );
  operators.push(`BT /F1 8 Tf 1 0 0 1 ${MARGIN_LEFT} ${FOOTER_TEXT_Y} Tm ${literalString(footerLabel)} Tj ET`);
  operators.push(
    `BT /F1 8 Tf 1 0 0 1 450 ${FOOTER_TEXT_Y} Tm ${literalString(`Page ${pageNumber} of ${totalPages}`)} Tj ET`,
  );

  let y = CONTENT_TOP;
  for (const line of page.lines) {
    const style = STYLES[line.style ?? "body"];
    if (!style) throw new Error(`unknown style ${line.style} on page ${pageNumber}`);
    if (line.text) {
      assertDrawable(line.text, `page ${pageNumber}`);
      const x = MARGIN_LEFT + (line.indent ?? 0);
      operators.push(
        `BT /${style.font} ${style.size} Tf 1 0 0 1 ${x} ${y.toFixed(2)} Tm ${literalString(line.text)} Tj ET`,
      );
    }
    if (line.rule) {
      const ruleY = (y + style.size * 0.9).toFixed(2);
      operators.push(`${MARGIN_LEFT} ${ruleY} m ${RULE_RIGHT} ${ruleY} l S`);
    }
    y -= style.leading;
    // A silent overflow would push planted facts off the page and make the fixture lie.
    if (y < CONTENT_BOTTOM) {
      throw new Error(`page ${pageNumber} overflows the text frame (${page.lines.length} lines)`);
    }
  }

  return operators.join("\n");
}

/**
 * Assemble the whole document: fonts, page tree, per-page content, annotations, catalog, info.
 * Returns the serialized bytes plus the page count actually written into /Count.
 */
export function renderDocument({ pages, info, annotations = [] }) {
  const builder = new PdfBuilder();
  const catalogId = builder.allocate();
  const pagesId = builder.allocate();
  const helveticaId = builder.allocate();
  const helveticaBoldId = builder.allocate();
  const courierId = builder.allocate();
  const infoId = builder.allocate();

  builder.define(
    helveticaId,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  );
  builder.define(
    helveticaBoldId,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  );
  builder.define(courierId, "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>");

  // Annotations are the specification-sanctioned home for non-Latin text: /Contents is a text
  // string, so UTF-16BE with a BOM decodes correctly in any conforming reader or parser.
  const annotationIdsByPage = new Map();
  for (const annotation of annotations) {
    const id = builder.allocate();
    builder.define(
      id,
      `<< /Type /Annot /Subtype /Text /Name /Comment /F 4 /Rect [${annotation.rect.join(" ")}] ` +
        `/T ${literalString(annotation.title)} /Contents ${utf16BeHexString(annotation.contents)} >>`,
    );
    const bucket = annotationIdsByPage.get(annotation.page) ?? [];
    bucket.push(id);
    annotationIdsByPage.set(annotation.page, bucket);
  }

  const resources =
    `<< /Font << /F1 ${helveticaId} 0 R /F2 ${helveticaBoldId} 0 R /F3 ${courierId} 0 R >> ` +
    "/ProcSet [/PDF /Text] >>";

  const pageIds = [];
  pages.forEach((page, index) => {
    const pageNumber = index + 1;
    const pageId = builder.allocate();
    const contentId = builder.allocate();
    builder.defineStream(contentId, "", pageContentStream(page, pageNumber, pages.length, info.footerLabel));
    const annots = annotationIdsByPage.get(pageNumber);
    const annotsEntry = annots ? ` /Annots [${annots.map((id) => `${id} 0 R`).join(" ")}]` : "";
    builder.define(
      pageId,
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Resources ${resources} /Contents ${contentId} 0 R${annotsEntry} >>`,
    );
    pageIds.push(pageId);
  });

  // /Count sits immediately after /Type so a bounded reader can find it without walking /Kids.
  builder.define(
    pagesId,
    `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`,
  );
  builder.define(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  builder.define(
    infoId,
    `<< /Title ${literalString(info.title)} /Author ${literalString(info.author)} ` +
      `/Subject ${literalString(info.subject)} /Keywords ${utf16BeHexString(info.keywords)} ` +
      `/Producer ${literalString(info.producer)} /Creator ${literalString(info.producer)} ` +
      `/CreationDate (${info.date}) /ModDate (${info.date}) >>`,
  );

  const bytes = builder.serialize({ rootId: catalogId, infoId, fileId: info.fileId });
  return { bytes, pageCount: pages.length, objectCount: builder.objectCount };
}

/**
 * Re-read finished bytes the way a parser would: follow startxref, walk the cross-reference
 * table, confirm every offset lands on its own "N 0 obj" header, and read /Count back out of
 * the page tree. Used as the generator's own acceptance gate.
 */
export function inspectPdf(bytes) {
  const text = bytes.toString("latin1");
  const problems = [];

  if (!text.startsWith("%PDF-")) problems.push("file does not start with %PDF-");
  if (!text.trimEnd().endsWith("%%EOF")) problems.push("file does not end with %%EOF");

  const startxrefMatch = text.lastIndexOf("startxref");
  let declaredEntries = 0;
  let checkedOffsets = 0;
  if (startxrefMatch === -1) {
    problems.push("no startxref marker");
  } else {
    const startxrefValue = Number(text.slice(startxrefMatch + 9).trim().split(/\s+/)[0]);
    if (!Number.isInteger(startxrefValue) || text.slice(startxrefValue, startxrefValue + 4) !== "xref") {
      problems.push(`startxref ${startxrefValue} does not point at an xref table`);
    } else {
      const header = /^xref\s+(\d+)\s+(\d+)\s/.exec(text.slice(startxrefValue, startxrefValue + 64));
      if (!header) {
        problems.push("malformed xref subsection header");
      } else {
        declaredEntries = Number(header[2]);
        const tableStart = startxrefValue + header[0].length; // first byte of the 20-byte entry for object 0
        for (let id = 1; id < declaredEntries; id += 1) {
          const entry = text.slice(tableStart + id * 20, tableStart + id * 20 + 20);
          const offset = Number(entry.slice(0, 10));
          const expected = `${id} 0 obj`;
          if (text.slice(offset, offset + expected.length) !== expected) {
            problems.push(`xref entry ${id} points at offset ${offset}, which is not "${expected}"`);
            if (problems.length > 6) break;
          } else {
            checkedOffsets += 1;
          }
        }
      }
    }
  }

  const countMatch = /\/Type\s*\/Pages\s*\/Count\s+(\d+)/.exec(text);
  if (!countMatch) problems.push("no /Type /Pages ... /Count entry found");

  const idMatch = /\/ID\s*\[\s*<([^>]*)>\s*<([^>]*)>\s*\]/.exec(text);
  if (!idMatch) problems.push("trailer has no /ID array");
  else if (!/^[0-9A-Fa-f]{32}$/.test(idMatch[1])) problems.push(`trailer /ID is not hex: <${idMatch[1].slice(0, 24)}>`);

  return {
    ok: problems.length === 0,
    problems,
    declaredPageCount: countMatch ? Number(countMatch[1]) : null,
    xrefEntries: declaredEntries,
    verifiedOffsets: checkedOffsets,
  };
}

