import { useMagidStore } from '../store/magidStore';
import styles from './WelcomePage.module.css';

interface Props {
  connectFunction: () => void;
  optionsFunction: () => void;
}

export function WelcomePage({ connectFunction, optionsFunction }: Props) {
  const serverName        = useMagidStore((s) => s.serverName);
  const serverDescription = useMagidStore((s) => s.serverDescription);
  const serverIcon        = useMagidStore((s) => s.serverIcon);

  return (
    <div className={styles.root}>
      <div className={styles.card}>
        {serverIcon
          ? <img src={serverIcon} className={styles.serverIcon} alt="" aria-hidden="true" />
          : <div className={styles.icon} aria-hidden="true">◈</div>}

        <h1 className={styles.title}>
          {serverName ?? 'Welcome to the Magid Client'}
        </h1>

        {serverDescription && (
          <p className={`${styles.body} ${styles.serverDesc}`}>{serverDescription}</p>
        )}

        <p className={styles.body}>
          Press <kbd onClick={connectFunction} className={styles.key}>Connect</kbd> to connect to a Magid server.
          Press <kbd onClick={optionsFunction} className={styles.key}>Options</kbd> if you need to set the server address.
        </p>

        <p className={`${styles.body} ${styles.warning}`}>
          <span className={styles.warningIcon} aria-hidden="true">⚠</span>
          Be careful with unknown servers — they can contain malicious content.
        </p>
      </div>
    </div>
  );
}
