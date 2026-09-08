import { Component, signal } from '@angular/core';
import { BracketSlotSource } from '@ethlete/bracket';
import '../../test-helpers';
import { NormalizedMatch } from '../match';
import { mountControl } from '../testing/control-driver';
import { DEFAULT_BRACKET_LABELS, describeBracketSlot, provideBracketLabels } from './bracket-labels';
import { BracketPickCardComponent, BracketPickCardNoteTone } from './bracket-pick-card.component';
import { BracketMatch } from './linked';

const HOME = { id: 'home', name: 'Home', code: 'HOM', subtitle: null, emblem: null, seed: null };
const AWAY = { id: 'away', name: 'Away', code: 'AWY', subtitle: null, emblem: null, seed: null };

const normalized = (overrides: Partial<NormalizedMatch> = {}): NormalizedMatch => ({
  id: 'match',
  status: 'scheduled',
  startTime: null,
  home: HOME,
  away: AWAY,
  homeScore: null,
  awayScore: null,
  resultKind: 'score',
  gameScores: null,
  winnerSide: null,
  label: null,
  ...overrides,
});

const slotSource = (overrides: Partial<BracketSlotSource> & Pick<BracketSlotSource, 'kind'>): BracketSlotSource => ({
  role: null,
  matchId: null,
  standingId: null,
  rank: null,
  label: null,
  ...overrides,
});

const bracketMatch = {
  id: 'match',
  homeSource: null,
  awaySource: null,
} as unknown as BracketMatch<unknown, unknown>;

@Component({
  template: `
    <et-bracket-pick-card
      [bracketMatch]="bracketMatch"
      [normalized]="match()"
      [pickedSide]="pickedSide()"
      [locked]="locked()"
      [disabled]="disabled()"
      [readonly]="readonly()"
      [earlierRoundsClosed]="earlierRoundsClosed()"
      [note]="note()"
      [noteTone]="noteTone()"
      (pick)="picks.push($event)"
    >
      <span etBracketPickCardScore>4 points</span>
    </et-bracket-pick-card>
  `,
  imports: [BracketPickCardComponent],
})
class HostComponent {
  public bracketMatch = bracketMatch;
  public match = signal(normalized());
  public pickedSide = signal<'home' | 'away' | null>('home');
  public locked = signal(false);
  public disabled = signal(false);
  public readonly = signal(false);
  public earlierRoundsClosed = signal(false);
  public note = signal<string | null>(null);
  public noteTone = signal<BracketPickCardNoteTone>('muted');
  public picks: Array<'home' | 'away'> = [];
}

const create = () => {
  const fixture = mountControl(HostComponent);
  const root = fixture.nativeElement as HTMLElement;

  return { fixture, root, host: fixture.componentInstance };
};

