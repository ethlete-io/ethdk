import { cssBlocksOf, declarationValueOf } from '../css-source';
import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';
import { motionRefsOf, stateNamesOf } from '../sketch/part-definition';
import { calledNamesOf, textsOf } from '../ts-source';

const TIMED = ['requestAnimationFrame', 'setInterval', 'setTimeout'];

/** A part that drives motion from script frames, which a timeline cannot stop at a given time. */
export const scriptedMotionOf = (product: ResolvedProduct): Problem[] =>
  product.parts.flatMap((part) =>
    [...new Set(calledNamesOf(part.source).filter((name) => TIMED.includes(name)))].map((name) => ({
      rule: 'MOTION',
      file: part.file,
      message: `calls ${name} - motion must be CSS animation, CSS transition or the Web Animations API`,
    })),
  );

/** A part whose motion runs between a state it does not have, or whose rule names a motion it does not declare. */
export const badMotionsOf = (product: ResolvedProduct): Problem[] =>
  product.parts.flatMap((part) => {
    const states = stateNamesOf(part.source);
    const { motions, ruleMotions } = motionRefsOf(part.source);
    const problem = (rule: string, message: string): Problem => ({ rule, file: part.file, message });

    return [
      ...(states
        ? motions.flatMap(({ name, from, to }) =>
            [from, to].flatMap((state) =>
              state !== null && !states.includes(state)
                ? [
                    problem(
                      'MOTION-STATE',
                      `motion "${name}" runs to or from "${state}", which is no state of the part`,
                    ),
                  ]
                : [],
            ),
          )
        : []),
      ...ruleMotions.flatMap((name) =>
        motions.some((motion) => motion.name === name)
          ? []
          : [problem('MOTION-NAME', `a rule names motion "${name}", which the part does not declare`)],
      ),
    ];
  });

const TIMING = /^(transition|animation)(-duration|-delay|-timing-function)?$/;

const LITERAL =
  /(?<![\w-])(?:(?:\d*\.?\d+m?s|ease(?:-in|-out|-in-out)?|linear|step-start|step-end)(?![\w(-])|(?:cubic-bezier|steps|linear)\()/g;

const literalTimingsOf = (css: string) =>
  cssBlocksOf(css).declarations.flatMap((declaration) => {
    const property = declaration.slice(0, declaration.indexOf(':')).trim();

    if (!TIMING.test(property)) return [];

    const value = (declarationValueOf(declaration) ?? '').replace(/--[\w-]+/g, '');

    return [...value.matchAll(LITERAL)].map(([literal]) => `${property}: ${literal.replace(/\($/, '(…)')}`);
  });

const timingProblemsOf = (file: string, literals: string[]): Problem[] =>
  [...new Set(literals)].map((literal) => ({
    rule: 'HARD-CODED-MOTION',
    file,
    message: `${literal} outside foundations - use a foundations motion token`,
  }));

/** A literal duration, delay or easing in a transition or animation of a part outside foundations, in its CSS or in the CSS of its TS. */
export const hardCodedMotionOf = (product: ResolvedProduct): Problem[] =>
  product.parts
    .filter((part) => part.layer !== 'foundations')
    .flatMap((part) => [
      ...timingProblemsOf(part.file, textsOf(part.source).flatMap(literalTimingsOf)),
      ...(part.css && part.cssSource ? timingProblemsOf(part.css, literalTimingsOf(part.cssSource)) : []),
    ]);
