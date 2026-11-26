import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import '../../../test-helpers';
import { FilterOverlay, FILTER_OVERLAY_TOKEN } from '../filter-overlay';
import { FILTER_OVERLAY_IMPORTS } from '../filter-overlay.imports';

const submitButton = signal({ label: 'Show 42 results', disabled: false });
const isPristine = signal(true);

const filterOverlayStub = () =>
  ({
    submitButton,
    isPristine,
    submit: () => undefined,
    reset: () => undefined,
  }) as unknown as FilterOverlay;

@Component({
  template: `
    <button #submit="etFilterOverlaySubmit" etFilterOverlaySubmit>{{ submit.label() }}</button>
    <button etFilterOverlayReset>Reset</button>
  `,
  imports: [...FILTER_OVERLAY_IMPORTS],
  providers: [{ provide: FILTER_OVERLAY_TOKEN, useFactory: filterOverlayStub }],
})
class FilterOverlayControlsHost {}

@Component({
  template: `<button etFilterOverlaySubmit>Apply</button>`,
  imports: [...FILTER_OVERLAY_IMPORTS],
})
class OrphanSubmitHost {}

describe('FilterOverlaySubmitDirective', () => {
  beforeEach(() => {
    submitButton.set({ label: 'Show 42 results', disabled: false });
    isPristine.set(true);
  });

  it('hands the label to the template through its exportAs, since nothing renders it', () => {
    TestBed.configureTestingModule({ imports: [FilterOverlayControlsHost] });

    const fixture = TestBed.createComponent(FilterOverlayControlsHost);

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.et-filter-overlay-submit').textContent).toContain('Show 42 results');
  });

  it('follows the label as the preview count changes', () => {
    TestBed.configureTestingModule({ imports: [FilterOverlayControlsHost] });

    const fixture = TestBed.createComponent(FilterOverlayControlsHost);

    fixture.detectChanges();
    submitButton.set({ label: 'Show 7 results', disabled: false });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.et-filter-overlay-submit').textContent).toContain('Show 7 results');
  });

  it('throws while the control is constructed when there is no filter overlay above it', () => {
    TestBed.configureTestingModule({ imports: [OrphanSubmitHost] });

    expect(() => TestBed.createComponent(OrphanSubmitHost)).toThrowError(/ET4200/);
  });
});
