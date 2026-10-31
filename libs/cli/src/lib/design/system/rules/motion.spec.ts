import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';
import { DESIGN_DIR, readConfig } from '../../paths';
import { resolveProduct } from '../resolve-product';
import { badMotionsOf, badUnreachableOf, hardCodedMotionOf, scriptedMotionOf } from './motion';

const acme = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-system-'));

  cpSync(join(__dirname, '../__fixtures__'), target, { recursive: true });

  return target;
};

const write = (target: string, path: string, content: string) => {
  mkdirSync(dirname(join(target, DESIGN_DIR, path)), { recursive: true });
  writeFileSync(join(target, DESIGN_DIR, path), content);
};

const resolveAcme = (target: string) =>
  resolveProduct({ target, name: 'acme', config: readConfig(target)?.products?.['acme'] ?? {} });

const part = (body: string) =>
  `import { definePart } from '@design-system';\n${body}\nexport default definePart({ note: '', states: {}, render: () => ({ body: '', styles: '' }) });\n`;

describe('scriptedMotionOf', () => {
  it('passes the clean fixture, whose hero uses a CSS transition', () => {
    expect(scriptedMotionOf(resolveAcme(acme()))).toEqual([]);
  });

  it('flags requestAnimationFrame and setInterval', () => {
    const target = acme();

    write(target, 'acme/elements/hero/hero.ts', part('window.requestAnimationFrame(() => undefined);'));
    write(target, 'acme/pages/home/home.ts', part('setInterval(() => undefined, 16);'));

    expect(scriptedMotionOf(resolveAcme(target)).map((problem) => problem.message)).toEqual([
      'calls requestAnimationFrame - motion must be CSS animation, CSS transition or the Web Animations API',
      'calls setInterval - motion must be CSS animation, CSS transition or the Web Animations API',
    ]);
  });

  it('flags setTimeout', () => {
    const target = acme();

    write(target, 'acme/elements/hero/hero.ts', part('setTimeout(() => undefined, 200);'));

    expect(scriptedMotionOf(resolveAcme(target)).map((problem) => problem.message)).toEqual([
      'calls setTimeout - motion must be CSS animation, CSS transition or the Web Animations API',
    ]);
  });

  it('leaves the Web Animations API alone', () => {
    const target = acme();

    write(target, 'acme/elements/hero/hero.ts', part('document.body.animate([{ opacity: 0 }, { opacity: 1 }], 200);'));

    expect(scriptedMotionOf(resolveAcme(target))).toEqual([]);
  });
});

describe('hardCodedMotionOf', () => {
  it('passes the clean fixture, whose hero takes its duration from a foundations token', () => {
    expect(hardCodedMotionOf(resolveAcme(acme()))).toEqual([]);
  });

  it('flags a literal duration, delay or easing in CSS and in the styles of a part TS, outside foundations', () => {
    const target = acme();

    write(
      target,
      'acme/elements/hero/hero.css',
      '.acme-hero { transition: opacity 200ms ease-out, color var(--acme-fade) cubic-bezier(0.2, 0, 0, 1); animation-delay: .5s; }',
    );
    write(
      target,
      'acme/pages/home/home.ts',
      part("const styles = '.acme-home { transition: color var(--acme-fade) linear; }';"),
    );
    write(
      target,
      'acme/foundations/palette/palette.ts',
      part("const styles = '.acme-swatch { transition: color 120ms ease; }';"),
    );

    expect(
      hardCodedMotionOf(resolveAcme(target)).map((problem) => `${problem.file.split('/').pop()}: ${problem.message}`),
    ).toEqual([
      'hero.css: transition: 200ms outside foundations - use a foundations motion token',
      'hero.css: transition: ease-out outside foundations - use a foundations motion token',
      'hero.css: transition: cubic-bezier(…) outside foundations - use a foundations motion token',
      'hero.css: animation-delay: .5s outside foundations - use a foundations motion token',
      'home.ts: transition: linear outside foundations - use a foundations motion token',
    ]);
  });

  it('leaves token names that contain an easing keyword alone', () => {
    const target = acme();

    write(
      target,
      'acme/elements/hero/hero.css',
      '.acme-hero { transition: rotate var(--ease-linear-2s) var(--ease); }',
    );

    expect(hardCodedMotionOf(resolveAcme(target))).toEqual([]);
  });
});

