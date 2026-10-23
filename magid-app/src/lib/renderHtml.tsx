import { createElement, Fragment } from 'react';
import type { ReactNode } from 'react';
import { parseMagidCss, VOID_TAGS, type HtmlNode } from '@magid/client-core';

// Renders the core's sanitized HTML tree (see magid-core/src/html.ts) as React elements — never via innerHTML.
// `renderText` renders each text node; `isLast` marks the last one, where a typewriter's reveal edge is.
export function renderHtml(nodes: HtmlNode[], renderText: (text: string, isLast: boolean) => ReactNode): ReactNode {
  let textNodesLeft = countTextNodes(nodes);
  const render = (list: HtmlNode[]): ReactNode[] =>
    list.map((node, i) => {
      if (node.type === 'text') {
        textNodesLeft--;
        return <Fragment key={i}>{renderText(node.text, textNodesLeft === 0)}</Fragment>;
      }
      const props: Record<string, unknown> = { key: i };
      for (const [name, value] of Object.entries(node.attributes)) {
        if (name === 'class') props.className = value;
        else if (name === 'style') props.style = parseMagidCss(value);
        else if (name === 'for') props.htmlFor = value;
        else props[name] = value;
      }
      return VOID_TAGS.includes(node.tag)
        ? createElement(node.tag, props)
        : createElement(node.tag, props, ...render(node.children));
    });
  return render(nodes);
}

function countTextNodes(nodes: HtmlNode[]): number {
  let n = 0;
  for (const node of nodes) n += node.type === 'text' ? 1 : countTextNodes(node.children);
  return n;
}
