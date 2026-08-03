import { MigrationEntry } from './migration-map.js';
import {
  LEGACY_SPINNER_COLOR_VARIABLE,
  LEGACY_SPINNER_TAG,
  lineOfIndex,
  PICTURE_TAG,
  SPINNER_TAG,
} from './templates.js';

export const DOCS_BASE_URL = 'https://ethlete-sdk-docs.web.app';

export type ReportSite = {
  file: string;
  line: number;
  detail?: string;
};

/**
 * Which of the two picture sizing modes a class value expresses. `fit` needs a definite box in both axes;
 * `element-classes` is the mode where the image sizes its own box and `fit` would break the layout.
 */
export type PictureClassMode = 'fit' | 'element-classes' | 'unclassified';

export type PictureClassSite = ReportSite & {
  input: string;
  value: string | null;
  mode: PictureClassMode;
};

export type SymbolSites = {
  entry: MigrationEntry;
  sites: ReportSite[];
};

export type MigrationReport = {
  picturesWithoutAlt: ReportSite[];
  pictureClassInputs: PictureClassSite[];
  themedSpinners: ReportSite[];
  spinnerModeBindings: ReportSite[];
  judgmentSymbols: Map<string, SymbolSites>;
  gatedSymbols: Map<string, SymbolSites>;
};

export type ReportContext = {
  installedVersions: Record<string, string | null>;
  rewrittenFiles: number;
};

export const createEmptyReport = (): MigrationReport => ({
  picturesWithoutAlt: [],
  pictureClassInputs: [],
  themedSpinners: [],
  spinnerModeBindings: [],
  judgmentSymbols: new Map(),
  gatedSymbols: new Map(),
});

export const isReportEmpty = (report: MigrationReport) =>
  report.picturesWithoutAlt.length === 0 &&
  report.pictureClassInputs.length === 0 &&
  report.themedSpinners.length === 0 &&
  report.spinnerModeBindings.length === 0 &&
  report.judgmentSymbols.size === 0 &&
  report.gatedSymbols.size === 0;

const PICTURE_CLASS_INPUTS = ['imgClass', 'figureClass', 'pictureClass', 'figcaptionClass'] as const;

const VARIANT_PREFIX = /^([\w-]+:)+/;
const INDEFINITE_SIZES = new Set(['auto', 'min', 'max', 'fit']);

export const classifyImgClass = (value: string | null): PictureClassMode => {
  if (!value) return 'unclassified';

  const tokens = value.split(/\s+/).filter(Boolean);

  let definiteWidth = false;
  let definiteHeight = false;
  let hasAspect = false;
  let hasConstraint = false;
  let hasIndefiniteAxis = false;
  let hasResponsiveSizing = false;

  for (const rawToken of tokens) {
    const hasVariant = VARIANT_PREFIX.test(rawToken);
    const token = rawToken.replace(VARIANT_PREFIX, '');
    const axis = /^(w|h|size)-(.+)$/.exec(token);
    const constraint = /^(?:max|min)-(?:w|h)-(.+)$/.exec(token);
    const aspect = /^aspect-(.+)$/.exec(token);

    if (!axis && !constraint && !aspect) continue;

    // A sizing class behind a breakpoint or a state is a judgment call, not a mode.
    if (hasVariant) {
      hasResponsiveSizing = true;
      continue;
    }

    if (constraint) {
      hasConstraint = true;
      continue;
    }

    if (aspect) {
      hasAspect ||= aspect[1] !== 'auto';
      continue;
    }

    const [, prefix, size] = axis!;

    if (INDEFINITE_SIZES.has(size!)) {
      hasIndefiniteAxis = true;
      continue;
    }

    definiteWidth ||= prefix === 'w' || prefix === 'size';
    definiteHeight ||= prefix === 'h' || prefix === 'size';
  }

  if (hasResponsiveSizing) return 'unclassified';
  if ((definiteWidth && definiteHeight) || ((definiteWidth || definiteHeight) && hasAspect)) return 'fit';
  if (definiteWidth || definiteHeight || hasConstraint || hasIndefiniteAxis) return 'element-classes';

  return 'unclassified';
};

const forEachOpeningTag = (template: string, tagName: string, visit: (tag: string, index: number) => void) => {
  const pattern = new RegExp(`<${tagName}(?=[\\s/>])[^>]*>`, 'g');
  let match = pattern.exec(template);

  while (match) {
    visit(match[0], match.index);
    match = pattern.exec(template);
  }
};

/** The class list an attribute spells out, or `null` when only an expression knows it. */
const classListOf = (quotedValue: string, isBound: boolean) => {
  const inner = quotedValue.slice(1, -1);

  if (!isBound) return inner;

  const literal = /^'([^']*)'$/.exec(inner.trim());

  return literal ? literal[1]! : null;
};

export type TemplateScanOptions = {
  file: string;

  /** Line the scanned text starts on, so inline templates report their file's line. */
  startLine: number;
};