describe('badMotionsOf', () => {
  const withMotions = (extra: string) =>
    `import { definePart } from '@design-system';\nexport default definePart({ note: '', states: { closed: {}, open: {} }, ${extra}, render: () => ({ body: '', styles: '' }) });\n`;

  it('passes the clean fixture and a motion between two states that a rule names', () => {
    const target = acme();

    expect(badMotionsOf(resolveAcme(target))).toEqual([]);

    write(
      target,
      'acme/elements/hero/hero.ts',
      withMotions(
        "motions: { fold: { from: 'closed', to: 'open' } }, rules: [{ on: 'click .open', to: 'open', motion: 'fold' }]",
      ),
    );

    expect(badMotionsOf(resolveAcme(target))).toEqual([]);
  });

  it('flags a motion from or to a state the part does not have', () => {
    const target = acme();

    write(
      target,
      'acme/elements/hero/hero.ts',
      withMotions("motions: { fold: { from: 'shut', to: 'open' }, grow: { from: 'closed', to: 'wide' } }"),
    );

    expect(badMotionsOf(resolveAcme(target)).map(({ rule, message }) => `${rule} ${message}`)).toEqual([
      'MOTION-STATE motion "fold" runs to or from "shut", which is no state of the part',
      'MOTION-STATE motion "grow" runs to or from "wide", which is no state of the part',
    ]);
  });

  it('flags a rule that names a motion the part does not declare', () => {
    const target = acme();

    write(
      target,
      'acme/elements/hero/hero.ts',
      withMotions(
        "motions: { fold: { from: 'closed', to: 'open' } }, rules: [{ on: 'click .open', to: 'open', motion: 'unfold' }]",
      ),
    );

    expect(badMotionsOf(resolveAcme(target)).map(({ rule, message }) => `${rule} ${message}`)).toEqual([
      'MOTION-NAME a rule names motion "unfold", which the part does not declare',
    ]);
  });

  it('accepts a looping motion from a state to itself', () => {
    const target = acme();

    write(target, 'acme/elements/hero/hero.ts', withMotions("motions: { spin: { from: 'open', to: 'open' } }"));

    expect(badMotionsOf(resolveAcme(target))).toEqual([]);
  });
});

describe('badUnreachableOf', () => {
  const withUnreachable = (value: string) =>
    `import { definePart } from '@design-system';\nexport default definePart({ note: '', states: { closed: {}, open: {} }, unreachable: ${value}, render: () => ({ body: '', styles: '' }) });\n`;
  const problemsOf = (value: string) => {
    const target = acme();

    write(target, 'acme/elements/hero/hero.ts', withUnreachable(value));

    return badUnreachableOf(resolveAcme(target)).map(({ rule, message }) => `${rule} ${message}`);
  };

  it('passes the clean fixture and a literal pair of known states with a reason', () => {
    expect(badUnreachableOf(resolveAcme(acme()))).toEqual([]);
    expect(problemsOf("[{ from: 'open', to: 'closed', reason: 'The app closes it.' }]")).toEqual([]);
  });

  it('flags an unknown state and a missing or empty reason', () => {
    expect(
      problemsOf(
        "[{ from: 'open', to: 'shut', reason: 'x' }, { from: 'open', to: 'closed' }, { from: 'closed', to: 'open', reason: ' ' }]",
      ),
    ).toEqual([
      'MOTION-UNREACHABLE-STATE unreachable open -> shut names "shut", which is no state of the part',
      'MOTION-UNREACHABLE-REASON unreachable open -> closed gives no reason',
      'MOTION-UNREACHABLE-REASON unreachable closed -> open gives no reason',
    ]);
  });

  it('flags a value that is not written as literals', () => {
    expect(problemsOf('pairs')).toEqual(['MOTION-UNREACHABLE-LITERAL unreachable must be an array literal']);
    expect(problemsOf("[{ from: state, to: 'open', reason: 'x' }, { from: 'open', to: 'closed', reason }]")).toEqual([
      'MOTION-UNREACHABLE-LITERAL an unreachable pair needs from, to and reason as string literals',
      'MOTION-UNREACHABLE-LITERAL an unreachable pair needs from, to and reason as string literals',
    ]);
  });
});
