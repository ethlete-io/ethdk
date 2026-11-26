import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ZoomChipComponent } from './zoom-chip.component';

const render = async (percent: number) => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

  const fixture = TestBed.createComponent(ZoomChipComponent);

  fixture.componentRef.setInput('percent', percent);
  await fixture.whenStable();

  return fixture;
};

describe('ZoomChipComponent', () => {
  it('shows the zoom in percent on the reset button', async () => {
    const fixture = await render(250);
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[aria-label="Auf 100 % zoomen"]')?.textContent?.trim()).toBe('250 %');
  });

  it('emits the output of each button, found by its German label', async () => {
    const fixture = await render(100);
    const element = fixture.nativeElement as HTMLElement;
    const chip = fixture.componentInstance;
    const emitted: string[] = [];

    chip.zoomOut.subscribe(() => emitted.push('out'));
    chip.zoomReset.subscribe(() => emitted.push('reset'));
    chip.zoomIn.subscribe(() => emitted.push('in'));
    chip.fit.subscribe(() => emitted.push('fit'));

    ['Verkleinern', 'Auf 100 % zoomen', 'Vergrößern', 'Einpassen'].forEach((label) =>
      element.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)?.click(),
    );

    expect(emitted).toEqual(['out', 'reset', 'in', 'fit']);
  });
});
