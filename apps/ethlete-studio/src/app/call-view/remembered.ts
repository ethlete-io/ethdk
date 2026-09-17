/** Which option of which call the window showed last, so a reload comes back to it. */
export type Remembered = {
  checkout: string;
  slug: string;
  option: string;
};

const KEY = 'ethlete-studio.call-view';

export const rememberCall = (selection: Remembered) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(selection));
  } catch {
    // A window without storage simply forgets.
  }
};

export const rememberedCall = (): Remembered | null => {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');

    if (!stored || typeof stored !== 'object') return null;

    const { checkout, slug, option } = stored as Partial<Remembered>;

    return typeof checkout === 'string' && typeof slug === 'string' && typeof option === 'string'
      ? { checkout, slug, option }
      : null;
  } catch {
    return null;
  }
};
