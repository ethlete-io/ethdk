/**
 * One configured option of a feature, as the devtools render it (`interval · 5s`). Values are
 * pre-rendered strings so the panel never has to know a feature's option shape.
 */
export type QueryDevtoolsFeatureDetail = {
  label: string;
  value: string;
};

/**
 * A feature applied to a query, stack or auth provider, together with how it was configured. `type`
 * is the feature's `*_FEATURE_TYPE` constant (`WITH_POLLING`, `PERSISTENT_AUTH`, …).
 */
export type QueryDevtoolsFeature = {
  type: string;
  details: QueryDevtoolsFeatureDetail[];
};

/**
 * Describes how a feature was configured. Only ever called while building a devtools entry, so a
 * feature may render whatever it needs to here without paying for it when devtools are off.
 */
export type QueryDevtoolsFeatureDescriber = () => QueryDevtoolsFeatureDetail[];

/** A feature as the devtools read it: its type plus its optional self-description. */
export type DescribableFeature = {
  type: string;
  devtools?: QueryDevtoolsFeatureDescriber;
};

/**
 * Turns the features applied at creation into their devtools representation.
 * @internal
 */
export const describeQueryDevtoolsFeatures = (
  features: readonly DescribableFeature[] | undefined,
): QueryDevtoolsFeature[] =>
  features?.map((feature) => ({ type: feature.type, details: feature.devtools?.() ?? [] })) ?? [];

/**
 * Renders a millisecond duration the way feature details spell one out - `500ms`, `1.5s`, `15m`.
 * @internal
 */
export const formatQueryDevtoolsDuration = (ms: number) => {
  if (!Number.isFinite(ms)) return String(ms);
  if (ms < 1000) return `${ms}ms`;

  const round = (value: number, unit: string) => `${Number(value.toFixed(1))}${unit}`;

  if (ms < 60_000) return round(ms / 1000, 's');
  if (ms < 3_600_000) return round(ms / 60_000, 'm');

  return round(ms / 3_600_000, 'h');
};

/**
 * The name of a function passed as `options.<key>`, or `null` when it is an inline lambda. An inline
 * `{ handler: (e) => … }` inherits the name `handler` from the key it is assigned to, which tells the
 * reader nothing - a reference to a declared function does.
 */
const queryDevtoolsFnName = (fn: unknown, key: string) => {
  const name = typeof fn === 'function' ? fn.name.replace(/^bound /, '') : '';

  return !name || name === key ? null : name;
};

/**
 * A detail for the function passed as `options.<key>`, omitted when it is an inline lambda.
 * @internal
 */
export const queryDevtoolsFnDetail = (fn: unknown, key: string): QueryDevtoolsFeatureDetail[] => {
  const name = queryDevtoolsFnName(fn, key);

  return name ? [{ label: key, value: name }] : [];
};
