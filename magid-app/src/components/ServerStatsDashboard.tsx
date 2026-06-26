import { useState, useEffect, useCallback } from 'react';
import { fetchServerStats, javaHashCode } from '../api/magidClient';
import type { ServerStats, ServerStatsSession } from '../types/protocol';
import { useMagidStore } from '../store/magidStore';
import styles from './ServerStatsDashboard.module.css';

const KNOWN_HEADER_KEYS = new Set([
  'session-count', 'session-max', 'session-ttl', 'session-short-ttl',
  'session-next-evict', 'session-next-evict-explanation',
]);

const KNOWN_SESSION_KEYS = new Set([
  'is-admin', 'uid-hash', 'file-path', 'is-short-lived',
  'command-count', 'file-request-count', 'last-active-time', 'last-active-time-explanation',
]);

const POLL_OPTIONS = [2, 5, 10, 30] as const;
type PollSeconds = typeof POLL_OPTIONS[number];

function fmtMs(ms: number): string {
  if (ms < 1_000) return `${ms}ms`;
  if (ms < 60_000) return `${Math.round(ms / 1_000)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
}

function relTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 0) return `in ${fmtMs(-diff)}`;
  if (diff < 3_000) return 'just now';
  return `${fmtMs(diff)} ago`;
}

function capColorClass(ratio: number): string {
  if (ratio < 0.6) return styles.ok;
  if (ratio < 0.8) return styles.warn;
  if (ratio < 0.9) return styles.high;
  return styles.crit;
}

function hexHash(n: number): string {
  return (n >>> 0).toString(16).padStart(8, '0').toUpperCase();
}

function fileName(p: string): string {
  return p.replace(/\\/g, '/').split('/').pop() ?? p;
}

function extraEntries(obj: Record<string, unknown>, known: Set<string>): [string, unknown][] {
  return Object.entries(obj).filter(([k]) => !known.has(k));
}

function renderVal(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

interface Props {
  baseUrl: string;
  onClose: () => void;
}

export function ServerStatsDashboard({ baseUrl, onClose }: Props) {
  const sessionId  = useMagidStore((s) => s.sessionId);
  const endSession = useMagidStore((s) => s.endSession);
  const myHash     = sessionId !== null ? javaHashCode(sessionId) : null;
  const [stats, setStats]             = useState<ServerStats | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [updatedAt, setUpdatedAt]     = useState<Date | null>(null);
  const [pollSecs, setPollSecs]       = useState<PollSeconds>(5);
  const [fetching, setFetching]       = useState(false);

  const doFetch = useCallback(async () => {
    setFetching(true);
    try {
      const data = await fetchServerStats(baseUrl, sessionId ?? undefined);
      setStats(data);
      setError(null);
      setUpdatedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setFetching(false);
    }
  }, [baseUrl, sessionId]);

  // Fetch on mount and whenever baseUrl/sessionId changes
  useEffect(() => { void doFetch(); }, [doFetch]);

  // Polling
  useEffect(() => {
    const id = window.setInterval(() => void doFetch(), pollSecs * 1_000);
    return () => window.clearInterval(id);
  }, [doFetch, pollSecs]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Extra dynamic columns derived from all sessions
  const extraSessionKeys: string[] = stats
    ? Array.from(stats.sessions.reduce((acc, s) => {
        for (const k of Object.keys(s)) {
          if (!KNOWN_SESSION_KEYS.has(k)) acc.add(k);
        }
        return acc;
      }, new Set<string>()))
    : [];

  const h = stats?.header;
  const capacity = h ? h['session-count'] / h['session-max'] : 0;

  return (
    <div className={styles.overlay}>
      {/* Top bar */}
      <div className={styles.topbar}>
        <span className={styles.titleIcon}>◈</span>
        <h1 className={styles.title}>Server Stats</h1>
        {fetching && <span className={styles.pulse} title="Refreshing…" />}
        <div className={styles.pollGroup}>
          {POLL_OPTIONS.map((s) => (
            <button
              key={s}
              className={`${styles.pollBtn} ${pollSecs === s ? styles.pollBtnActive : ''}`}
              onClick={() => setPollSecs(s)}
            >
              {s}s
            </button>
          ))}
        </div>
        <button className={styles.refreshBtn} onClick={() => void doFetch()} disabled={fetching} title="Refresh now">
          ↻
        </button>
        <button className={styles.closeBtn} onClick={onClose} title="Close">✕</button>
      </div>

      {/* Scrollable content */}
      <div className={styles.content}>
        {error && <div className={styles.errorBanner}>{error}</div>}

        {h && (
          <>
            {/* Stat cards */}
            <div className={styles.cards}>
              <div className={styles.card}>
                <div className={styles.cardLabel}>Sessions</div>
                <div className={`${styles.cardValue} ${capColorClass(capacity)}`}>
                  {h['session-count']} <span className={styles.cardOf}>/ {h['session-max']}</span>
                </div>
                <div className={styles.capBar}>
                  <div
                    className={`${styles.capFill} ${capColorClass(capacity)}`}
                    style={{ width: `${Math.min(capacity * 100, 100).toFixed(1)}%` }}
                  />
                </div>
                <div className={styles.cardSub}>{(capacity * 100).toFixed(0)}% capacity</div>
              </div>

              <div className={styles.card}>
                <div className={styles.cardLabel}>Session TTL</div>
                <div className={styles.cardValue}>{fmtMs(h['session-ttl'])}</div>
                <div className={styles.cardSub}>idle timeout</div>
              </div>

              <div className={styles.card}>
                <div className={styles.cardLabel}>Short-lived TTL</div>
                <div className={styles.cardValue}>{fmtMs(h['session-short-ttl'])}</div>
                <div className={styles.cardSub}>for unauthenticated</div>
              </div>

              <div className={styles.card}>
                <div className={styles.cardLabel}>Next Eviction</div>
                <div className={styles.cardValue}>{relTime(h['session-next-evict'])}</div>
                <div className={styles.cardSub} title={h['session-next-evict-explanation']}>
                  {new Date(h['session-next-evict']).toLocaleTimeString()}
                </div>
              </div>
            </div>

            {/* Extra header fields */}
            {extraEntries(h as Record<string, unknown>, KNOWN_HEADER_KEYS).length > 0 && (
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Additional server info</div>
                <div className={styles.kvGrid}>
                  {extraEntries(h as Record<string, unknown>, KNOWN_HEADER_KEYS).map(([k, v]) => (
                    <div key={k} className={styles.kvRow}>
                      <span className={styles.kvKey}>{k}</span>
                      <span className={styles.kvVal}>{renderVal(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Sessions table */}
        {stats && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              Sessions
              <span className={styles.sectionCount}>{stats.sessions.length}</span>
            </div>
            {stats.sessions.length === 0 ? (
              <div className={styles.empty}>No active sessions</div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>UID</th>
                      <th>Story file</th>
                      <th>Role</th>
                      <th>Type</th>
                      <th>Commands</th>
                      <th>File reqs</th>
                      <th>Last active</th>
                      {extraSessionKeys.map((k) => <th key={k}>{k}</th>)}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {stats.sessions.map((s, i) => (
                      <SessionRow
                        key={i}
                        session={s}
                        extraKeys={extraSessionKeys}
                        isMine={myHash !== null && s['uid-hash'] === myHash}
                        onEndSession={async () => { await endSession(); onClose(); }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {updatedAt && (
          <div className={styles.footer}>
            Last updated: {updatedAt.toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
}

interface SessionRowProps {
  session: ServerStatsSession;
  extraKeys: string[];
  isMine: boolean;
  onEndSession: () => Promise<void>;
}

function SessionRow({ session: s, extraKeys, isMine, onEndSession }: SessionRowProps) {
  const [confirming, setConfirming] = useState(false);
  const [ending, setEnding]         = useState(false);

  const handleEnd = async () => {
    setEnding(true);
    await onEndSession();
    setEnding(false);
    setConfirming(false);
  };

  return (
    <tr className={isMine ? styles.myRow : undefined}>
      <td>
        <span className={styles.hashChip} title={String(s['uid-hash'])}>
          {hexHash(s['uid-hash'])}
        </span>
        {isMine && <span className={styles.meBadge}>you</span>}
      </td>
      <td>
        <span className={styles.filepath} title={s['file-path']}>
          {fileName(s['file-path'])}
        </span>
      </td>
      <td>
        {s['is-admin']
          ? <span className={`${styles.badge} ${styles.badgeAdmin}`}>Admin</span>
          : <span className={`${styles.badge} ${styles.badgeUser}`}>User</span>}
      </td>
      <td>
        {s['is-short-lived']
          ? <span className={`${styles.badge} ${styles.badgeShort}`}>Short</span>
          : <span className={styles.muted}>Standard</span>}
      </td>
      <td className={styles.num}>{s['command-count']}</td>
      <td className={styles.num}>{s['file-request-count']}</td>
      <td>
        <span title={new Date(s['last-active-time']).toLocaleString()}>
          {relTime(s['last-active-time'])}
        </span>
      </td>
      {extraKeys.map((k) => (
        <td key={k}>{renderVal(s[k])}</td>
      ))}
      <td className={styles.actionCell}>
        {isMine && (
          confirming ? (
            <span className={styles.confirmInline}>
              End session?
              <button className={styles.confirmYes} onClick={handleEnd} disabled={ending}>
                {ending ? '…' : 'Yes'}
              </button>
              <button className={styles.confirmNo} onClick={() => setConfirming(false)} disabled={ending}>
                No
              </button>
            </span>
          ) : (
            <button className={styles.endSessionBtn} onClick={() => setConfirming(true)}>
              End session
            </button>
          )
        )}
      </td>
    </tr>
  );
}
