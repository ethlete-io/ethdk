import { describe, expect, it } from 'vitest';
import { componentInputsOf, droppedStatePropsOf } from './dropped-props';

describe('componentInputsOf', () => {
  it('reads signal inputs, models, decorated inputs and aliases', () => {
    const source = `
      @Component({ selector: 'x', template: '' })
      export class X {
        percent = input(100);
        size = input.required<string>();
        open = model(false);
        label = input('', { alias: 'text' });
        @Input() legacy = 1;
        @Input('named') other = 2;
        zoomIn = output();
      }`;

    expect(componentInputsOf(source)).toEqual(['percent', 'size', 'open', 'text', 'legacy', 'named']);
  });

  it('gives up on a component whose inputs are not all in its source', () => {
    expect(componentInputsOf(`@Component({}) export class X extends Base { a = input(1); }`)).toBeNull();
    expect(
      componentInputsOf(
        `@Component({ hostDirectives: [{ directive: D, inputs: ['a'] }] }) export class X { a = input(1); }`,
      ),
    ).toBeNull();
  });
});

describe('droppedStatePropsOf', () => {
  const states = {
    out: { percent: 25, target: 'out' },
    reset: { percent: 100, target: 'reset' },
    'out-hover': { percent: 25, target: 'out', interaction: 'hover' },
  };

  it('reports a varying prop with no input, as compare would drop it', () => {
    expect(droppedStatePropsOf({ states, inputs: ['percent'] })).toEqual(
      new Map([
        ['out', ['target']],
        ['reset', ['target']],
        ['out-hover', ['target']],
      ]),
    );
  });

  it('treats a state named after an interaction as forcing it', () => {
    expect(
      droppedStatePropsOf({ states: { rest: { n: 1 }, 'open-focus-visible': { n: 1, focus: true } }, inputs: ['n'] })
        .size,
    ).toBe(0);
  });

  it('passes a prop set to selected', () => {
    expect(droppedStatePropsOf({ states: { a: { option: 'x' }, b: { option: 'selected' } }, inputs: [] }).size).toBe(1);
  });

  it('passes props the component takes, class, props every state sets alike and forcing-only props', () => {
    expect(droppedStatePropsOf({ states, inputs: ['percent', 'target'] }).size).toBe(0);
    expect(
      droppedStatePropsOf({ states: { a: { class: 'x', mode: 1 }, b: { class: 'y', mode: 1 } }, inputs: [] }).size,
    ).toBe(0);
    expect(
      droppedStatePropsOf({ states: { rest: { n: 1 }, hover: { n: 1, interaction: 'hover' } }, inputs: ['n'] }).size,
    ).toBe(0);
  });
});
