import { useMagidStore } from '../store/magidStore';
import styles from './ServerLobbyPage.module.css';

interface Props {
  onConnect: () => void;
}

export function ServerLobbyPage({ onConnect }: Props) {
  const sessionId        = useMagidStore((s) => s.sessionId);
  const serverName       = useMagidStore((s) => s.serverName);
  const serverVersion    = useMagidStore((s) => s.serverVersion);
  const serverDescription = useMagidStore((s) => s.serverDescription);
  const serverIcon       = useMagidStore((s) => s.serverIcon);
  const xmlList          = useMagidStore((s) => s.xmlList);

  const storyCount = Array.isArray(xmlList) ? xmlList.length : 0;

  return (
    <div className={styles.root}>
      <div className={styles.card}>

        {/* Icon / branding */}
        {serverIcon
          ? <img src={serverIcon} className={styles.icon} alt="" aria-hidden="true" />
          : <div className={styles.iconGlyph} aria-hidden="true">◈</div>}

        {/* Name + version */}
        <div className={styles.nameRow}>
          <h1 className={styles.name}>{serverName ?? 'Magid Server'}</h1>
          {serverVersion && <span className={styles.version}>v{serverVersion}</span>}
        </div>

        {/* Description */}
        {serverDescription && (
          <p className={styles.description}>{serverDescription}</p>
        )}

        <hr className={styles.divider} />

        {/* Story count */}
        {storyCount > 0 ? (
          <p className={styles.storyInfo}>
            <span className={styles.storyCount}>{storyCount}</span>
            {' '}{storyCount === 1 ? 'story' : 'stories'} available
          </p>
        ) : (
          <p className={styles.noStories}>
            This server unfortunately does not have any stories.
          </p>
        )}

        {/* Connect CTA — only when session is not active */}
        {!sessionId && (
          <button className={styles.connectBtn} onClick={onConnect}>
            Connect
          </button>
        )}

        {/* Hint when session is already active */}
        {sessionId && storyCount > 0 && (
          <p className={styles.hint}>Open <strong>Options</strong> to select and arm a story.</p>
        )}
      </div>
    </div>
  );
}
