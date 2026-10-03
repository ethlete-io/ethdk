import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { CheckboxComponent } from './checkbox.component';

describe('CheckboxComponent on the server', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('renders an unchecked checkbox where getComputedStyle does not exist', () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    vi.stubGlobal('getComputedStyle', undefined);

    const fixture = TestBed.createComponent(CheckboxComponent);

    expect(() => fixture.detectChanges()).not.toThrow();
  });
});
