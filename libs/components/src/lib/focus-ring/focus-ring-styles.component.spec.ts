import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { FocusRingStylesComponent } from './index';

describe('FocusRingStylesComponent', () => {
  it('is exported from the focus-ring entry', () => {
    expect(FocusRingStylesComponent).toBeDefined();
    TestBed.configureTestingModule({ imports: [FocusRingStylesComponent] });
    expect(TestBed.createComponent(FocusRingStylesComponent).componentInstance).toBeInstanceOf(
      FocusRingStylesComponent,
    );
  });
});
