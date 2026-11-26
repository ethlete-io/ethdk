import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { FocusRingStylesComponent } from './index';

describe('FocusRingStylesComponent', () => {
  // The focus ring styles are public API of the focus-ring entry.
  it('is exported from the focus-ring entry', () => {
    expect(FocusRingStylesComponent).toBeDefined();
    TestBed.configureTestingModule({ imports: [FocusRingStylesComponent] });
    expect(TestBed.createComponent(FocusRingStylesComponent).componentInstance).toBeInstanceOf(
      FocusRingStylesComponent,
    );
  });
});
