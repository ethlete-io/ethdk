import { Camera } from '../components/design-canvas/canvas-math';

/** What the window showed last, so a reload comes back to it. */
export type ViewState = {
  checkout: string;
  /** The project the window is in. An empty name means the welcome screen. */
  project: string;
  slug: string;
  variant: string;
  /** The settled feature group the explorer left unfolded. An empty name folds them all. */
  settledFeature: string;
  chatHidden: boolean;
  /** The theme picked per design project, keyed by `themeKey`. */
  themes: Record<string, ThemePick>;
  /** Whether the window shows the calls or the design system. */
  view: StudioView;
  /** Whether a system tree group or section is open, keyed by its tree key. */
  openGroups: Record<string, boolean>;
  /** The product the system view shows. */
  systemProduct: string;
  /** The tree entry the system view shows, by its tree key. */
  systemEntry: string;
  /** The canvas camera per system entry, keyed by `cameraKeyOf`. */
  cameras: Record<string, Camera>;
  /** The size a user gave a canvas frame, keyed by `frameSizeKey`. */
  frameSizes: Record<string, FrameSize>;
};

export type FrameSize = { width?: number; height?: number };

export const frameSizeKey = (cameraKey: string, frameId: string) => `${cameraKey} ${frameId}`;

const isSize = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

const frameSizeMap = (value: unknown): Record<string, FrameSize> | undefined => {
  if (!value || typeof value !== 'object') return undefined;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([key, size]) => {
      if (!size || typeof size !== 'object') return [];

      const { width, height } = size as FrameSize;
      const valid: FrameSize = { ...(isSize(width) && { width }), ...(isSize(height) && { height }) };

      return valid.width === undefined && valid.height === undefined ? [] : [[key, valid]];
    }),
  );
};

/** The sizes stored for the frames of one canvas, keyed by frame id. */
export const frameSizesOf = (stored: Record<string, FrameSize>, cameraKey: string): Record<string, FrameSize> => {
  const prefix = frameSizeKey(cameraKey, '');

  return Object.fromEntries(
    Object.entries(stored)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, size]) => [key.slice(prefix.length), size]),
  );
};

/** The stored sizes with `size` merged into the one of a frame. */
export const frameSizesWith = ({
  stored,
  cameraKey,
  frameId,
  size,
}: {
  stored: Record<string, FrameSize>;
  cameraKey: string;
  frameId: string;
  size: FrameSize;
}): Record<string, FrameSize> => {
  const key = frameSizeKey(cameraKey, frameId);

  return { ...stored, [key]: { ...stored[key], ...size } };
};

export type StudioView = 'calls' | 'system';

export type ThemePick = { surface?: string; color?: string };

export const themeKey = (checkout: string, project: string) => `${checkout} ${project}`;

/** The name a frame wears: the remembered one while the project still names it, else the first. */
export const themeName = (names: readonly string[], remembered: string | undefined) =>
  remembered !== undefined && names.includes(remembered) ? remembered : names[0];

const themePicks = (value: unknown): Record<string, ThemePick> | undefined => {
  if (!value || typeof value !== 'object') return undefined;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([key, pick]) => {
      if (!pick || typeof pick !== 'object') return [];

      const { surface, color } = pick as ThemePick;

      return [
        [
          key,
          {
            surface: typeof surface === 'string' ? surface : undefined,
            color: typeof color === 'string' ? color : undefined,
          },
        ],
      ];
    }),
  );
};

const openFlags = (value: unknown): Record<string, boolean> | undefined => {
  if (!value || typeof value !== 'object') return undefined;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, boolean] => typeof entry[1] === 'boolean',
    ),
  );
};

const isCamera = (value: unknown): value is Camera => {
  if (!value || typeof value !== 'object') return false;

  const { x, y, zoom } = value as Camera;

  return [x, y, zoom].every((number) => typeof number === 'number' && Number.isFinite(number)) && zoom > 0;
};

const cameraMap = (value: unknown): Record<string, Camera> | undefined => {
  if (!value || typeof value !== 'object') return undefined;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter((entry): entry is [string, Camera] => isCamera(entry[1])),
  );
};

/** The cameras with `camera` stored under `key`, without those of entries that no longer exist. */
export const camerasWith = ({
  cameras,
  key,
  camera,
  existing,
}: {
  cameras: Record<string, Camera>;
  key: string;
  camera: Camera;
  existing: ReadonlySet<string>;
}): Record<string, Camera> => ({
  ...Object.fromEntries(Object.entries(cameras).filter(([stored]) => existing.has(stored))),
  [key]: camera,
});

const KEY = 'ethlete-studio.call-view';

export const rememberedView = (): Partial<ViewState> => {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');

    if (!stored || typeof stored !== 'object') return {};

    const {
      checkout,
      project,
      slug,
      variant,
      settledFeature,
      chatHidden,
      themes,
      view,
      openGroups,
      systemProduct,
      systemEntry,
      cameras,
      frameSizes,
    } = stored as Partial<ViewState>;

    return {
      checkout: typeof checkout === 'string' ? checkout : undefined,
      project: typeof project === 'string' ? project : undefined,
      slug: typeof slug === 'string' ? slug : undefined,
      variant: typeof variant === 'string' ? variant : undefined,
      settledFeature: typeof settledFeature === 'string' ? settledFeature : undefined,
      chatHidden: typeof chatHidden === 'boolean' ? chatHidden : undefined,
      themes: themePicks(themes),
      view: view === 'calls' || view === 'system' ? view : undefined,
      openGroups: openFlags(openGroups),
      systemProduct: typeof systemProduct === 'string' ? systemProduct : undefined,
      systemEntry: typeof systemEntry === 'string' ? systemEntry : undefined,
      cameras: cameraMap(cameras),
      frameSizes: frameSizeMap(frameSizes),
    };
  } catch {
    return {};
  }
};

/** Writes one part of the view state and leaves the rest as it was. */
export const rememberView = (patch: Partial<ViewState>) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...rememberedView(), ...patch }));
  } catch {
    // A window without storage simply forgets.
  }
};

/** Remembers one theme pick of a design project and keeps the other. */
export const rememberTheme = (key: string, pick: ThemePick) => {
  const themes = rememberedView().themes ?? {};

  rememberView({ themes: { ...themes, [key]: { ...themes[key], ...pick } } });
};
