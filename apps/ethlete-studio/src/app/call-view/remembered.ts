/** What the window showed last, so a reload comes back to it. */
export type ViewState = {
  checkout: string;
  /** The project the window is in. An empty name means the welcome screen. */
  project: string;
  slug: string;
  option: string;
  /** The settled feature group the explorer left unfolded. An empty name folds them all. */
  settledFeature: string;
};

const KEY = 'ethlete-studio.call-view';

export const rememberedView = (): Partial<ViewState> => {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');

    if (!stored || typeof stored !== 'object') return {};

    const { checkout, project, slug, option, settledFeature } = stored as Partial<ViewState>;

    return {
      checkout: typeof checkout === 'string' ? checkout : undefined,
      project: typeof project === 'string' ? project : undefined,
      slug: typeof slug === 'string' ? slug : undefined,
      option: typeof option === 'string' ? option : undefined,
      settledFeature: typeof settledFeature === 'string' ? settledFeature : undefined,
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
