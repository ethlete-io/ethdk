import { relative } from 'path';
import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';
import { appSourcesOf, ImplementedComponent, implementedComponentsOf } from './implemented-components';
import { KNOWN_UNBOUND_INPUTS, KnownUnboundInput } from './unbound-input-known';

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');

export const tagsOf = (selector: string, texts: string[]): string[] => {
  const tag = new RegExp(`<${escaped(selector)}(?=[\\s/>])((?:[^>"']|"[^"]*"|'[^']*')*)>`, 'gu');

  return texts.flatMap((text) => [...text.matchAll(tag)].map((match) => match[1] as string));
};

export const isBound = (name: string, tags: string[]) =>
  tags.some((attributes) => new RegExp(`(?:\\[\\(?${name}\\)?\\]|(?<![\\w\\[(-])${name}\\s*=)`, 'u').test(attributes));

/** The inputs of `components` that no template in `appDir` binds on the component's own tag, as `UNBOUND-INPUT` problems naming the component file. */
export const unboundInputsOf = (options: { components: ImplementedComponent[]; appDir: string }): Problem[] => {
  const texts = appSourcesOf(options.appDir).map(({ text }) => text);

  return options.components.flatMap(({ file, selector, inputs }) => {
    if (!selector) return [];

    const tags = tagsOf(selector, texts);

    return inputs
      .filter(({ name }) => !isBound(name, tags))
      .map(({ name }) => ({
        rule: 'UNBOUND-INPUT',
        file,
        message: `${name}: input of ${selector} that no template in ${relative(process.cwd(), options.appDir) || options.appDir} binds`,
      }));
  });
};

/** Splits the unbound inputs into errors (not on the known list, or listed but bound again) and warnings (listed). */
export const unboundInputVerdictOf = (options: {
  components: ImplementedComponent[];
  appDir: string;
  known: KnownUnboundInput[];
}): { errors: Problem[]; warnings: Problem[] } => {
  const found = unboundInputsOf(options);
  const keyOf = (file: string, input: string) => `${file}#${input}`;
  const listed = new Set(options.known.map(({ file, input }) => keyOf(file, input)));
  const hits = new Set(found.map((problem) => keyOf(problem.file, problem.message.split(':')[0] as string)));
  const files = new Set(options.components.map(({ file }) => file));

  return {
    errors: [
      ...found.filter((problem) => !listed.has(keyOf(problem.file, problem.message.split(':')[0] as string))),
      ...options.known
        .filter(({ file, input }) => files.has(file) && !hits.has(keyOf(file, input)))
        .map(({ file, input }) => ({
          rule: 'UNBOUND-INPUT',
          file,
          message: `${input}: listed as a known unbound input but it is bound (or gone) - remove it from KNOWN_UNBOUND_INPUTS`,
        })),
    ],
    warnings: found.flatMap((problem) => {
      const input = problem.message.split(':')[0] as string;
      const known = options.known.find((entry) => keyOf(entry.file, entry.input) === keyOf(problem.file, input));

      return known
        ? [{ ...problem, message: `${problem.message} (known${known.reason ? `: ${known.reason}` : ''})` }]
        : [];
    }),
  };
};

const verdictsOf = (product: ResolvedProduct) =>
  implementedComponentsOf(product).map(({ components, appDir }) =>
    unboundInputVerdictOf({ components, appDir, known: KNOWN_UNBOUND_INPUTS }),
  );

/** An input of an app component that implements a part which no app template binds and the known list does not carry, or a listed one that is bound again (`UNBOUND-INPUT`). */
export const unboundInputProblemsOf = (product: ResolvedProduct): Problem[] =>
  verdictsOf(product).flatMap((verdict) => verdict.errors);

/** One warning per known unbound input. */
export const unboundInputWarningsOf = (product: ResolvedProduct): Problem[] =>
  verdictsOf(product).flatMap((verdict) => verdict.warnings);
