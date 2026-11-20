import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { MatchScorelineComponent } from './match-scoreline.component';

@Component({
  template: `<et-match-scoreline
    [homeScore]="home()"
    [awayScore]="away()"
    [time]="time()"
    [separator]="separator()"
  />`,
  imports: [MatchScorelineComponent],
})
class HostComponent {
  public home = signal<number | null>(2);
  public away = signal<number | null>(1);
  public time = signal<string | null>('18:30');
  public separator = signal(':');
}

describe('MatchScorelineComponent', () => {
  const setup = () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    return { fixture, el: fixture.nativeElement as HTMLElement };
  };

  it('draws both scores around the separator, then the time', () => {
    const { el } = setup();

    const scores = el.querySelectorAll('et-match-score');
    expect(scores[0]?.textContent?.trim()).toBe('2');
    expect(scores[1]?.textContent?.trim()).toBe('1');
    expect(el.querySelector('.et-match-scoreline-separator')?.textContent).toBe(':');
    expect(el.querySelector('.et-match-scoreline-time')?.textContent?.trim()).toBe('18:30');
  });

  it('draws a dash for a missing score and keeps a 0', () => {
    const { fixture, el } = setup();

    fixture.componentInstance.home.set(0);
    fixture.componentInstance.away.set(null);
    fixture.detectChanges();

    const scores = el.querySelectorAll('et-match-score');
    expect(scores[0]?.textContent?.trim()).toBe('0');
    expect(scores[1]?.textContent?.trim()).toBe('-');
  });

  it('omits the time when there is none', () => {
    const { fixture, el } = setup();

    fixture.componentInstance.time.set(null);
    fixture.detectChanges();

    expect(el.querySelector('.et-match-scoreline-time')).toBeNull();
  });
});
