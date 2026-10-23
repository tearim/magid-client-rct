import { hasTimeLineStops, resolveCleanText } from './textTimeline';

// Trusted HTML in display text (narration, menu description), limited to what the server allows (config vars
// `allowed-tags` and `allowed-tag-attributes`, comma-separated). The text is parsed once into a tree; renderers build
// real elements from it (never innerHTML), and a typewriter reveals it by *visible* characters (`truncateHtml`), so a
// tag appears whole as soon as its first character is due — `<b` never flashes on screen.
//
// - No policy (the server announced no `allowed-tags`): plain text, nothing is parsed — as before HTML support.
// - Not a tag, but prose: anything that isn't well-formed (`a < b`, `a<b!`, an unterminated `<b` at the end), and a
//   would-be tag with a bare word that isn't an allowed attribute (`a<b and c>d`: `and`, `c` have no `=value`).
//   Rendered as text, no warning.
// - A tag not in `allowed-tags` is removed and its content kept (console warning).
// - An attribute with a value (`id="x"`) not in `allowed-tag-attributes` is removed from the tag (console warning).
//   `on*` handlers and `javascript:`/`vbscript:` URLs are removed even if listed.
// - To show a literal tag that would otherwise parse, authors write `&lt;` (in the XML: `&amp;lt;`).
// - Some allowed tags are transformed (TAG_PROCESSORS): `<title>` → `<span class="title">` (console log); an `<img>`
//   from the Magid server gets the file-request-token.

export interface HtmlPolicy {
  tags: string[];
  attributes: string[];
}

export type HtmlNode =
  | { type: 'text'; text: string }
  | { type: 'element'; tag: string; attributes: Record<string, string>; children: HtmlNode[] };

