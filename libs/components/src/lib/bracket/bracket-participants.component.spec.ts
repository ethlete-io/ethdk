import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { BracketParticipantsComponent, BracketParticipantsEntry } from './bracket-participants.component';

@Component({
  template: `<et-bracket-participants [(focusedParticipantId)]="pinned" [participants]="participants" />`,
  imports: [BracketParticipantsComponent],
})
class BracketParticipantsTestHost {
  participants: BracketParticipantsEntry[] = [
    { id: 'a', name: 'Alpha' },
    { id: 'b', name: 'Bravo' },
  ];
  pinned = signal<string | null>(null);
}

describe('BracketParticipantsComponent', () => {
  const mount = () => {
    const fixture = TestBed.createComponent(BracketParticipantsTestHost);

    fixture.detectChanges();

    const toggles = () => Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>);

    return { fixture, toggles };
  };

  it('renders a labelled group with one toggle per participant, none pressed', () => {
    const { fixture, toggles } = mount();
    const host = fixture.nativeElement.querySelector('et-bracket-participants') as HTMLElement;

    expect(host.getAttribute('role')).toBe('group');
    expect(host.getAttribute('aria-label')).toBe('Participants');
    expect(toggles().map((toggle) => toggle.textContent?.trim())).toEqual(['Alpha', 'Bravo']);
    expect(toggles().map((toggle) => toggle.getAttribute('aria-pressed'))).toEqual(['false', 'false']);
  });

  it('pins a participant, moves the pin, and drops it on a second press', () => {
    const { fixture, toggles } = mount();

    toggles()[0]?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.pinned()).toBe('a');
    expect(toggles().map((toggle) => toggle.getAttribute('aria-pressed'))).toEqual(['true', 'false']);

    toggles()[1]?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.pinned()).toBe('b');

    toggles()[1]?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.pinned()).toBeNull();
  });

  it('reflects a pin set from outside', () => {
    const { fixture, toggles } = mount();

    fixture.componentInstance.pinned.set('b');
    fixture.detectChanges();

    expect(toggles().map((toggle) => toggle.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
  });
});