export const scanTemplate = (report: MigrationReport, template: string, { file, startLine }: TemplateScanOptions) => {
  const lineAt = (index: number) => startLine + lineOfIndex(template, index) - 1;

  forEachOpeningTag(template, PICTURE_TAG, (tag, index) => {
    if (!/(^|\s)\[?alt\]?\s*=/.test(tag)) {
      report.picturesWithoutAlt.push({ file, line: lineAt(index) });
    }

    const attributePattern = new RegExp(
      `\\s\\[?(${PICTURE_CLASS_INPUTS.join('|')})\\]?\\s*=\\s*("[^"]*"|'[^']*')`,
      'g',
    );

    let match = attributePattern.exec(tag);

    while (match) {
      const input = match[1]!;
      const value = classListOf(match[2]!, match[0].includes('['));

      report.pictureClassInputs.push({
        file,
        line: lineAt(index),
        input,
        value,
        mode: input === 'imgClass' ? classifyImgClass(value) : 'unclassified',
      });

      match = attributePattern.exec(tag);
    }
  });

  for (const tagName of [SPINNER_TAG, LEGACY_SPINNER_TAG]) {
    forEachOpeningTag(template, tagName, (tag, index) => {
      if (/\s\[mode\]\s*=/.test(tag) && !/\s\[mode\]\s*=\s*(["'])'(in)?determinate'\1/.test(tag)) {
        report.spinnerModeBindings.push({ file, line: lineAt(index) });
      }
    });
  }
};

export const scanStyleSheet = (report: MigrationReport, styles: string, { file, startLine }: TemplateScanOptions) => {
  const lineAt = (index: number) => startLine + lineOfIndex(styles, index) - 1;
  const variablePattern = new RegExp(`${LEGACY_SPINNER_COLOR_VARIABLE}(-\\d+)?`, 'g');
  let variableMatch = variablePattern.exec(styles);

  while (variableMatch) {
    report.themedSpinners.push({
      file,
      line: lineAt(variableMatch.index),
      detail: variableMatch[1]
        ? `\`${variableMatch[0]}\` belonged to \`multiColor\`, which has no successor - drop it.`
        : `\`${variableMatch[0]}\` was rewritten to \`--et-spinner-color\`.`,
    });

    variableMatch = variablePattern.exec(styles);
  }

  const blockPattern = /([^{}]+)\{([^{}]*)\}/g;
  let blockMatch = blockPattern.exec(styles);

  while (blockMatch) {
    if (blockMatch[1]!.includes('.et-legacy') && /(^|[\s;])(--)?[\w-]*color\s*:/.test(blockMatch[2]!)) {
      const selectorOffset = blockMatch[1]!.length - blockMatch[1]!.trimStart().length;

      report.themedSpinners.push({
        file,
        line: lineAt(blockMatch.index + selectorOffset),
        detail: `\`${blockMatch[1]!.trim().replace(/\s+/g, ' ')}\` colours a legacy-themed element.`,
      });
    }

    blockMatch = blockPattern.exec(styles);
  }
};

export const addSymbolSite = (
  target: Map<string, SymbolSites>,
  symbol: string,
  entry: MigrationEntry,
  site: ReportSite,
) => {
  const existing = target.get(symbol);

  if (existing) {
    existing.sites.push(site);

    return;
  }

  target.set(symbol, { entry, sites: [site] });
};

const renderSites = (sites: readonly ReportSite[]) =>
  sites.map((site) => `- \`${site.file}:${site.line}\`${site.detail ? ` - ${site.detail}` : ''}`);

const renderDocsLink = (entry: MigrationEntry) => (entry.docs ? ` See ${DOCS_BASE_URL}${entry.docs}.` : '');

const renderSymbolSection = (symbols: Map<string, SymbolSites>, describe: (entry: MigrationEntry) => string) =>
  [...symbols.entries()].flatMap(([symbol, { entry, sites }]) => [
    `### \`${symbol}\``,
    '',
    describe(entry),
    ...(entry.note ? ['', entry.note] : []),
    '',
    ...renderSites(sites),
    '',
  ]);

const renderPictureClassGroup = (sites: readonly PictureClassSite[], heading: string, guidance: readonly string[]) => {
  if (sites.length === 0) return [];

  return [
    `### ${heading}`,
    '',
    ...guidance,
    '',
    ...sites.map(
      (site) =>
        `- \`${site.file}:${site.line}\` - \`${site.input}\`${site.value === null ? ' (bound expression)' : `="${site.value}"`}`,
    ),
    '',
  ];
};

export const renderReport = (report: MigrationReport, context: ReportContext) => {
  const pictureClassSites = report.pictureClassInputs;
  const fitSites = pictureClassSites.filter((site) => site.input === 'imgClass' && site.mode === 'fit');
  const elementClassSites = pictureClassSites.filter(
    (site) => site.input === 'imgClass' && site.mode === 'element-classes',
  );
  const unclassifiedSites = pictureClassSites.filter(
    (site) => site.input === 'imgClass' && site.mode === 'unclassified',
  );
  const wrapperClassSites = pictureClassSites.filter((site) => site.input !== 'imgClass');

  const versionLines = Object.entries(context.installedVersions).map(
    ([packageName, version]) =>
      `- \`${packageName}\`: ${version ?? 'not declared in `package.json` - version-gated rewrites were applied unverified'}`,
  );

  return [
    '# Migrating off @ethlete/cdk: what is left to do',
    '',
    `The generator rewrote the mechanical parts (${context.rewrittenFiles} file(s)). Everything below needs a decision`,
    'it cannot make. Symbols whose contract changed keep importing from `@ethlete/cdk` on purpose - switch the',
    'import once the call site matches the successor API.',
    '',
    'Installed versions the version gate compared against:',
    '',
    ...versionLines,
    '',
    ...(report.picturesWithoutAlt.length > 0
      ? [
          '## `<et-picture>` without `alt`',
          '',
          '`alt` is required on the components picture. Passing `""` is allowed and means the image is decorative -',
          'a deliberate statement that it carries no information, not a placeholder for text nobody wrote yet. Which',
          'of the two a site needs is a product decision.',
          '',
          ...renderSites(report.picturesWithoutAlt),
          '',
        ]
      : []),
    ...(report.themedSpinners.length > 0
      ? [
          '## Themed spinners',
          '',
          'The cdk spinner defaulted to a themed `#1e88e5`; the components spinner defaults to `currentColor`. A',
          'spinner that should carry a theme colour needs the `color` input (`<et-spinner color="brand" />`); one',
          `inside a button or a link is usually better off inheriting. See ${DOCS_BASE_URL}/components/loader.`,
          '',
          ...renderSites(report.themedSpinners),
          '',
        ]
      : []),
    ...(report.spinnerModeBindings.length > 0
      ? [
          '## Spinner `[mode]` bindings',
          '',
          'A bound `mode` cannot be rewritten mechanically. `mode` split into the `determinate` boolean, so',
          '`[mode]="expr"` becomes `[determinate]="expr === \'determinate\'"` (or whatever the expression meant).',
          '',
          ...renderSites(report.spinnerModeBindings),
          '',
        ]
      : []),
    ...(pictureClassSites.length > 0
      ? [
          '## Picture class inputs',
          '',
          '`imgClass` / `pictureClass` / `figureClass` / `figcaptionClass` are gone. There are two replacements and',
          'they are not interchangeable: `fit` needs a definite box in both axes, so using it where the image sizes',
          'its own box collapses the layout. Each site below is grouped by what its classes actually express.',
          '',
          ...renderPictureClassGroup(fitSites, 'Definite in both axes - use `fit`', [
            'Move the box classes to the host (`<et-picture class="size-8" fit="cover">`) and let `fit` decide what the',
            'image does inside that box.',
          ]),
          ...renderPictureClassGroup(elementClassSites, 'Image sizes its own box - style `.et-picture-img`', [
            'These constrain one axis (`max-h-*`, `w-auto`, a single axis) and let the image resolve the other. `fit`',
            'cannot express that. Style the element class directly - `[&_.et-picture-img]:max-h-41` - which is',
            'documented, stable API.',
          ]),
          ...renderPictureClassGroup(unclassifiedSites, 'Unclassified - decide per site', [
            'The value is a bound expression, responsive, or says nothing about sizing. Either move the classes to the',
            `host and add \`fit\`, or style \`.et-picture-img\` directly. See ${DOCS_BASE_URL}/components/picture.`,
          ]),
          ...renderPictureClassGroup(wrapperClassSites, 'Wrapper classes', [
            'The `<figure>`, `<picture>` and `<figcaption>` passthroughs have no successor input. Put layout classes on',
            'the host, or target `.et-picture-figure` / `.et-picture-picture` / `.et-picture-figcaption`.',
          ]),
        ]
      : []),
    ...(report.gatedSymbols.size > 0
      ? [
          '## Successors that need a newer package',
          '',
          'These imports were left untouched: the successor does not exist in the version this workspace has',
          'installed. Upgrade, then re-run the generator.',
          '',
          ...renderSymbolSection(report.gatedSymbols, (entry) => {
            const installed = context.installedVersions[entry.package ?? ''] ?? 'unknown';

            return `\`${entry.to}\` requires \`${entry.package}\` ≥ ${entry.since} (installed: ${installed}).${renderDocsLink(entry)}`;
          }),
        ]
      : []),
    ...(report.judgmentSymbols.size > 0
      ? [
          '## Symbols whose contract changed',
          '',
          'Renaming the import is not enough for these - the successor behaves differently, or several symbols',
          'replace one.',
          '',
          ...renderSymbolSection(report.judgmentSymbols, (entry) => {
            const successor = entry.kind === 'reshape' ? `stays \`${entry.to}\`` : `becomes \`${entry.to}\``;

            return `${entry.kind}: ${successor} in \`${entry.package}\`.${renderDocsLink(entry)}`;
          }),
        ]
      : []),
  ].join('\n');
};
