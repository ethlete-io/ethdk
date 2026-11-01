import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ShellMainComponent, ShellSection } from './shell-main.component';

const setup = async (panel: 'open' | 'hidden') => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

  const fixture = TestBed.createComponent(ShellMainComponent);
  const events: string[] = [];

  fixture.componentRef.setInput('panel', panel);
  fixture.componentInstance.collapse.subscribe(() => events.push('collapse'));
  fixture.componentInstance.sectionChange.subscribe((section: ShellSection) => events.push(`section:${section}`));
  await fixture.whenStable();

  const click = (label: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`nav button[aria-label="${label}"]`)?.click();

  return { events, click };
};

describe('ShellMainComponent', () => {
  it('hides the open panel when the active section is clicked', async () => {
    const { events, click } = await setup('open');

    click('System');

    expect(events).toEqual(['collapse']);
  });

  it('shows the hidden panel again when the active section is clicked', async () => {
    const { events, click } = await setup('hidden');

    click('System');

    expect(events).toEqual(['section:System']);
  });

  it('switches to another section without hiding the panel', async () => {
    const { events, click } = await setup('open');

    click('Flows');

    expect(events).toEqual(['section:Flows']);
  });
});
