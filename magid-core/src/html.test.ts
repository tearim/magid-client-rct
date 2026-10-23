import { describe, it, expect } from 'vitest';
import {
  decodeEntities, htmlTextLength, parseHtml, parseHtmlPolicy, prepareDisplayText, truncateHtml, type HtmlNode, type HtmlPolicy,
} from './html';

const policy: HtmlPolicy = { tags: ['b', 'i', 'img', 'p', 'span'], attributes: ['class', 'style', 'src'] };
const text = (t: string): HtmlNode => ({ type: 'text', text: t });
const el = (tag: string, children: HtmlNode[] = [], attributes: Record<string, string> = {}): HtmlNode =>
  ({ type: 'element', tag, attributes, children });

function parse(source: string, p: HtmlPolicy | null = policy) {
  const warnings: string[] = [];
  const nodes = parseHtml(source, p, (m) => warnings.push(m));
  return { nodes, warnings };
}

describe('parseHtmlPolicy', () => {
  it('is null when the server announced no allowed-tags', () => {
    expect(parseHtmlPolicy(undefined, 'class')).toBeNull();
  });

  it('splits, trims and lower-cases both lists', () => {
    expect(parseHtmlPolicy('b, I ,img', 'Class,style')).toEqual({ tags: ['b', 'i', 'img'], attributes: ['class', 'style'] });
  });

  it('treats an empty allowed-tags as a policy that allows no tags', () => {
    expect(parseHtmlPolicy('', undefined)).toEqual({ tags: [], attributes: [] });
  });
});

describe('parseHtml', () => {
  it('leaves the text untouched without a policy', () => {
    expect(parse('<b>x</b> &amp;', null).nodes).toEqual([text('<b>x</b> &amp;')]);
  });

  it('builds elements for allowed tags with allowed attributes', () => {
    const { nodes, warnings } = parse('Hi <b class="loud">you</b>!');
    expect(nodes).toEqual([text('Hi '), el('b', [text('you')], { class: 'loud' }), text('!')]);
    expect(warnings).toEqual([]);
  });

  it('nests elements and lower-cases tag and attribute names', () => {
    expect(parse("<P><I STYLE='color: red'>a<b>b</b></I></P>").nodes)
      .toEqual([el('p', [el('i', [text('a'), el('b', [text('b')])], { style: 'color: red' })])]);
  });

  it('removes a tag that is not allowed, keeps its content and warns', () => {
    const { nodes, warnings } = parse('a <u>b</u> c');
    expect(nodes).toEqual([text('a b c')]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('<u>');
  });

  it('removes an attribute that is not allowed from an allowed tag and warns', () => {
    const { nodes, warnings } = parse('<span id="x" class="y">z</span>');
    expect(nodes).toEqual([el('span', [text('z')], { class: 'y' })]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('"id"');
  });

  it('removes event handlers and script URLs even when the server lists them', () => {
    const p: HtmlPolicy = { tags: ['img'], attributes: ['src', 'onerror'] };
    const { nodes, warnings } = parse('<img src="javascript:alert(1)" onerror="alert(2)">', p);
    expect(nodes).toEqual([el('img')]);
    expect(warnings).toHaveLength(2);
  });

  it('keeps void and self-closing elements empty', () => {
    expect(parse('a<img src="magid.png">b<span/>c').nodes)
      .toEqual([text('a'), el('img', [], { src: 'magid.png' }), text('b'), el('span'), text('c')]);
  });

  it('keeps unquoted attributes and empty values', () => {
    expect(parse('<span class=big style="">x</span>').nodes).toEqual([el('span', [text('x')], { class: 'big', style: '' })]);
  });

  it('keeps anything that is not a well-formed tag as text', () => {
    expect(parse('a < b, 1<2, <3, <b').nodes).toEqual([text('a < b, 1<2, <3, <b')]);
    expect(parse('x <b class="y').nodes).toEqual([text('x <b class="y')]);
  });

  it('keeps a would-be tag with bare words that are not allowed attributes as prose, without warning', () => {
    const { nodes, warnings } = parse('a<b and c>d</b> e');
    expect(nodes).toEqual([text('a<b and c>d e')]);
    expect(warnings).toEqual([]);
    expect(parse('if x<u or y>z').nodes).toEqual([text('if x<u or y>z')]);
  });

  it('keeps an allowed bare attribute', () => {
    expect(parse('<span style>x</span>').nodes).toEqual([el('span', [text('x')], { style: '' })]);
  });

  it('removes attributes with a value even when a bare word makes another tag prose', () => {
    const { nodes, warnings } = parse('<b id="1">x</b> 1<b c>');
    expect(nodes).toEqual([el('b', [text('x')]), text(' 1<b c>')]);
    expect(warnings).toHaveLength(1);
  });

  it('closes elements left open and ignores stray end tags', () => {
    expect(parse('<b>a<i>b</b>c</i></p>d').nodes).toEqual([el('b', [text('a'), el('i', [text('b')])]), text('cd')]);
    expect(parse('<b>open').nodes).toEqual([el('b', [text('open')])]);
  });

  it('accepts spaces before the end of an end tag', () => {
    expect(parse('<b>x</b >y').nodes).toEqual([el('b', [text('x')]), text('y')]);
  });

  it('drops comments', () => {
    expect(parse('a<!-- <b>note</b> -->b').nodes).toEqual([text('ab')]);
  });

  it('decodes entities in text and attribute values', () => {
    expect(parse('&lt;b&gt; &amp; <span class="a&amp;b">&#65;&#x42;</span>').nodes)
      .toEqual([text('<b> & '), el('span', [text('AB')], { class: 'a&b' })]);
  });
});

describe('decodeEntities', () => {
  it('leaves unknown entities and bare ampersands alone', () => {
    expect(decodeEntities('&bogus; R&D &nbsp;')).toBe('&bogus; R&D  ');
  });
});

describe('truncateHtml', () => {
  const nodes = parse('ab<b>cd</b>ef').nodes;

  it('reveals visible characters only: a tag appears whole with its first character', () => {
    expect(truncateHtml(nodes, 2)).toEqual([text('ab')]);
    expect(truncateHtml(nodes, 3)).toEqual([text('ab'), el('b', [text('c')])]);
    expect(truncateHtml(nodes, 5)).toEqual([text('ab'), el('b', [text('cd')]), text('e')]);
  });

  it('shows nothing at zero and everything once the whole text is revealed', () => {
    expect(truncateHtml(nodes, 0)).toEqual([]);
    expect(truncateHtml(nodes, htmlTextLength(nodes))).toBe(nodes);
  });

  it('shows a void element once the character after it is due', () => {
    const withImg = parse('a<img src="x">b').nodes;
    expect(truncateHtml(withImg, 1)).toEqual([text('a')]);
    expect(truncateHtml(withImg, 2)).toEqual(withImg);
  });
});

describe('prepareDisplayText', () => {
  it('gives the typewriter the visible text with markers, and the nodes without them', () => {
    const { nodes, timeline } = prepareDisplayText('DCSTP_100@Hello <b>DCSTP_200@world</b>', policy);
    expect(timeline).toBe('DCSTP_100@Hello DCSTP_200@world');
    expect(nodes).toEqual([text('Hello '), el('b', [text('world')])]);
  });

  it('passes plain text through without a policy', () => {
    expect(prepareDisplayText('a <b>', null)).toEqual({ nodes: [text('a <b>')], timeline: 'a <b>' });
  });
});
