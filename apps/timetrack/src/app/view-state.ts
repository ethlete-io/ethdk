/**
 * Where the reviewer was when the window last closed: the view, the day under review, where its
 * timeline was scrolled to and the week the catch-up list was on.
 *
 * `localStorage` rather than the encrypted store, for two reasons. It answers synchronously, so the
 * first paint is already the right view instead of the default one followed by a jump. And it holds no
 * observation — a route name and two calendar days say nothing about what was worked on, which is the
 * only thing the encrypted store exists to protect.
 */
const STORAGE_KEY = 'ethlete.timetrack.view-state';

export type ViewState = {
  /** The route path of the last view, without a leading slash. */
  view?: string;
  /** The day the review was on, as `YYYY-MM-DD`. */
  day?: string;
  /** The Monday the week view was on, as `YYYY-MM-DD`. */
  weekStart?: string;
  /** The day timeline's scroll offsets in CSS pixels, per `YYYY-MM-DD` day. */
  timelineScroll?: Record<string, TimelineScroll>;
};

export type TimelineScroll = { top: number; left: number };

const REMEMBERED_SCROLL_DAYS = 60;

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const VIEW_PATH = /^[a-z-]+$/;

const stringAt = (state: Record<string, unknown>, key: string) => {
  const value = state[key];

  return typeof value === 'string' ? value : undefined;
};

const dayAt = (state: Record<string, unknown>, key: string) => {
  const value = stringAt(state, key);

  return value && DAY_KEY.test(value) ? value : undefined;
};

const offsetAt = (state: Record<string, unknown>, key: string) => {
  const value = state[key];

  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
};

const scrollOf = (value: unknown): TimelineScroll | undefined => {
  if (typeof value !== 'object' || value === null) return undefined;

  const top = offsetAt(value as Record<string, unknown>, 'top');
  const left = offsetAt(value as Record<string, unknown>, 'left');

  return top === undefined || left === undefined ? undefined : { top, left };
};

const scrollsAt = (state: Record<string, unknown>, key: string) => {
  const value = state[key];

  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;

  const days = Object.entries(value).flatMap(([day, scroll]): [string, TimelineScroll][] => {
    const valid = DAY_KEY.test(day) ? scrollOf(scroll) : undefined;

    return valid ? [[day, valid]] : [];
  });

  return Object.fromEntries(days.sort(([a], [b]) => b.localeCompare(a)).slice(0, REMEMBERED_SCROLL_DAYS));
};

/**
 * What was stored, with every field validated.
 *
 * A hand-edited or half-written entry must not be able to route the app at a path that does not exist
 * or ask the store for a day key nothing can parse, so anything that does not read as what it claims
 * to be is dropped rather than trusted.
 */
export const readViewState = (): ViewState => {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');

    if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return {};

    const state = stored as Record<string, unknown>;
    const view = stringAt(state, 'view');

    return {
      view: view && VIEW_PATH.test(view) ? view : undefined,
      day: dayAt(state, 'day'),
      weekStart: dayAt(state, 'weekStart'),
      timelineScroll: scrollsAt(state, 'timelineScroll'),
    };
  } catch {
    return {};
  }
};

/** The local calendar day of an instant, as `YYYY-MM-DD`. */
export const dayKeyOfDate = (at: Date) =>
  `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;

/** Keeps where one day's timeline was scrolled to, next to the other days'. */
export const rememberTimelineScroll = (day: string, scroll: TimelineScroll) =>
  rememberViewState({ timelineScroll: { ...readViewState().timelineScroll, [day]: scroll } });

/** Keeps one field of the state. A storage that refuses the write costs the restore, never the app. */
export const rememberViewState = (patch: ViewState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readViewState(), ...patch }));
  } catch {
    return;
  }
};
