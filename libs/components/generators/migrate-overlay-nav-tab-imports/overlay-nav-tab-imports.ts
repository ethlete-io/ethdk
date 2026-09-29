const COMPONENTS_IMPORT = /import\s*\{([^}]*)\}\s*from\s*['"]@ethlete\/components['"]/g;
const NAV_TAB_IMPORTS = /\bNAV_TAB_IMPORTS\b/;
const OVERLAY_LINK = 'et-overlay-nav-tab-link';

export const TEMPLATE_URL = /templateUrl\s*:\s*['"]([^'"]+)['"]/g;

/**
 * Returns the file with `OVERLAY_NAV_TAB_IMPORTS` added next to every `NAV_TAB_IMPORTS`, or `null` when the
 * file does not import `NAV_TAB_IMPORTS` from `@ethlete/components` or none of its templates renders an
 * `et-overlay-nav-tab-link`.
 */
export const addOverlayNavTabImportsToFile = (content: string, externalTemplates: string[]): string | null => {
  if (content.includes('OVERLAY_NAV_TAB_IMPORTS')) return null;

  const importStatement = [...content.matchAll(COMPONENTS_IMPORT)].find(
    (match) => NAV_TAB_IMPORTS.test(match[1] ?? '') && !/\bNAV_TAB_IMPORTS\s+as\b/.test(match[1] ?? ''),
  );

  if (!importStatement || importStatement.index === undefined) return null;
  if (!content.includes(OVERLAY_LINK) && !externalTemplates.some((template) => template.includes(OVERLAY_LINK))) {
    return null;
  }

  const start = importStatement.index;
  const end = start + importStatement[0].length;
  const rewrittenImport = importStatement[0].replace(NAV_TAB_IMPORTS, 'NAV_TAB_IMPORTS, OVERLAY_NAV_TAB_IMPORTS');
  const addNextToUsage = (code: string) =>
    code.replace(
      /(\.\.\.)?\bNAV_TAB_IMPORTS\b/g,
      (_, spread: string | undefined) => `${spread ?? ''}NAV_TAB_IMPORTS, ${spread ?? ''}OVERLAY_NAV_TAB_IMPORTS`,
    );

  return addNextToUsage(content.slice(0, start)) + rewrittenImport + addNextToUsage(content.slice(end));
};