describe('BracketPickCardComponent', () => {
  it('emits selectable sides and exposes the current choice with aria-pressed', () => {
    const driver = create();
    const buttons = Array.from(driver.root.querySelectorAll<HTMLButtonElement>('button'));

    expect(buttons.map((button) => button.getAttribute('aria-pressed'))).toEqual(['true', 'false']);

    buttons[1]?.click();

    expect(driver.host.picks).toEqual(['away']);
    expect(driver.root.textContent).toContain('4 points');
  });

  it('names the participant on each side, so the journey highlight can hit-test one of them', () => {
    const driver = create();
    const sides = Array.from(driver.root.querySelectorAll('.et-bracket-pick-card-side'));

    expect(sides.map((side) => side.getAttribute('data-participant-id'))).toEqual(['home', 'away']);
  });

  it('names no participant on a side nobody stands on', () => {
    const driver = create();

    driver.host.match.set(normalized({ home: null, homeState: 'unresolvable' }));
    driver.fixture.detectChanges();

    const sides = Array.from(driver.root.querySelectorAll('.et-bracket-pick-card-side'));

    expect(sides.map((side) => side.getAttribute('data-participant-id'))).toEqual([null, 'away']);
  });

  it('marks every side with a shape, so the choice is not colour alone', () => {
    const driver = create();

    expect(driver.root.querySelectorAll('.et-bracket-pick-card-mark')).toHaveLength(2);
  });

  it('marks nothing on a card that offers no pick at all', () => {
    const driver = create();

    driver.host.pickedSide.set(null);
    driver.host.disabled.set(true);
    driver.fixture.detectChanges();

    expect(driver.root.querySelectorAll('.et-bracket-pick-card-mark')).toHaveLength(0);
  });

  it('keeps the mark on a locked pick, so the choice stays readable', () => {
    const driver = create();

    driver.host.locked.set(true);
    driver.fixture.detectChanges();

    expect(driver.root.querySelectorAll('.et-bracket-pick-card-mark')).toHaveLength(1);
  });

  it('renders unresolved and unavailable sides as non-focusable text', () => {
    const driver = create();

    driver.host.match.set(
      normalized({
        home: null,
        away: null,
        homeState: 'unresolvable',
        awayState: 'unavailable',
      }),
    );
    driver.fixture.detectChanges();

    expect(driver.root.querySelectorAll('button')).toHaveLength(0);
    expect(driver.root.textContent).toContain('Predict the earlier round first');
    expect(driver.root.textContent).toContain('Not known yet');
  });

  it('stops inviting a prediction once no earlier round is left to make one in', () => {
    const driver = create();

    driver.host.match.set(normalized({ home: null, homeState: 'unresolvable' }));
    driver.host.earlierRoundsClosed.set(true);
    driver.fixture.detectChanges();

    expect(driver.root.textContent).toContain('Not predicted');
    expect(driver.root.textContent).not.toContain('Predict the earlier round first');
  });

  it('words an unavailable side from its slot source', () => {
    const driver = create();

    driver.host.bracketMatch = {
      ...bracketMatch,
      awaySource: slotSource({ kind: 'seed', seed: 7 }),
    };
    driver.host.match.set(normalized({ away: null, awayState: 'unavailable' }));
    driver.fixture.detectChanges();

    expect(driver.root.textContent).toContain('Seed 7');
  });

  it('does not expose a partial matchup or the other side of a bye as a control', () => {
    const driver = create();

    driver.host.bracketMatch = {
      ...bracketMatch,
      awaySource: slotSource({ kind: 'bye', label: 'Bye' }),
    };
    driver.host.match.set(normalized({ away: null, awayState: 'unavailable' }));
    driver.fixture.detectChanges();

    expect(driver.root.querySelectorAll('button')).toHaveLength(0);
  });

  it('keeps locked picks visible but removes their controls', () => {
    const driver = create();

    driver.host.locked.set(true);
    driver.fixture.detectChanges();

    expect(driver.root.querySelectorAll('button')).toHaveLength(0);
    expect(driver.root.querySelector('[data-selected]')).toBeTruthy();
  });

  describe('the note', () => {
    const withNote = (tone: BracketPickCardNoteTone) => {
      const driver = create();

      driver.host.note.set('Followed Home from Match 3');
      driver.host.noteTone.set(tone);
      driver.fixture.detectChanges();

      return driver;
    };

    it('sits outside the card box, so it cannot take the card’s height', () => {
      const driver = withNote('muted');
      const note = driver.root.querySelector('.et-bracket-pick-card-note');

      expect(note?.textContent?.trim()).toBe('Followed Home from Match 3');
      expect(note?.closest('.et-bracket-pick-card-box')).toBeNull();
      expect(driver.root.querySelector('.et-bracket-pick-card-note-layer')).toBeTruthy();
    });

    it('describes the sides it is about', () => {
      const driver = withNote('muted');
      const note = driver.root.querySelector('.et-bracket-pick-card-note');
      const button = driver.root.querySelector('button');

      expect(button?.getAttribute('aria-describedby')).toBe(note?.id);
    });

    it('leaves the card unoutlined while it is only a remark', () => {
      expect(withNote('muted').root.querySelector('.et-bracket-pick-card-invalid-outline')).toBeNull();
    });

    it('outlines the card when it is invalid', () => {
      const driver = withNote('invalid');

      expect(driver.root.querySelector('.et-bracket-pick-card-invalid-outline')).toBeTruthy();
      expect(driver.root.querySelector('et-bracket-pick-card')?.getAttribute('data-note-tone')).toBe('invalid');
    });

    it('reads an invalid note in the app’s error theme without losing its own class', () => {
      const layer = withNote('invalid').root.querySelector('.et-bracket-pick-card-note-layer');

      expect(layer?.classList.contains('et-color--red')).toBe(true);
    });

    it('is absent when nothing is passed', () => {
      const driver = create();

      expect(driver.root.querySelector('.et-bracket-pick-card-note-layer')).toBeNull();
      expect(driver.root.querySelector('button')?.getAttribute('aria-describedby')).toBeNull();
    });
  });

  describe('readonly', () => {
    const readonly = (overrides: Partial<NormalizedMatch> = {}) => {
      const driver = create();

      driver.host.readonly.set(true);
      driver.host.match.set(normalized(overrides));
      driver.fixture.detectChanges();

      return driver;
    };

    it('offers nothing to pick and draws no pick marks', () => {
      const driver = readonly({ winnerSide: 'home' });

      expect(driver.root.querySelectorAll('button')).toHaveLength(0);
      expect(driver.root.querySelectorAll('.et-bracket-pick-card-mark')).toHaveLength(0);
    });

    it('dims the side the match decided against', () => {
      const sides = Array.from(readonly({ winnerSide: 'home' }).root.querySelectorAll('.et-bracket-pick-card-side'));

      expect(sides.map((side) => side.hasAttribute('data-dimmed'))).toEqual([false, true]);
    });

    it('dims neither side while the match is undecided', () => {
      expect(readonly().root.querySelector('[data-dimmed]')).toBeNull();
    });
  });

  it('takes its slot wording from the bracket labels', () => {
    const fixture = mountControl(HostComponent, [
      provideBracketLabels({ slotPredictEarlierRound: 'Erst die Vorrunde tippen' }),
    ]);

    fixture.componentInstance.match.set(normalized({ home: null, homeState: 'unresolvable' }));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Erst die Vorrunde tippen');
  });
});

