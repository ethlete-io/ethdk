const COMPONENTS_IMPORT = /from\s*['"]@ethlete\/components(?:\/[^'"]*)?['"]/;
const BASELINE_Y = /(\.\s*)baselineY\b/g;

export const TEMPLATE_URL = /templateUrl\s*:\s*['"]([^'"]+)['"]/g;

export const importsEthleteComponents = (content: string) => COMPONENTS_IMPORT.test(content);

/** Returns the source or template with every `.baselineY` renamed to `.baseline`, or `null` when there is none. */
export const renameBaselineY = (content: string): string | null => {
  const next = content.replace(BASELINE_Y, '$1baseline');

  return next === content ? null : next;
};
