import { useState, useEffect, useRef } from 'react';
import { prefs, PREF_KEYS, urlHistory } from '../prefs/prefHelper';
import { requestXml } from '../api/magidClient';
import styles from './OptionsModal.module.css';
import { useMagidStore } from '../store/magidStore';

interface Props {
  baseUrl: string;
  onBaseUrlChange: (url: string) => void;
  onClose: () => void;
  onMessage: (msg: string) => void;
  onOpenStats: () => void;
  focusOnUrl?: boolean;
}

export function OptionsModal({ baseUrl, onBaseUrlChange, onClose, onMessage, onOpenStats, focusOnUrl }: Props) {
  const xmlList        = useMagidStore((s) => s.xmlList);
  const refreshXmlList = useMagidStore((s) => s.refreshXmlList);
  const clearCssFiles  = useMagidStore((s) => s.clearCssFiles);
  const loadResponse   = useMagidStore((s) => s.loadResponse);

  const [serverAddr, setServerAddr]     = useState(() => prefs.get(PREF_KEYS.SERVER_ADDRESS, baseUrl));
  const [selectedXml, setSelectedXml]  = useState(() => prefs.get(PREF_KEYS.STORY_XML));
  const [startupArm, setStartupArm]    = useState(() => prefs.getBoolean(PREF_KEYS.STARTUP_ARM_XML));
  const [ignoreTimelines, setIgnoreTimelines] = useState(() => prefs.getBoolean(PREF_KEYS.NARRATION_IGNORE_TIMELINES));
  const [ignoreTextTL, setIgnoreTextTL]       = useState(() => prefs.getBoolean(PREF_KEYS.NARRATION_IGNORE_TEXT_TL));
  const [ignoreMaximize, setIgnoreMaximize]   = useState(() => prefs.getBoolean(PREF_KEYS.VIEWPORT_IGNORE_MAXIMIZE));
  const [volume, setVolume]            = useState(() => {
    const raw = parseFloat(prefs.get(PREF_KEYS.MUSIC_VOLUME, ''));
    return isNaN(raw) ? 0.8 : raw;
  });
  const [refreshingXmls, setRefreshingXmls] = useState(false);
  const [armingXml, setArmingXml]           = useState(false);
  const [urlHistoryList]                    = useState(() => urlHistory.get());
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Focus the URL input once on mount, if requested.
  useEffect(() => {
    if (focusOnUrl) urlInputRef.current?.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefreshXmls = async () => {
    setRefreshingXmls(true);
    await refreshXmlList();
    setRefreshingXmls(false);
  };

  const handleArmXml = async () => {
    if (!selectedXml) return;
    setArmingXml(true);
    clearCssFiles();
    try {
      const raw = await requestXml(serverAddr, selectedXml, useMagidStore.getState().sessionId ?? undefined);
      loadResponse(raw);
      onMessage('XML armed: ' + selectedXml);
    } catch {
      onMessage('Failed to arm XML');
    } finally {
      setArmingXml(false);
    }
  };

  const handleSave = () => {
    prefs.set(PREF_KEYS.SERVER_ADDRESS, serverAddr);
    prefs.set(PREF_KEYS.STORY_XML, selectedXml);
    prefs.setBoolean(PREF_KEYS.STARTUP_ARM_XML, startupArm);
    prefs.setBoolean(PREF_KEYS.NARRATION_IGNORE_TIMELINES, ignoreTimelines);
    prefs.setBoolean(PREF_KEYS.NARRATION_IGNORE_TEXT_TL, ignoreTextTL);
    prefs.setBoolean(PREF_KEYS.VIEWPORT_IGNORE_MAXIMIZE, ignoreMaximize);
    prefs.setDouble(PREF_KEYS.MUSIC_VOLUME, volume);
    onBaseUrlChange(serverAddr);
    onClose();
  };

  return (
    <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-label="Options">
        <h2 className={styles.title}>Options</h2>

        <label className={styles.field}>
          Server address
          <input
            ref={urlInputRef}
            list="magid-url-history"
            type="text"
            value={serverAddr}
            onChange={(e) => setServerAddr(e.target.value)}
            className={styles.input}
            placeholder="http://localhost:8090"
          />
          <datalist id="magid-url-history">
            {urlHistoryList.map((u) => <option key={u} value={u} />)}
          </datalist>
        </label>

        <label className={styles.field}>
          <span className={styles.xmlLabel}>
            Story XML
            <button
              className={styles.refreshBtn}
              onClick={handleRefreshXmls}
              disabled={refreshingXmls}
              title="Refresh XML list from server"
            >
              {refreshingXmls ? '…' : '↻'}
            </button>
          </span>
          <div className={styles.xmlRow}>
            <select
              value={selectedXml}
              onChange={(e) => setSelectedXml(e.target.value)}
              className={styles.input}
            >
              <option value="">— none —</option>
              {(Array.isArray(xmlList) ? xmlList : []).map((x) => (
                <option key={x.path} value={x.path}>
                  {x.name || x.path}
                </option>
              ))}
            </select>
            <button
              onClick={handleArmXml}
              disabled={!selectedXml || armingXml}
              className={styles.armBtn}
            >
              {armingXml ? 'Arming…' : 'Arm XML'}
            </button>
          </div>
        </label>

        {selectedXml && (
          <p className={styles.hint}>Active XML: {selectedXml}</p>
        )}

        <label className={styles.checkRow}>
          <input type="checkbox" checked={startupArm} onChange={(e) => setStartupArm(e.target.checked)} />
          Auto-load XML on startup
        </label>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={ignoreTimelines} onChange={(e) => setIgnoreTimelines(e.target.checked)} />
          Ignore narration timelines
        </label>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={ignoreTextTL} onChange={(e) => setIgnoreTextTL(e.target.checked)} />
          Ignore text timelines (skip typewriter)
        </label>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={ignoreMaximize} onChange={(e) => setIgnoreMaximize(e.target.checked)} />
          Ignore maximization requests
        </label>

        <label className={styles.field}>
          Music volume ({Math.round(volume * 100)}%)
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className={styles.slider}
          />
        </label>

        <div className={styles.actions}>
          <button onClick={onOpenStats} className={styles.statsBtn}>Server Stats</button>
          <button onClick={handleSave} className={styles.saveBtn}>Save</button>
          <button onClick={onClose} className={styles.cancelBtn}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
