import { useEffect, useRef, useState } from 'react';
import { parseMagidCss, withFileRequestToken, type ImageResponse } from '@magiden/client-core';
import { useMagidStore } from '../store/magidStore';
import { useImpliedClasses } from '../hooks/useImpliedClasses';

type ImageData = Pick<ImageResponse, 'alt' | 'width' | 'height' | 'class' | 'css'> & { image?: string };

// An author's <img>, detached (at its anchor in a text) or on its own. Its class and css belong to the image itself.
// Files from the server need the session's token, which can change, so it is added here, at render time.
export function MagidImage({ data }: { data: ImageData }) {
  const baseUrl = useMagidStore((s) => s.baseUrl);
  const fileRequestToken = useMagidStore((s) => s.fileRequestToken);
  const className = useImpliedClasses(data.class);
  if (!data.image) return null;

  const style = {
    ...(data.css ? parseMagidCss(data.css) : undefined),
    ...(data.width ? { width: cssLength(data.width) } : undefined),
    ...(data.height ? { height: cssLength(data.height) } : undefined),
  };
  return (
    <img
      className={['magid-image', className].filter(Boolean).join(' ')}
      style={style}
      src={withFileRequestToken(data.image, baseUrl, fileRequestToken)}
      alt={data.alt ?? ''}
    />
  );
}

interface Props {
  data: ImageResponse;
  onComplete?: () => void;
}

// A standalone image takes its turn among the narrations: it waits for its `defer`, then reports itself complete.
export function ImageElement({ data, onComplete }: Props) {
  const deferMs = data.defer ? parseInt(data.defer, 10) : 0;
  const normalizedDeferMs = Number.isFinite(deferMs) ? deferMs : 0;
  const [visible, setVisible] = useState(normalizedDeferMs === 0);
  const completionReportedRef = useRef(false);

  useEffect(() => {
    if (normalizedDeferMs === 0) return;
    const t = setTimeout(() => setVisible(true), normalizedDeferMs);
    return () => clearTimeout(t);
  }, [normalizedDeferMs]);

  useEffect(() => {
    if (!visible || !onComplete || completionReportedRef.current) return;
    completionReportedRef.current = true;
    onComplete();
  }, [visible, onComplete]);

  if (!visible) return null;
  return (
    <div className="magid-default-image">
      <MagidImage data={data} />
    </div>
  );
}

// `width="200"` means pixels, as in HTML; anything else (`50%`, `12em`) is a CSS length already.
function cssLength(value: string): string {
  return /^\d+(\.\d+)?$/.test(value.trim()) ? `${value.trim()}px` : value;
}
