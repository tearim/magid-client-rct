import { useState, useEffect, useCallback } from 'react';
import { MagidRoot } from './components/MagidRoot';
import { OptionsModal } from './components/OptionsModal';
import { ToastContainer } from './components/ToastContainer';
import { useMagidStore } from './store/magidStore';
import { prefs, PREF_KEYS } from './prefs/prefHelper';
import { serverStatus, requestXml } from './api/magidClient';
import { clientConfig } from './config/clientConfig';
import styles from './App.module.css';

export default function App() {
  const { elements, isLoading, error, baseUrl, setBaseUrl, sendCommand, connected, menuClass } =
    useMagidStore();

  const [showOptions, setShowOptions]   = useState(false);
  const [statusMsg, setStatusMsg]       = useState('');
  const statusTimerRef = { current: 0 as ReturnType<typeof setTimeout> };

  const showMessage = useCallback((text: string, durationMs = 5000) => {
    setStatusMsg(text);
    clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setStatusMsg(''), durationMs);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Startup sequence
  useEffect(() => {
    const savedUrl = prefs.get(PREF_KEYS.SERVER_ADDRESS, 'http://localhost:8090');
    setBaseUrl(savedUrl);

    async function startup(url: string) {
      try {
        await serverStatus(url);
      } catch {
        showMessage('Could not connect to server');
      }

      const armXml    = prefs.getBoolean(PREF_KEYS.STARTUP_ARM_XML);
      const storyXml  = prefs.get(PREF_KEYS.STORY_XML);
      if (armXml && storyXml) {
        try {
          await requestXml(url, storyXml);
        } catch {
          showMessage('Failed to load saved XML');
        }
      }

      void sendCommand('');
    }

    startup(savedUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show server errors in the status bar
  useEffect(() => {
    if (error) showMessage(error);
  }, [error, showMessage]);

  const handleConnect = () => {
    void sendCommand('');
  };

  const handleResetServer = async () => {
    await sendCommand('reload-xml');
    await sendCommand('');
  };

  const handleBaseUrlChange = (url: string) => {
    setBaseUrl(url);
  };

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <button
          className={styles.optionsBtn}
          onClick={() => setShowOptions(true)}
          aria-label="Open options"
        >
          ☰ Options
        </button>

        <div className={styles.headerRight}>
          {statusMsg && <span className={styles.statusMsg}>{statusMsg}</span>}
          {isLoading && <span className={styles.spinner} aria-label="Loading" />}
          <span className={`${styles.connDot} ${connected ? styles.connDotOn : ''}`} title={connected ? 'Connected' : 'Disconnected'} />
          {clientConfig.showResetServerButton && (
            <button
              className={styles.resetBtn}
              onClick={handleResetServer}
              disabled={isLoading}
              title="Reload the XML and restart the story from the beginning"
            >
              Reset server
            </button>
          )}
          {clientConfig.showConnectButton && (
            <button
              className={styles.connectBtn}
              onClick={handleConnect}
              disabled={isLoading}
            >
              Connect
            </button>
          )}
        </div>
      </header>

      <main className={[styles.main, menuClass].filter(Boolean).join(' ')}>
        <MagidRoot elements={elements} />
      </main>

      {showOptions && (
        <OptionsModal
          baseUrl={baseUrl}
          onBaseUrlChange={handleBaseUrlChange}
          onClose={() => setShowOptions(false)}
          onMessage={showMessage}
        />
      )}

      <ToastContainer />
    </div>
  );
}
