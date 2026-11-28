import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
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

const LITERAL_CONSTANT =
  /^\s+(?:(?:public|protected|private|static|readonly)\s+)+([A-Z][A-Z0-9_]*)\s*(?::[^=\n]+)?=\s*['"[{]/gmu;
const FALLBACK_OPERATORS = [/\?\?\s*([^;\n]*)/u, /\|\|\s*([^;\n]*)/u, /(?<!\?)\?(?![?.])[^:?\n]*:\s*([^;\n]*)/u];
const TERNARY_THEN = /(?<!\?)\?(?![?.])\s*([^:?\n]*):/u;

const referencesSample = (operand: string, constants: Set<string>) => {
  if (SAMPLE_IDENTIFIER.test(operand)) return true;

  const name = operand.trim().match(/^(?:this\.)?([A-Z][A-Z0-9_]*)\b/u)?.[1];

  return !!name && constants.has(name);
};

/** The expressions of `sources` that fall back to a sample constant (`_SAMPLE`, `_ROWS` or a literal `UPPER_CASE` class field of the file) via `??`, `||` or a ternary, as `SAMPLE-DEFAULT` problems. */
export const sampleFallbacksOf = (sources: { file: string; text: string }[]): Problem[] =>
  sources.flatMap(({ file, text }) => {
    const constants = new Set([...text.matchAll(LITERAL_CONSTANT)].map((match) => match[1] as string));

    return text.split('\n').flatMap((line, index) => {
      if (/^\s*(?:\/\/|\*|\/\*)/u.test(line) || /=\s*(?:input|model)\b/u.test(line)) return [];

      const operands = [
        ...FALLBACK_OPERATORS.map((pattern) => line.match(pattern)?.[1]),
        line.match(TERNARY_THEN)?.[1],
      ].filter((operand): operand is string => !!operand);
      const hit = operands.find((operand) => referencesSample(operand, constants));

      return hit
        ? [
            {
              rule: 'SAMPLE-DEFAULT',
              file,
              message: `line ${index + 1}: falls back to the sample constant ${hit.trim().replace(/[),;\s]+$/u, '')} - an unbound input must stay empty`,
            },
          ]
        : [];
    });
  });

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
  implementedComponentsOf(product).map(({ checkout, components }) => {
    const verdict = sampleDefaultVerdictOf({ components, known: KNOWN_SAMPLE_DEFAULTS });
    const sources = components
      .flatMap(({ file }) => [file, file.replace(/\.ts$/u, '.html')])
      .flatMap((file) => {
        const path = resolve(checkout, file);

        return existsSync(path) ? [{ file, text: readFileSync(path, 'utf8') }] : [];
      });

    return { ...verdict, errors: [...verdict.errors, ...sampleFallbacksOf(sources)] };
  });

/** An input of an app component that implements a part and defaults to sample data, unless the known list carries it, or a listed one that no longer does (`SAMPLE-DEFAULT`). */
export const sampleDefaultProblemsOf = (product: ResolvedProduct): Problem[] =>
  verdictsOf(product).flatMap((verdict) => verdict.errors);

/** One warning per known sample default. */
export const sampleDefaultWarningsOf = (product: ResolvedProduct): Problem[] =>
  verdictsOf(product).flatMap((verdict) => verdict.warnings);
