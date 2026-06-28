import { useState, useEffect, useCallback } from 'react';
import { MagidRoot } from './components/MagidRoot';
import { WelcomePage } from './components/WelcomePage';
import { ServerLobbyPage } from './components/ServerLobbyPage';
import { OptionsModal } from './components/OptionsModal';
import { ServerStatsDashboard } from './components/ServerStatsDashboard';
import { ToastContainer } from './components/ToastContainer';
import { useMagidStore } from './store/magidStore';
import { prefs, PREF_KEYS, urlHistory } from './prefs/prefHelper';
import { requestXml } from './api/magidClient';
import { clientConfig } from './config/clientConfig';
import styles from './App.module.css';

export default function App() {
  const { elements, isLoading, error, baseUrl, setBaseUrl, sendCommand, connected, menuClass,
          sessionId, endSession, serverConnected } = useMagidStore();

  const [showOptions, setShowOptions]        = useState(false);
  const [showStats, setShowStats]            = useState(false);
  const [focusOnUrl, setFocusOnUrl]          = useState(false);
  const [confirmEndSession, setConfirmEndSession] = useState(false);
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
      const armXml    = prefs.getBoolean(PREF_KEYS.STARTUP_ARM_XML);
      const storyXml  = prefs.get(PREF_KEYS.STORY_XML);
      if (armXml && storyXml) {
        try {
          await sendCommand('')
          await requestXml(url, storyXml, useMagidStore.getState().sessionId ?? undefined);
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

  // Save the URL to history the first time a session is established.
  useEffect(() => {
    if (sessionId) urlHistory.add(baseUrl);
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConnect = () => {
    if (!baseUrl) {
      handleOptions(true);
    } else {
      void sendCommand('');
    }
  };

  const handleResetServer = async () => {
    await sendCommand('reload-xml');
    await sendCommand('');
  };

  const handleBaseUrlChange = (url: string) => {
    setBaseUrl(url);
  };

  const handleOptions = (_focusOnUrl?: boolean) => {
    if ( _focusOnUrl) {
      setFocusOnUrl(true);
    } else {
      setFocusOnUrl(false);
    }
    setShowOptions(true);
  };

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <button
          className={styles.optionsBtn}
          onClick={() => handleOptions()}
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
          {sessionId && (
            confirmEndSession ? (
              <span className={styles.endSessionConfirm}>
                End session?
                <button
                  className={styles.endSessionYes}
                  disabled={isLoading}
                  onClick={() => { setConfirmEndSession(false); void endSession(); }}
                >
                  Yes
                </button>
                <button
                  className={styles.endSessionNo}
                  onClick={() => setConfirmEndSession(false)}
                >
                  No
                </button>
              </span>
            ) : (
              <button
                className={styles.endSessionBtn}
                disabled={isLoading}
                onClick={() => setConfirmEndSession(true)}
              >
                End session
              </button>
            )
          )}
        </div>
      </header>

      <main className={[styles.main, menuClass].filter(Boolean).join(' ')}>
        {elements.length > 0
          ? <MagidRoot elements={elements} />
          : isLoading
            ? null
            : serverConnected
              ? <ServerLobbyPage onConnect={handleConnect} />
              : <WelcomePage connectFunction={handleConnect} optionsFunction={() => handleOptions()} />}
      </main>

      {showOptions && (
        <OptionsModal
          baseUrl={baseUrl}
          onBaseUrlChange={handleBaseUrlChange}
          onClose={() => setShowOptions(false)}
          onMessage={showMessage}
          onOpenStats={() => { setShowOptions(false); setShowStats(true); }}
          focusOnUrl={focusOnUrl}
        />
      )}

      {showStats && (
        <ServerStatsDashboard
          baseUrl={baseUrl}
          onClose={() => setShowStats(false)}
        />
      )}

      <ToastContainer />
    </div>
  );
}
