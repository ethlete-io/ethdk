export type ColorScheme = 'light' | 'dark';

const SCHEME_FEATURE = /\(\s*prefers-color-scheme\s*:\s*(light|dark)\s*\)/giu;

/** `media` with each `prefers-color-scheme` feature replaced by one that always or never matches, as `scheme` decides. */
export const pinnedMediaText = (media: string, scheme: ColorScheme) =>
  media.replace(SCHEME_FEATURE, (_, wanted: string) =>
    wanted.toLowerCase() === scheme ? '(width >= 0)' : '(width < 0)',
  );

const pinRules = (rules: CSSRuleList, scheme: ColorScheme) => {
  for (const rule of Array.from(rules)) {
    if (rule instanceof CSSMediaRule) {
      const pinned = pinnedMediaText(rule.media.mediaText, scheme);

      if (pinned !== rule.media.mediaText) rule.media.mediaText = pinned;
    }

    if ('cssRules' in rule) pinRules((rule as CSSGroupingRule).cssRules, scheme);
  }
};

const pinSheets = (document: Document, scheme: ColorScheme) => {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      pinRules(sheet.cssRules, scheme);
    } catch {
      // A cross-origin sheet hides its rules.
    }
  }
};

export const pinScheme = (document: Document, scheme: ColorScheme) => {
  document.documentElement.style.colorScheme = scheme;
  pinSheets(document, scheme);

  new MutationObserver((records) => {
    pinSheets(document, scheme);

    for (const record of records)
      for (const node of Array.from(record.addedNodes))
        if (node instanceof HTMLLinkElement) node.addEventListener('load', () => pinSheets(document, scheme));
  }).observe(document.head, { childList: true, subtree: true, characterData: true });
};
