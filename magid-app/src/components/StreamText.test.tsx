import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { streamPlaceholder, type MenuResponse, type NarrationResponse } from '@magiden/client-core';
import { NarrationText } from './NarrationText';
import { MenuScene } from './MenuScene';
import { magidTestInstance, withMagid } from '../test/magidTestInstance';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ID = 'str-1';
const narration = (text: string) => ({ narration: text }) as NarrationResponse;

describe('streamed texts', () => {
  let container: HTMLDivElement;
  let root: Root;
  let magid: ReturnType<typeof magidTestInstance>;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    magid = magidTestInstance();
  });

  afterEach(() => {
    act(() => root.unmount());
    magid.dispose();
    container.remove();
    vi.useRealTimers();
  });

  const delta = (no: number, text: string) =>
    act(() => magid.client.applyStreamMessage({ 'stream-id': ID, no, delta: text }));
  const done = (value: string, status: string) =>
    act(() => magid.client.applyStreamMessage({ 'stream-id': ID, done: true, status, value }));
  const streamSpan = () => container.querySelector('.magid-stream');

  it('shows nothing in place of a stream nothing has arrived of', () => {
    act(() => root.render(withMagid(magid, <NarrationText data={narration(`He says: ${streamPlaceholder(ID)}`)} />)));
    expect(container.textContent).toBe('He says: ');
  });

  it('shows a stream text in a narration', () => {
    act(() => root.render(withMagid(magid, <NarrationText data={narration(`He says: ${streamPlaceholder(ID)}`)} />)));
    delta(1, 'Good evening');
    expect(container.textContent).toBe('He says: Good evening');
  });

  it('keeps a stream text current', () => {
    act(() => root.render(withMagid(magid, <NarrationText data={narration(`He says: ${streamPlaceholder(ID)}`)} />)));
    delta(1, 'Good ');
    delta(2, 'evening');
    expect(container.textContent).toBe('He says: Good evening');
  });

  it('marks a stream nothing has arrived of as warming up', () => {
    act(() => root.render(withMagid(magid, <NarrationText data={narration(streamPlaceholder(ID))} />)));
    expect(streamSpan()?.className).toBe('magid-stream magid-stream-warming-up');
  });

  it('shows a warm-up message as warming up', () => {
    act(() => root.render(withMagid(magid, <NarrationText data={narration(streamPlaceholder(ID))} />)));
    act(() => magid.client.applyStreamMessage({ 'stream-id': ID, no: 0, snapshot: 'The wizard ponders…', 'warm-up': true }));
    expect([streamSpan()?.className, container.textContent])
      .toEqual(['magid-stream magid-stream-warming-up', 'The wizard ponders…']);
  });

  it('marks a stream as receiving once its text arrives', () => {
    act(() => root.render(withMagid(magid, <NarrationText data={narration(streamPlaceholder(ID))} />)));
    delta(1, 'Good ');
    expect(streamSpan()?.className).toBe('magid-stream magid-stream-receiving');
  });

  it('marks an ended stream as finished, with its status', () => {
    act(() => root.render(withMagid(magid, <NarrationText data={narration(streamPlaceholder(ID))} />)));
    done('The butler says nothing.', 'failed');
    expect([streamSpan()?.className, container.textContent])
      .toEqual(['magid-stream magid-stream-finished magid-stream-failed', 'The butler says nothing.']);
  });

  it('inserts a stream text as text, never as markup', () => {
    act(() => root.render(withMagid(magid, <NarrationText data={narration(streamPlaceholder(ID))} />)));
    delta(1, '<b>bold</b>');
    expect([container.querySelector('b'), container.textContent]).toEqual([null, '<b>bold</b>']);
  });

  it('shows a stream text in a menu description', () => {
    const menu = { 'menu-name': 'hall', 'menu-description': `A voice: ${streamPlaceholder(ID)}`, 'menu-options': [] } as MenuResponse;
    act(() => root.render(withMagid(magid, <MenuScene data={menu} />)));
    delta(1, 'Welcome.');
    expect(container.querySelector('.magid-menu-description')?.textContent).toBe('A voice: Welcome.');
  });
});
