import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MergeComponent } from './merge.component';

const render = async (inputs: Record<string, unknown>) => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

  const fixture = TestBed.createComponent(MergeComponent);

  Object.entries(inputs).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
  await fixture.whenStable();

  return fixture;
};

describe('MergeComponent', () => {
  it('shows the unchanged disclosure when states are unchanged', async () => {
    const el = (await render({ unchangedStates: { part: 'pages/inbox', states: ['all'] } }))
      .nativeElement as HTMLElement;

    expect(el.querySelector('ethlete-disclosure')).not.toBeNull();
  });

  it('hides the unchanged disclosure when no state is unchanged', async () => {
    const el = (await render({ unchangedStates: { part: 'pages/inbox', states: [] } })).nativeElement as HTMLElement;

    expect(el.querySelector('ethlete-disclosure')).toBeNull();
  });

  it('picks a changed row on Space and prevents the page scroll', async () => {
    const fixture = await render({});
    const picked: string[] = [];

    fixture.componentInstance.pick.subscribe((row) => picked.push(row));

    const row = (fixture.nativeElement as HTMLElement).querySelector('li[tabindex="0"]') as HTMLElement;
    const space = new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true });

    row.dispatchEvent(space);

    expect(picked).toHaveLength(1);
    expect(space.defaultPrevented).toBe(true);
  });
});
