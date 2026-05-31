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
