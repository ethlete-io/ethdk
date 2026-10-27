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

const KEY = 'ethlete-studio.call-view';

export const rememberedView = (): Partial<ViewState> => {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');

    if (!stored || typeof stored !== 'object') return {};

    const { checkout, project, slug, variant, settledFeature, chatHidden, themes, view } = stored as Partial<ViewState>;

    return {
      checkout: typeof checkout === 'string' ? checkout : undefined,
      project: typeof project === 'string' ? project : undefined,
      slug: typeof slug === 'string' ? slug : undefined,
      variant: typeof variant === 'string' ? variant : undefined,
      settledFeature: typeof settledFeature === 'string' ? settledFeature : undefined,
      chatHidden: typeof chatHidden === 'boolean' ? chatHidden : undefined,
      themes: themePicks(themes),
      view: view === 'calls' || view === 'system' ? view : undefined,
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
