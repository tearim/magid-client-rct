import { describe, it, expect } from 'vitest';
import { hasTypewriterAnimation, parseTextSegments } from './textTimeline';

describe('hasTypewriterAnimation', () => {
  it('returns true when DCSTP_ is present', () => {
    expect(hasTypewriterAnimation('DCSTP_0@Hello')).toBe(true);
  });
  it('returns false for plain text', () => {
    expect(hasTypewriterAnimation('Hello world')).toBe(false);
  });
});

describe('parseTextSegments', () => {
  it('parses a two-segment typewriter string', () => {
    const result = parseTextSegments('DCSTP_0@Hello, DCSTP_500@world!');
    expect(result).toEqual([
      { offsetMs: 0, text: 'Hello, ' },
      { offsetMs: 500, text: 'world!' },
    ]);
  });

  it('returns a single segment for plain text', () => {
    const result = parseTextSegments('Plain text');
    expect(result).toEqual([{ offsetMs: 0, text: 'Plain text' }]);
  });

  it('handles a segment without @ delimiter', () => {
    const result = parseTextSegments('DCSTP_0@Hello DCSTP_noline');
    expect(result[1]).toEqual({ offsetMs: 0, text: 'noline' });
  });
});
