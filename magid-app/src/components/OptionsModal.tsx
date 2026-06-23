import {useState, useEffect} from 'react';
import { prefs, PREF_KEYS } from '../prefs/prefHelper';
import { getXmlList, requestXml } from '../api/magidClient';
import type { XmlEntry } from '../types/protocol';
import styles from './OptionsModal.module.css';
import { useMagidStore } from '../store/magidStore';

interface Props {
  baseUrl: string;
  onBaseUrlChange: (url: string) => void;
  onClose: () => void;
  onMessage: (msg: string) => void;
}

export function OptionsModal({ baseUrl, onBaseUrlChange, onClose, onMessage }: Props) {
  const [serverAddr, setServerAddr]     = useState(() => prefs.get(PREF_KEYS.SERVER_ADDRESS, baseUrl));
  const [xmlList, setXmlList]           = useState<XmlEntry[]>([]);
  const [selectedXml, setSelectedXml]  = useState(() => prefs.get(PREF_KEYS.STORY_XML));
  const [startupArm, setStartupArm]    = useState(() => prefs.getBoolean(PREF_KEYS.STARTUP_ARM_XML));
  const [ignoreTimelines, setIgnoreTimelines] = useState(() => prefs.getBoolean(PREF_KEYS.NARRATION_IGNORE_TIMELINES));
  const [ignoreTextTL, setIgnoreTextTL]       = useState(() => prefs.getBoolean(PREF_KEYS.NARRATION_IGNORE_TEXT_TL));
  const [ignoreMaximize, setIgnoreMaximize]   = useState(() => prefs.getBoolean(PREF_KEYS.VIEWPORT_IGNORE_MAXIMIZE));
  const [volume, setVolume]            = useState(() => prefs.getDouble(PREF_KEYS.MUSIC_VOLUME) || 0.8);
  const [loadingXmls, setLoadingXmls] = useState(false);
  useEffect(() => {
    setLoadingXmls(true);
    useMagidStore.getState().clearCssFiles();
    const authToken = useMagidStore.getState().sessionId ?? undefined;
    getXmlList(serverAddr, authToken)
      .then(setXmlList)
      .catch(() => {})
      .finally(() => setLoadingXmls(false));
  }, [serverAddr]);

  const handleSave = async () => {
    prefs.set(PREF_KEYS.SERVER_ADDRESS, serverAddr);
    prefs.set(PREF_KEYS.STORY_XML, selectedXml);
    prefs.setBoolean(PREF_KEYS.STARTUP_ARM_XML, startupArm);
    prefs.setBoolean(PREF_KEYS.NARRATION_IGNORE_TIMELINES, ignoreTimelines);
    prefs.setBoolean(PREF_KEYS.NARRATION_IGNORE_TEXT_TL, ignoreTextTL);
    prefs.setBoolean(PREF_KEYS.VIEWPORT_IGNORE_MAXIMIZE, ignoreMaximize);
    prefs.setDouble(PREF_KEYS.MUSIC_VOLUME, volume);
    onBaseUrlChange(serverAddr);

    if (selectedXml) {
      try {
        await requestXml(serverAddr, selectedXml, useMagidStore.getState().sessionId ?? undefined);
        onMessage('XML loaded: ' + selectedXml);
      } catch {
        onMessage('Failed to load XML');
      }
    }

    onClose();
  };

  return (
    <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-label="Options">
        <h2 className={styles.title}>Options</h2>

        <label className={styles.field}>
          Server address
          <input
            type="text"
            value={serverAddr}
            onChange={(e) => setServerAddr(e.target.value)}
            className={styles.input}
          />
        </label>

        <label className={styles.field}>
          Story XML
          {loadingXmls ? (
            <span className={styles.hint}>Loading…</span>
          ) : (
            <select
              value={selectedXml}
              onChange={(e) => setSelectedXml(e.target.value)}
              className={styles.input}
            >
              <option value="">— none —</option>
              {xmlList.map((x) => (
                <option key={x.path} value={x.path}>
                  {x.name || x.path}
                </option>
              ))}
            </select>
          )}
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
          <button onClick={handleSave} className={styles.saveBtn}>Save</button>
          <button onClick={onClose} className={styles.cancelBtn}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