describe('describeBracketSlot', () => {
  const describe_ = (source: BracketSlotSource | null | undefined) =>
    describeBracketSlot(source, DEFAULT_BRACKET_LABELS);

  it('repeats the competition’s own wording whenever it has some', () => {
    expect(describe_(slotSource({ kind: 'seed', seed: 3, label: 'Host nation' }))).toBe('Host nation');
  });

  it('tells a winner slot from a loser slot', () => {
    expect(describe_(slotSource({ kind: 'match-outcome', role: 'winner' }))).toBe('Winner of an earlier match');
    expect(describe_(slotSource({ kind: 'match-outcome', role: 'loser' }))).toBe('Loser of an earlier match');
  });

  it('names the standing and the position in it', () => {
    expect(describe_(slotSource({ kind: 'standing-rank', standingName: 'Group A', rank: 2 }))).toBe(
      'Group A position 2',
    );
  });

  it('words a standing slot that is missing one of its two halves', () => {
    expect(describe_(slotSource({ kind: 'standing-rank', rank: 2 }))).toBe('Standing position 2');
    expect(describe_(slotSource({ kind: 'standing-rank', standingName: 'Group A' }))).toBe('Group A');
    expect(describe_(slotSource({ kind: 'standing-rank' }))).toBe('A standing position');
  });

  it('words the remaining kinds', () => {
    expect(describe_(slotSource({ kind: 'seed', seed: 3 }))).toBe('Seed 3');
    expect(describe_(slotSource({ kind: 'seed' }))).toBe('A seeded slot');
    expect(describe_(slotSource({ kind: 'swiss-bucket' }))).toBe('Drawn once the round is scheduled');
    expect(describe_(slotSource({ kind: 'bye' }))).toBe('Bye');
    expect(describe_(slotSource({ kind: 'external' }))).toBe('Arrives from another competition');
  });

  it('says a slot with no provenance is unknown, rather than guessing at one', () => {
    expect(describe_(null)).toBe('Not known yet');
    expect(describe_(undefined)).toBe('Not known yet');
  });
});
