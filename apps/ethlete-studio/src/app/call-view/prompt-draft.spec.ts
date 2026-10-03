import { Call, CallVariant } from '../../host/design';
import { handoffDraft, HANDOFF_FILE, opensARound, promptDraft, verdictOf } from './prompt-draft';

const variant: CallVariant = { key: 'a', name: 'Tabs', round: null, verdict: null, claim: '', cost: '' };

const call: Call = {
  slug: 'shop/cart',
  feature: null,
  eyebrow: '',
  headline: 'Cart layout',
  intro: '',
  frameWidth: 800,
  mode: 'wireframe',
  handoff: false,
  touched: 0,
  rounds: [],
  variants: [variant],
};

describe('prompt draft', () => {
  it('maps verbs to verdicts and rounds', () => {
    expect(verdictOf('accept')).toBe('chosen');
    expect(verdictOf('reject')).toBe('rejected');
    expect(verdictOf('iterate')).toBeNull();
    expect(verdictOf('more')).toBeNull();
    expect(opensARound('accept')).toBe(false);
    expect(opensARound('reject')).toBe(true);
  });

  it('marks a missing claim and cost and states the mode', () => {
    const prompt = promptDraft({ call, variant, dir: '/c' }, 'iterate');

    expect(prompt).toContain('The claim: (none written)');
    expect(prompt).toContain('The cost: (none written)');
    expect(prompt).toContain('wireframe mode');
    expect(prompt).not.toContain(HANDOFF_FILE);
    expect(prompt).not.toContain('Studio already opened round');
  });

  it('names the handoff file, the message and every file Studio made', () => {
    const prompt = promptDraft(
      {
        call: { ...call, handoff: true, mode: 'design' },
        variant,
        dir: '/c',
        made: { round: 'r2', keys: ['b', 'c'] },
        message: 'Wider.',
      },
      'more',
    );

    expect(prompt).toContain(`Read /c/${HANDOFF_FILE}`);
    expect(prompt).toContain('\nWider.\n');
    expect(prompt).toContain('round r2');
    expect(prompt).toContain('- /c/variant-b.ts\n- /c/variant-c.ts');
    expect(prompt).toContain('design mode');
  });

  it('asks a handoff into the call folder', () => {
    expect(handoffDraft({ call, dir: '/c' })).toContain(`/c/${HANDOFF_FILE}`);
  });
});
