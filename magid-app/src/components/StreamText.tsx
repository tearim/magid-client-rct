import { streamClassName } from '@magiden/client-core';
import { useMagidStore } from '../store/magidStore';
import { renderWithBreaks } from '../lib/renderText';

// A streamed text (the core's `stream` node): the stream's text so far, kept current as it arrives. Plain text, never
// markup; not typed out (the stream is its own typing). Classes from the core's streamClassName: `magid-stream`,
// its phase (`-warming-up`, `-receiving`, `-finished`) and, once finished, its status (`-ok`, `-failed`, …).
export function StreamText({ id }: { id: string }) {
  const state = useMagidStore((s) => s.streams[id]);
  return (
    <span className={streamClassName(state)} data-stream-id={id}>
      {renderWithBreaks(state?.text ?? '')}
    </span>
  );
}
