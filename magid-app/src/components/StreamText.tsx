import { useMagidStore } from '../store/magidStore';
import { renderWithBreaks } from '../lib/renderText';

// A streamed text (the core's `stream` node): the stream's text so far, kept current as deltas arrive. Plain text, never
// markup; not typed out (the stream is its own typing). Classes for authors: `magid-stream` and its state,
// `magid-stream-open` while it runs, else `magid-stream-<status>` (ok, failed, cancelled, timeout).
export function StreamText({ id }: { id: string }) {
  const state = useMagidStore((s) => s.streams[id]);
  const phase = state?.finished ? state.status ?? 'ok' : 'open';
  return (
    <span className={`magid-stream magid-stream-${phase}`} data-stream-id={id}>
      {renderWithBreaks(state?.text ?? '')}
    </span>
  );
}