export const VOID_TAGS = ['area', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'];

const SCRIPT_URL = /^\s*(javascript|vbscript):/i;

// Where parsing reports what it changed: removals are warnings, transformations are notes.
export interface HtmlReport {
  warn(message: string): void;
  log(message: string): void;
}

const consoleReport: HtmlReport = { warn: (m) => console.warn(m), log: (m) => console.log(m) };

export interface HtmlOptions {
  report?: HtmlReport;
  // The server's address and the session's token: files from the server (`magid:///…`, already resolved to baseUrl)
  // need `file-request-token`, since an <img> can't send the Bearer header.
  baseUrl?: string;
  fileRequestToken?: string | null;
}

// `url` with the file-request-token if it points at the Magid server; anything else (external images) is unchanged,
// so the token never goes to a third party.
export function withFileRequestToken(url: string, baseUrl: string | undefined, token: string | null | undefined): string {
  if (!baseUrl || !token) return url;
  const base = baseUrl.replace(/\/+$/, '');
  if (url !== base && !url.startsWith(`${base}/`) && !url.startsWith(`${base}?`)) return url;
  try {
    const u = new URL(url);
    u.searchParams.set('file-request-token', token);
    return u.toString();
  } catch {
    return url;
  }
}

function splitList(csv: string | undefined): string[] {
  return (csv ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
}

// Null unless the server sent `allowed-tags` (an empty value is a policy too: every tag gets removed).
export function parseHtmlPolicy(tags: string | undefined, attributes: string | undefined): HtmlPolicy | null {
  if (tags === undefined) return null;
  return { tags: splitList(tags), attributes: splitList(attributes) };
}

// ---- tokenizer (state machine) -----------------------------------------------------------------------------------

type Token =
  | { kind: 'text'; text: string }
  // value null: a bare attribute (`<b and>`); raw: the tag's source text, for when it turns out to be prose.
  | { kind: 'start'; tag: string; attributes: [string, string | null][]; selfClosing: boolean; raw: string }
  | { kind: 'end'; tag: string };

const S = {
  Text: 0,
  TagOpen: 1,         // after '<'
  TagName: 2,
  EndTagOpen: 3,      // after '</'
  EndTagName: 4,
  BeforeAttrName: 5,
  AttrName: 6,
  AfterAttrName: 7,
  BeforeAttrValue: 8,
  AttrValueDouble: 9,
  AttrValueSingle: 10,
  AttrValueUnquoted: 11,
  SelfClosing: 12,     // after '/' inside a start tag
  Comment: 13,         // after '<!--'
  AfterEndTagName: 14, // '</b ' (only spaces may follow)
} as const;
type State = (typeof S)[keyof typeof S];

const isLetter = (c: string) => /[A-Za-z]/.test(c);
const isSpace = (c: string) => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f';
const isNameChar = (c: string) => /[A-Za-z0-9-]/.test(c);

// Anything that doesn't turn out to be a well-formed tag (`a < b`, `<3`, an unterminated `<b` at the end) stays text.
export function tokenizeHtml(source: string): Token[] {
  const tokens: Token[] = [];
  let text = '';
  let state: State = S.Text;
  let tagStart = 0;
  let tag = '';
  let attrName = '';
  let attrValue = '';
  let attrHasValue = false;
  let attributes: [string, string | null][] = [];

  const flushText = () => {
    if (text) tokens.push({ kind: 'text', text });
    text = '';
  };
  const pushAttr = () => {
    if (attrName) attributes.push([attrName.toLowerCase(), attrHasValue ? attrValue : null]);
    attrName = '';
    attrValue = '';
    attrHasValue = false;
  };
  const emitStart = (selfClosing: boolean) => {
    pushAttr();
    flushText();
    tokens.push({ kind: 'start', tag: tag.toLowerCase(), attributes, selfClosing, raw: source.slice(tagStart, i + 1) });
    state = S.Text;
  };

  let i = 0;
  while (i < source.length) {
    const c = source[i];
    switch (state) {
      case S.Text:
        if (c === '<') {
          tagStart = i;
          state = S.TagOpen;
        } else {
          text += c;
        }
        break;
      case S.TagOpen:
        if (isLetter(c)) {
          tag = c;
          attributes = [];
          state = S.TagName;
        } else if (c === '/') {
          state = S.EndTagOpen;
        } else if (source.startsWith('!--', i)) {
          i += 2;
          state = S.Comment;
        } else {
          text += '<';
          state = S.Text;
          continue; // re-read c as text
        }
        break;
      case S.TagName:
        if (isNameChar(c)) tag += c;
        else if (isSpace(c)) state = S.BeforeAttrName;
        else if (c === '/') state = S.SelfClosing;
        else if (c === '>') emitStart(false);
        else { i = tagStart; text += '<'; state = S.Text; }
        break;
      case S.EndTagOpen:
        if (isLetter(c)) { tag = c; state = S.EndTagName; }
        else { i = tagStart; text += '<'; state = S.Text; }
        break;
      case S.EndTagName:
        if (isNameChar(c)) tag += c;
        else if (c === '>') {
          flushText();
          tokens.push({ kind: 'end', tag: tag.toLowerCase() });
          state = S.Text;
        } else if (isSpace(c)) state = S.AfterEndTagName;
        else { i = tagStart; text += '<'; state = S.Text; }
        break;
      case S.AfterEndTagName:
        if (c === '>') {
          flushText();
          tokens.push({ kind: 'end', tag: tag.toLowerCase() });
          state = S.Text;
        } else if (!isSpace(c)) { i = tagStart; text += '<'; state = S.Text; }
        break;
      case S.BeforeAttrName:
        if (isSpace(c)) break;
        if (c === '/') state = S.SelfClosing;
        else if (c === '>') emitStart(false);
        else if (c === '"' || c === "'" || c === '<' || c === '=') { i = tagStart; text += '<'; state = S.Text; }
        else { attrName = c; state = S.AttrName; }
        break;
      case S.AttrName:
        if (isSpace(c)) state = S.AfterAttrName;
        else if (c === '=') { attrHasValue = true; state = S.BeforeAttrValue; }
        else if (c === '/') { pushAttr(); state = S.SelfClosing; }
        else if (c === '>') emitStart(false);
        else attrName += c;
        break;
      case S.AfterAttrName:
        if (isSpace(c)) break;
        if (c === '=') { attrHasValue = true; state = S.BeforeAttrValue; }
        else if (c === '>') emitStart(false);
        else if (c === '/') { pushAttr(); state = S.SelfClosing; }
        else { pushAttr(); attrName = c; state = S.AttrName; }
        break;
      case S.BeforeAttrValue:
        if (isSpace(c)) break;
        if (c === '"') state = S.AttrValueDouble;
        else if (c === "'") state = S.AttrValueSingle;
        else if (c === '>') emitStart(false);
        else { attrValue = c; state = S.AttrValueUnquoted; }
        break;
      case S.AttrValueDouble:
        if (c === '"') { pushAttr(); state = S.BeforeAttrName; } else attrValue += c;
        break;
      case S.AttrValueSingle:
        if (c === "'") { pushAttr(); state = S.BeforeAttrName; } else attrValue += c;
        break;
      case S.AttrValueUnquoted:
        if (isSpace(c)) { pushAttr(); state = S.BeforeAttrName; }
        else if (c === '>') emitStart(false);
        else attrValue += c;
        break;
      case S.SelfClosing:
        if (c === '>') emitStart(true);
        else if (isSpace(c)) state = S.BeforeAttrName;
        else { i = tagStart; text += '<'; state = S.Text; }
        break;
      case S.Comment:
        if (source.startsWith('-->', i)) { i += 2; state = S.Text; }
        break;
    }
    i++;
  }
  // Unterminated tag at the end: it was text after all. (An unterminated comment is dropped.)
  if (state !== S.Text && state !== S.Comment) text += source.slice(tagStart);
  flushText();
  return tokens;
}

// ---- entities ----------------------------------------------------------------------------------------------------

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

// ---- tree --------------------------------------------------------------------------------------------------------

type ElementNode = Extract<HtmlNode, { type: 'element' }>;

// Allowed tags that can't be rendered as they are, rewritten after their attributes were filtered. The one place that
// knows about such tags: add new ones here.
export const TAG_PROCESSORS: Record<string, (el: ElementNode, report: HtmlReport, options: HtmlOptions) => ElementNode> = {
  // A <title> in the body is invisible (and React 19 hoists it into <head>, retitling the page).
  title: (el, report) => {
    report.log('[magid] <title> in display text is rendered as <span class="title">');
    const className = ['title', el.attributes.class].filter(Boolean).join(' ');
    return { ...el, tag: 'span', attributes: { ...el.attributes, class: className } };
  },
  img: (el, _report, { baseUrl, fileRequestToken }) => {
    const src = el.attributes.src;
    if (!src) return el;
    return { ...el, attributes: { ...el.attributes, src: withFileRequestToken(src, baseUrl, fileRequestToken) } };
  },
};

export function parseHtml(
  source: string,
  policy: HtmlPolicy | null,
  options: HtmlOptions = {},
): HtmlNode[] {
  const report = options.report ?? consoleReport;
  if (!policy) return source ? [{ type: 'text', text: source }] : [];

  const root: HtmlNode[] = [];
  // Open elements with the tag their end tag will name (a processor may have renamed the element).
  const stack: { el: ElementNode; tag: string }[] = [];
  const children = () => (stack.length ? stack[stack.length - 1].el.children : root);
  const appendText = (text: string) => {
    const list = children();
    const last = list[list.length - 1];
    if (last?.type === 'text') last.text += text;
    else list.push({ type: 'text', text });
  };

  for (const token of tokenizeHtml(source)) {
    if (token.kind === 'text') {
      appendText(decodeEntities(token.text));
    } else if (token.kind === 'start') {
      if (token.attributes.some(([name, value]) => value === null && !policy.attributes.includes(name))) {
        appendText(decodeEntities(token.raw)); // prose that looks like a tag: `a<b and c>d`
        continue;
      }
      if (!policy.tags.includes(token.tag)) {
        report.warn(`[magid] <${token.tag}> is not in allowed-tags; the tag was removed, its content kept`);
        continue;
      }
      const attributes: Record<string, string> = {};
      for (const [name, rawValue] of token.attributes) {
        const value = decodeEntities(rawValue ?? '');
        if (!policy.attributes.includes(name)) {
          report.warn(`[magid] attribute "${name}" on <${token.tag}> is not in allowed-tag-attributes; removed`);
        } else if (name.startsWith('on') || SCRIPT_URL.test(value)) {
          report.warn(`[magid] attribute "${name}" on <${token.tag}> would run script; removed`);
        } else {
          attributes[name] = value;
        }
      }
      let el: ElementNode = { type: 'element', tag: token.tag, attributes, children: [] };
      const processor = TAG_PROCESSORS[token.tag];
      if (processor) el = processor(el, report, options);
      children().push(el);
      if (!token.selfClosing && !VOID_TAGS.includes(token.tag)) stack.push({ el, tag: token.tag });
    } else {
      // Close the innermost open element of that name (and anything left open inside it); stray end tags are ignored.
      const at = stack.map((open) => open.tag).lastIndexOf(token.tag);
      if (at !== -1) stack.length = at;
    }
  }
  return root;
}

export function htmlTextLength(nodes: HtmlNode[]): number {
  let n = 0;
  for (const node of nodes) n += node.type === 'text' ? node.text.length : htmlTextLength(node.children);
  return n;
}

export function htmlToText(nodes: HtmlNode[]): string {
  return nodes.map((node) => (node.type === 'text' ? node.text : htmlToText(node.children))).join('');
}

// The first `visibleChars` characters of text, with every element they're in. An element (also an empty or void one,
// like <img>) appears once everything before it has been revealed and the next character is due, or once the
// whole text is revealed.
export function truncateHtml(nodes: HtmlNode[], visibleChars: number): HtmlNode[] {
  if (visibleChars >= htmlTextLength(nodes)) return nodes;
  let remaining = visibleChars;
  const cut = (list: HtmlNode[]): HtmlNode[] => {
    const out: HtmlNode[] = [];
    for (const node of list) {
      if (remaining <= 0) break;
      if (node.type === 'text') {
        out.push(node.text.length <= remaining ? node : { type: 'text', text: node.text.slice(0, remaining) });
        remaining -= node.text.length;
      } else {
        out.push({ ...node, children: cut(node.children) });
      }
    }
    return out;
  };
  return cut(nodes);
}

// Display text → what the typewriter animates and what gets rendered. `timeline` is the visible text with its
// DCSTP_ markers (feed it to the typewriter); `nodes` hold the same text without markers.
export function prepareDisplayText(
  raw: string,
  policy: HtmlPolicy | null,
  options?: HtmlOptions,
): { nodes: HtmlNode[]; timeline: string } {
  const parsed = parseHtml(raw, policy, options);
  const timeline = htmlToText(parsed);
  if (!hasTimeLineStops(timeline)) return { nodes: parsed, timeline };
  const clean = (list: HtmlNode[]): HtmlNode[] =>
    list.map((node) =>
      node.type === 'text'
        ? { type: 'text', text: hasTimeLineStops(node.text) ? resolveCleanText(node.text) : node.text }
        : { ...node, children: clean(node.children) });
  return { nodes: clean(parsed), timeline };
}
