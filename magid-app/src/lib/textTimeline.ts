export interface TextSegment {
  offsetMs: number;
  text: string;
}

const DCSTP_PREFIX = 'DCSTP_';

export function hasTypewriterAnimation(text: string): boolean {
  return text.includes(DCSTP_PREFIX);
}

export function parseTextSegments(raw: string): TextSegment[] {
  if (!hasTypewriterAnimation(raw)) {
    return [{ offsetMs: 0, text: raw }];
  }

  const parts = raw.split(DCSTP_PREFIX).filter(Boolean);
  const segments: TextSegment[] = [];
  let cumulative = 0;

  for (const part of parts) {
    const atIdx = part.indexOf('@');
    if (atIdx === -1) {
      segments.push({ offsetMs: cumulative, text: part });
    } else {
      const ms = parseInt(part.slice(0, atIdx), 10);
      const text = part.slice(atIdx + 1);
      if (!isNaN(ms)) cumulative = ms;
      segments.push({ offsetMs: cumulative, text });
    }
  }

  return segments;
}
