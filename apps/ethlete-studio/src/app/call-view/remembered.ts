/** How the call list is ordered inside each group. */
export type CallOrder = 'name' | 'open';

/** What the window showed last, so a reload comes back to it. */
export type ViewState = {
  checkout: string;
  slug: string;
  option: string;
  order: CallOrder;
};

const KEY = 'ethlete-studio.call-view';

export const rememberedView = (): Partial<ViewState> => {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');

    if (!stored || typeof stored !== 'object') return {};

    const { checkout, slug, option, order } = stored as Partial<ViewState>;

    return {
      checkout: typeof checkout === 'string' ? checkout : undefined,
      slug: typeof slug === 'string' ? slug : undefined,
      option: typeof option === 'string' ? option : undefined,
      order: order === 'name' || order === 'open' ? order : undefined,
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
