/**
 * The query-error labels no longer resolve German automatically from the locale — the default is the
 * English status tables only, and German is an explicit `provideQueryErrorLabels(queryErrorLabelsForLocale)`
 * (or `GERMAN_QUERY_ERROR_LABELS`) opt-in. Whether an app wants German back is a product decision, so this
 * migration only finds the affected sites and reports them; it rewrites nothing.
 */

export type QueryErrorLabelsTask = {
  id: string;
  file: string;
  line: number;
  message: string;
};

const USAGE_MARKERS = [
  'et-query-error',
  'etQueryError',
  'QueryErrorComponent',
  'QueryErrorDirective',
  'QUERY_ERROR_IMPORTS',
  'injectQueryErrorLabels',
] as const;

const OPT_IN_MARKER = 'provideQueryErrorLabels';

export type QueryErrorLabelsScan = {
  usages: QueryErrorLabelsTask[];
  hasLabelProvider: boolean;
};

export const scanQueryErrorLabelsInFile = (filePath: string, content: string): QueryErrorLabelsScan => {
  const usages: QueryErrorLabelsTask[] = [];

  const marker = USAGE_MARKERS.find((m) => content.includes(m));

  if (marker) {
    const line = content.slice(0, content.indexOf(marker)).split('\n').length;

    usages.push({
      id: `query-error-labels--${filePath.replace(/[^a-zA-Z0-9]+/g, '-')}`,
      file: filePath,
      line,
      message: `Uses the query-error UI (\`${marker}\`). Its titles and fallback messages are English-only by default now.`,
    });
  }

  return { usages, hasLabelProvider: content.includes(OPT_IN_MARKER) };
};
