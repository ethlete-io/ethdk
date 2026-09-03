import { Component, signal } from '@angular/core';
import '../../test-helpers';
import { NormalizedMatch } from '../match';
import { mountControl } from '../testing/control-driver';
import { BracketPickCardComponent } from './bracket-pick-card.component';
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
    expect(driver.root.textContent).toContain('Choose earlier picks first');
    expect(driver.root.textContent).toContain('Unavailable');
  });

  it('does not expose a partial matchup or the other side of a bye as a control', () => {
    const driver = create();

    driver.host.bracketMatch = {
      ...bracketMatch,
      awaySource: {
        kind: 'bye',
        role: null,
        matchId: null,
        standingId: null,
        rank: null,
        label: 'Bye',
      },
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
});
