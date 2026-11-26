import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HoldTriggerComponent } from './hold-trigger.component';

@Component({
  template: `
    <ng-template #content>Wartet</ng-template>
    <ng-template #reason>auf eine sehr lange Begründung die der Trigger aufdeckt</ng-template>
    <ethlete-hold-trigger [content]="content" [reason]="reason" [open]="open" (openChange)="opened.push($event)" />
  `,
  imports: [HoldTriggerComponent],
})
class HostComponent {
  open = false;
  opened: boolean[] = [];
}

const render = async (open: boolean) => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

  const fixture = TestBed.createComponent(HostComponent);

  fixture.componentInstance.open = open;
  await fixture.whenStable();

  const host = fixture.nativeElement as HTMLElement;

  return {
    fixture,
    button: host.querySelector('button') as HTMLButtonElement,
    reason: host.querySelector('[data-sk-hold-reason]') as HTMLElement,
  };
};

describe('HoldTriggerComponent', () => {
  it('keeps the reason hidden and aria-expanded false while closed', async () => {
    const { button, reason } = await render(false);

    expect(button.textContent?.trim()).toBe('Wartet');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(reason.hidden).toBe(true);
  });

  it('shows the reason while open and asks to close on click', async () => {
    const { fixture, button, reason } = await render(true);

    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(reason.hidden).toBe(false);
    expect(reason.textContent).toContain('Begründung');

    button.click();

    expect(fixture.componentInstance.opened).toEqual([false]);
  });

  it('asks to open on click while closed', async () => {
    const { fixture, button } = await render(false);

    button.click();

    expect(fixture.componentInstance.opened).toEqual([true]);
  });
});
