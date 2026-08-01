import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { provideMatchLabels } from './match-labels';
import { MatchParticipantComponent } from './match-participant.component';
import { NormalizedMatchParticipant } from './match.types';

const TEAM: NormalizedMatchParticipant = {
  id: 'fcb',
  name: 'FC Berlin',
  code: 'FCB',
  subtitle: 'Berlin eSports',
  emblem: { defaultSrc: '/fcb.png' },
  seed: 3,
};

@Component({
  template: `
    <et-match-participant
      [participant]="participant()"
      [compact]="compact()"
      [showSeed]="showSeed()"
      [loading]="loading()"
    />
  `,
  imports: [MatchParticipantComponent],
})
class HostComponent {
  public participant = signal<NormalizedMatchParticipant | null>(TEAM);
  public compact = signal(false);
  public showSeed = signal(false);
  public loading = signal(false);
}

@Component({
  template: `
    <!-- The primitive renders its own content and its own name, neither visible to the linter. -->
    <!-- eslint-disable-next-line @angular-eslint/template/elements-content -->
    <a [participant]="participant()" et-match-participant href="#"></a>
  `,
  imports: [MatchParticipantComponent],
})
class LinkHostComponent {
  public participant = signal<NormalizedMatchParticipant | null>(TEAM);
}

const create = () => {
  const fixture = TestBed.createComponent(HostComponent);

  fixture.detectChanges();

  return fixture;
};

const host = (fixture: ComponentFixture<HostComponent>) => fixture.nativeElement as HTMLElement;
const name = (fixture: ComponentFixture<HostComponent>) =>
  host(fixture).querySelector('.et-match-participant-name')?.textContent?.trim();

describe('MatchParticipantComponent', () => {
  it('shows the full name and the emblem', () => {
    const fixture = create();

    expect(name(fixture)).toBe('FC Berlin');
    expect(host(fixture).querySelector('et-picture')).not.toBeNull();
  });

  it('prefers the short code when compact', () => {
    const fixture = create();

    fixture.componentInstance.compact.set(true);
    fixture.detectChanges();

    expect(name(fixture)).toBe('FCB');
  });

  it('falls back to the name when compact and there is no code', () => {
    const fixture = create();

    fixture.componentInstance.participant.set({ ...TEAM, code: null });
    fixture.componentInstance.compact.set(true);
    fixture.detectChanges();

    expect(name(fixture)).toBe('FC Berlin');
  });

  it('falls back to the code when there is no name', () => {
    const fixture = create();

    fixture.componentInstance.participant.set({ ...TEAM, name: null });
    fixture.detectChanges();

    expect(name(fixture)).toBe('FCB');
  });

  describe('a TBD slot', () => {
    const tbd = () => {
      const fixture = create();

      fixture.componentInstance.participant.set(null);
      fixture.detectChanges();

      return fixture;
    };

    it('names itself rather than rendering blank', () => {
      expect(name(tbd())).toBe('TBD');
    });

    it('is marked, so the row can style it as the placeholder it is', () => {
      expect(host(tbd()).querySelector('et-match-participant')?.hasAttribute('data-tbd')).toBe(true);
    });

    it('keeps the emblem frame, so nothing jumps when the name arrives', () => {
      expect(host(tbd()).querySelector('.et-match-participant-emblem')).not.toBeNull();
      expect(host(tbd()).querySelector('et-picture')).toBeNull();
    });
  });

  it('draws bones while loading - a pending slot is not the same as a decided TBD', () => {
    const fixture = create();

    fixture.componentInstance.participant.set(null);
    fixture.componentInstance.loading.set(true);
    fixture.detectChanges();

    expect(host(fixture).querySelectorAll('et-skeleton-item').length).toBeGreaterThan(0);
    expect(name(fixture)).toBeUndefined();
  });

  describe('the seed', () => {
    it('is hidden unless asked for', () => {
      expect(host(create()).querySelector('.et-match-participant-seed')).toBeNull();
    });

    it('shows with an accessible label, since the bare number says nothing', () => {
      const fixture = create();

      fixture.componentInstance.showSeed.set(true);
      fixture.detectChanges();

      const seed = host(fixture).querySelector('.et-match-participant-seed');

      expect(seed?.textContent?.trim()).toBe('3');
      expect(seed?.getAttribute('aria-label')).toBe('Seed 3');
    });

    it('stays hidden for a participant that has none', () => {
      const fixture = create();

      fixture.componentInstance.participant.set({ ...TEAM, seed: null });
      fixture.componentInstance.showSeed.set(true);
      fixture.detectChanges();

      expect(host(fixture).querySelector('.et-match-participant-seed')).toBeNull();
    });
  });

  describe('the subtitle', () => {
    it('is a second line under the name', () => {
      expect(host(create()).querySelector('.et-match-participant-subtitle')?.textContent?.trim()).toBe(
        'Berlin eSports',
      );
    });

    it('is dropped when compact - a second line is the first thing that stops fitting', () => {
      const fixture = create();

      fixture.componentInstance.compact.set(true);
      fixture.detectChanges();

      expect(host(fixture).querySelector('.et-match-participant-subtitle')).toBeNull();
    });

    it('is absent for a participant that has none', () => {
      const fixture = create();

      fixture.componentInstance.participant.set({ ...TEAM, subtitle: null });
      fixture.detectChanges();

      expect(host(fixture).querySelector('.et-match-participant-subtitle')).toBeNull();
    });
  });

  describe('on an interactive host', () => {
    const link = () => {
      const fixture = TestBed.createComponent(LinkHostComponent);

      fixture.detectChanges();

      return fixture;
    };

    it('marks itself interactive from the host tag alone', () => {
      const anchor = (link().nativeElement as HTMLElement).querySelector('a');

      expect(anchor?.hasAttribute('data-interactive')).toBe(true);
      expect(anchor?.classList.contains('et-focus-ring')).toBe(true);
    });

    it('names itself after the participant, so the link is not its emblem alt plus the same name', () => {
      expect((link().nativeElement as HTMLElement).querySelector('a')?.getAttribute('aria-label')).toBe('FC Berlin');
    });

    it('stays unnamed when it is only a span, where the surrounding text is the name', () => {
      expect(host(create()).querySelector('et-match-participant')?.hasAttribute('aria-label')).toBe(false);
    });
  });

  it('takes its strings from the match labels', () => {
    TestBed.configureTestingModule({ providers: [provideMatchLabels({ tbd: 'Offen' })] });

    const fixture = create();

    fixture.componentInstance.participant.set(null);
    fixture.detectChanges();

    expect(name(fixture)).toBe('Offen');
  });
});
