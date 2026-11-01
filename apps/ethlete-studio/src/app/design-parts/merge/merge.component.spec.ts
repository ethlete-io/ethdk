import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MergeComponent } from './merge.component';

const render = async (inputs: Record<string, unknown>) => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

  const fixture = TestBed.createComponent(MergeComponent);

  Object.entries(inputs).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
  await fixture.whenStable();

  return fixture.nativeElement as HTMLElement;
};

describe('MergeComponent', () => {
  it('shows the unchanged disclosure when states are unchanged', async () => {
    const el = await render({ unchangedStates: { part: 'pages/inbox', states: ['all'] } });

    expect(el.querySelector('ethlete-disclosure')).not.toBeNull();
  });

  it('hides the unchanged disclosure when no state is unchanged', async () => {
    const el = await render({ unchangedStates: { part: 'pages/inbox', states: [] } });

    expect(el.querySelector('ethlete-disclosure')).toBeNull();
  });
});
