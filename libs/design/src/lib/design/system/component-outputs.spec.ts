import { actionFailureOf } from './actions';
import { componentOutputsOf, modelChangesForOf } from './component-outputs';

const SKETCHES = `
@Component({ selector: 'ethlete-sketches', template: '' })
export class SketchesComponent {
  public sameOpen = model(false);
  public picked = model<string | null>(null, { alias: 'selected' });
  public discard = output();
  public merge = output<string>({ alias: 'mergeVariant' });
  @Output() public legacy = new EventEmitter<void>();
  @Output('renamed') public other = new EventEmitter<void>();
  public label = input('');
}
`;

describe('componentOutputsOf', () => {
  it('maps each model() to an input plus a <name>Change output', () => {
    expect(componentOutputsOf(SKETCHES)).toEqual({
      outputs: ['sameOpenChange', 'selectedChange', 'discard', 'mergeVariant', 'legacy', 'renamed'],
      models: ['sameOpen', 'selected'],
    });
  });

  it('cannot tell the outputs of a class that extends another', () => {
    expect(componentOutputsOf(`@Component({}) export class A extends B { public x = output(); }`)).toBeNull();
  });
});

describe('modelChangesForOf', () => {
  const app = componentOutputsOf(SKETCHES);
  const states = { unchanged: { same: ['b'] }, 'unchanged-open': { same: ['b'], sameOpen: true } };

  it('lets the change output of a model the design sets as a prop stand for an emit the app lacks', () => {
    expect(modelChangesForOf({ output: 'sameToggle', app, states })).toEqual(['sameOpenChange']);
  });

  it('keeps a declared emit the app has, and models the design never sets', () => {
    expect(modelChangesForOf({ output: 'discard', app, states })).toEqual([]);
    expect(modelChangesForOf({ output: 'sameToggle', app, states: { a: { same: [] } } })).toEqual([]);
    expect(modelChangesForOf({ output: 'sameToggle', app: null, states })).toEqual([]);
  });
});

describe('actionFailureOf with a model', () => {
  const outcome = { emitted: ['openChange', 'sameOpenChange'], prevented: false, compare: null };
  const action = { kind: 'emit', output: 'sameToggle' } as const;

  it('reaches the declared emit through the change output of the bound model', () => {
    expect(
      actionFailureOf({ action, target: '', input: 'click', outcome, modelChanges: ['sameOpenChange'] }),
    ).toBeNull();
  });

  it('still misses it when the model did not change', () => {
    expect(
      actionFailureOf({
        action,
        target: '',
        input: 'click',
        outcome: { ...outcome, emitted: ['openChange'] },
        modelChanges: ['sameOpenChange'],
      }),
    ).toBe('fired no sameToggle output (fired openChange)');
  });
});
