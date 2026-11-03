import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';
import { ImplementedComponent, implementedComponentsOf } from './implemented-components';
import { KNOWN_SAMPLE_DEFAULTS, KnownSampleDefault } from './sample-default-known';

const SAMPLE_IDENTIFIER = /(?<![\w.])[A-Z][A-Z0-9_]*_(?:SAMPLE|ROWS)\b/u;

/** The inputs of `components` whose default is sample data (an `…_SAMPLE` or `…_ROWS` identifier), as `SAMPLE-DEFAULT` problems. */
export const sampleDefaultsOf = (components: ImplementedComponent[]): Problem[] =>
  components.flatMap(({ file, inputs }) =>
    inputs.flatMap(({ name, initializer }) => {
      const sample = initializer.match(SAMPLE_IDENTIFIER)?.[0];

      return sample
        ? [{ rule: 'SAMPLE-DEFAULT', file, message: `${name}: defaults to the sample data ${sample}` }]
        : [];
    }),
  );

export const sampleDefaultVerdictOf = (options: {
  components: ImplementedComponent[];
  known: KnownSampleDefault[];
}): { errors: Problem[]; warnings: Problem[] } => {
  const found = sampleDefaultsOf(options.components);
  const keyOf = (file: string, input: string) => `${file}#${input}`;
  const nameOf = (problem: Problem) => problem.message.split(':')[0] as string;
  const listed = new Set(options.known.map(({ file, input }) => keyOf(file, input)));
  const hits = new Set(found.map((problem) => keyOf(problem.file, nameOf(problem))));
  const files = new Set(options.components.map(({ file }) => file));

  return {
    errors: [
      ...found.filter((problem) => !listed.has(keyOf(problem.file, nameOf(problem)))),
      ...options.known
        .filter(({ file, input }) => files.has(file) && !hits.has(keyOf(file, input)))
        .map(({ file, input }) => ({
          rule: 'SAMPLE-DEFAULT',
          file,
          message: `${input}: listed as a known sample default but it has none any more - remove it from KNOWN_SAMPLE_DEFAULTS`,
        })),
    ],
    warnings: found
      .filter((problem) => listed.has(keyOf(problem.file, nameOf(problem))))
      .map((problem) => ({ ...problem, message: `${problem.message} (known)` })),
  };
};

const verdictsOf = (product: ResolvedProduct) =>
  implementedComponentsOf(product).map(({ components }) =>
    sampleDefaultVerdictOf({ components, known: KNOWN_SAMPLE_DEFAULTS }),
  );

/** An input of an app component that implements a part and defaults to sample data, unless the known list carries it, or a listed one that no longer does (`SAMPLE-DEFAULT`). */
export const sampleDefaultProblemsOf = (product: ResolvedProduct): Problem[] =>
  verdictsOf(product).flatMap((verdict) => verdict.errors);

/** One warning per known sample default. */
export const sampleDefaultWarningsOf = (product: ResolvedProduct): Problem[] =>
  verdictsOf(product).flatMap((verdict) => verdict.warnings);
