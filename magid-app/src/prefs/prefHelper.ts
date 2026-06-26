export const prefs = {
  get:        (k: string, fallback = '') => localStorage.getItem(k) ?? fallback,
  getBoolean: (k: string) => localStorage.getItem(k) === 'true',
  getDouble:  (k: string) => parseFloat(localStorage.getItem(k) ?? '0') || 0,
  set:        (k: string, v: string)  => localStorage.setItem(k, v),
  setBoolean: (k: string, v: boolean) => localStorage.setItem(k, String(v)),
  setDouble:  (k: string, v: number)  => localStorage.setItem(k, String(v)),
};

export const PREF_KEYS = {
  SERVER_ADDRESS:             'server.address',
  STORY_XML:                  'story.xml',
  STARTUP_ARM_XML:            'startup.arm.xml',
  NARRATION_IGNORE_TIMELINES: 'narration.ignoretimelines',
  NARRATION_IGNORE_TEXT_TL:   'narration.ignoretexttimelines',
  VIEWPORT_IGNORE_MAXIMIZE:   'viewport.ignoremaximization',
  MUSIC_VOLUME:               'music.volume',
} as const;

const URL_HISTORY_KEY = 'server.address.history';
const URL_HISTORY_MAX = 10;

export const urlHistory = {
  get(): string[] {
    try {
      return JSON.parse(localStorage.getItem(URL_HISTORY_KEY) ?? '[]') as string[];
    } catch {
      return [];
    }
  },
  add(url: string): void {
    const list = this.get().filter((u) => u !== url);
    list.unshift(url);
    localStorage.setItem(URL_HISTORY_KEY, JSON.stringify(list.slice(0, URL_HISTORY_MAX)));
  },
};
