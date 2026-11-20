import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { provideScrollableConfig } from './scrollable-config';
import { SCROLLABLE_IMPORTS, SCROLLABLE_NAVIGATION_IMPORTS } from '../scrollable.imports';

@Component({
  template: `
    <et-scrollable id="plain" />
    <et-scrollable id="explicit" etScrollableButtons />
    <et-scrollable [etScrollableButtons]="{ enabled: false }" id="off" />
    <et-scrollable [etScrollableButtons]="{ position: 'footer' }" id="footer" />
  `,
  imports: [SCROLLABLE_IMPORTS, SCROLLABLE_NAVIGATION_IMPORTS],
})
class HostComponent {}

const setup = (providers: ReturnType<typeof provideScrollableConfig> = []) => {
  TestBed.configureTestingModule({ providers });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;

  return (id: string) => ({
    inline: host.querySelector(`#${id}`)?.classList.contains('et-scrollable--inline-buttons') ?? false,
  });
};

describe('provideScrollableConfig', () => {
  it('leaves a scrollable without the directive attribute alone by default', () => {
    expect(setup()('plain').inline).toBe(false);
  });

  it('applies the provided position to a scrollable that has no etScrollableButtons', () => {
    const at = setup(provideScrollableConfig({ buttons: { enabled: true, position: 'inline' } }));

    expect(at('plain').inline).toBe(true);
    expect(at('explicit').inline).toBe(true);
  });

  it('lets the instance override the provided position and enabled', () => {
    const at = setup(provideScrollableConfig({ buttons: { enabled: true, position: 'inline' } }));

    expect(at('footer').inline).toBe(false);
    expect(at('off').inline).toBe(false);
  });

  it('stays off below the first provided breakpoint', () => {
    const at = setup(provideScrollableConfig({ buttons: { enabled: { '2xl': true }, position: 'inline' } }));

    expect(at('plain').inline).toBe(false);
  });
});
