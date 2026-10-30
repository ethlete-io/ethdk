import { Camera } from '../components/design-canvas/canvas-math';

/** What the window showed last, so a reload comes back to it. */
export type ViewState = {
  checkout: string;
  /** The theme picked per design project, keyed by `themeKey`. */
  themes: Record<string, ThemePick>;
  /** Whether a system tree group or section is open, keyed by its tree key. */
  openGroups: Record<string, boolean>;
  /** The product the system view shows. */
  systemProduct: string;
  /** The tree entry the system view shows, by its tree key. */
  systemEntry: string;
  /**
   * The canvas camera the user moved per system entry, keyed by `cameraKeyOf`. Never `cameras`: that key
   * still holds fitted cameras saved by older builds, which would come back as a stray zoom.
   */
  movedCameras: Record<string, Camera>;
  /** The size a fitted frame's content measured last, keyed by `frameSizeKey`, so a reload places it at once. */
  measuredSizes: Record<string, FrameSize>;
  /** Whether the system view shows its comment sidebar. */
  commentsOpen: boolean;
  /** Whether the comment sidebar lists the resolved threads too. */
  resolvedShown: boolean;
  /** The size, interaction and mode a sketch view showed, keyed by its camera key. */
  sketchViews: Record<string, SketchViewPick>;
  /** The preset a flow view showed, keyed by its camera key. */
  flowPresets: Record<string, string>;
  /** Whether the canvas shows the notes of a product, keyed by `themeKey`. */
  notesShown: Record<string, boolean>;
};

/**
 * `rounds` holds whether the user opened (`true`) or folded (`false`) a round, by round key, for the sketch created
 * at `roundsFor`, and `states` the same for a state no shown variant changes, by state. `changedAreas` holds whether
 * the user showed (`true`) or hid (`false`) the changed area of a round, by round key, for the sketch created at
 * `changedAreasFor`.
 */
export type SketchViewPick = {
  size?: string;
  interaction?: string;
  merge?: boolean;
  rounds?: Record<string, boolean>;
  roundsFor?: string;
  states?: Record<string, boolean>;
  changedAreas?: Record<string, boolean>;
  changedAreasFor?: string;
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

const sketchViewMap = (value: unknown): Record<string, SketchViewPick> | undefined => {
  if (!value || typeof value !== 'object') return undefined;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([key, pick]) => {
      if (!pick || typeof pick !== 'object') return [];

      const { size, interaction, merge, rounds, roundsFor, states, changedAreas, changedAreasFor } =
        pick as SketchViewPick;
      const openRounds = openFlags(rounds);
      const shownAreas = openFlags(changedAreas);
      const openStates = openFlags(states);
      const valid: SketchViewPick = {
        ...(typeof size === 'string' && { size }),
        ...(typeof interaction === 'string' && { interaction }),
        ...(typeof merge === 'boolean' && { merge }),
        ...(openRounds &&
          Object.keys(openRounds).length > 0 &&
          typeof roundsFor === 'string' && { rounds: openRounds, roundsFor }),
        ...(openStates && Object.keys(openStates).length > 0 && { states: openStates }),
        ...(shownAreas &&
          Object.keys(shownAreas).length > 0 &&
          typeof changedAreasFor === 'string' && { changedAreas: shownAreas, changedAreasFor }),
      };

      return Object.keys(valid).length === 0 ? [] : [[key, valid]];
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

const nameMap = (value: unknown): Record<string, string> | undefined => {
  if (!value || typeof value !== 'object') return undefined;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
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

/**
 * The cameras with `camera` stored under `key`, or none under it for a `null` camera, without those of
 * entries that no longer exist. A `null` `existing` keeps all.
 */
export const camerasWith = ({
  cameras,
  key,
  camera,
  existing,
}: {
  cameras: Record<string, Camera>;
  key: string;
  camera: Camera | null;
  existing: ReadonlySet<string> | null;
}): Record<string, Camera> => ({
  ...Object.fromEntries(
    Object.entries(cameras).filter(([stored]) => stored !== key && (existing?.has(stored) ?? true)),
  ),
  ...(camera === null ? {} : { [key]: camera }),
});

const KEY = 'ethlete-studio.call-view';

export const rememberedView = (): Partial<ViewState> => {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');

    if (!stored || typeof stored !== 'object') return {};

    const {
      checkout,
      themes,
      openGroups,
      systemProduct,
      systemEntry,
      movedCameras,
      measuredSizes,
      commentsOpen,
      resolvedShown,
      sketchViews,
      flowPresets,
      notesShown,
    } = stored as Partial<ViewState>;

    return {
      checkout: typeof checkout === 'string' ? checkout : undefined,
      themes: themePicks(themes),
      openGroups: openFlags(openGroups),
      systemProduct: typeof systemProduct === 'string' ? systemProduct : undefined,
      systemEntry: typeof systemEntry === 'string' ? systemEntry : undefined,
      movedCameras: cameraMap(movedCameras),
      measuredSizes: frameSizeMap(measuredSizes),
      commentsOpen: typeof commentsOpen === 'boolean' ? commentsOpen : undefined,
      resolvedShown: typeof resolvedShown === 'boolean' ? resolvedShown : undefined,
      sketchViews: sketchViewMap(sketchViews),
      flowPresets: nameMap(flowPresets),
      notesShown: openFlags(notesShown),
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

/** Remembers part of what one sketch view shows and keeps the rest. */
export const rememberSketchView = (key: string, pick: SketchViewPick) => {
  const sketchViews = rememberedView().sketchViews ?? {};

  rememberView({ sketchViews: { ...sketchViews, [key]: { ...sketchViews[key], ...pick } } });
};

/** Remembers the preset one flow view shows and keeps those of the other flows. */
export const rememberFlowPreset = (key: string, preset: string) =>
  rememberView({ flowPresets: { ...rememberedView().flowPresets, [key]: preset } });

/** Remembers whether the canvas shows the notes of one product and keeps those of the others. */
export const rememberNotesShown = (key: string, shown: boolean) =>
  rememberView({ notesShown: { ...rememberedView().notesShown, [key]: shown } });
