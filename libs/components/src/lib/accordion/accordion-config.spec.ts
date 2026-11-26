import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { provideAccordionConfig } from './accordion-config';
import { ACCORDION_IMPORTS } from './accordion.imports';

@Component({
  template: `
    <et-accordion-group [lastDivider]="lastDivider()">
      <et-accordion label="One">One</et-accordion>
    </et-accordion-group>
  `,
  imports: [ACCORDION_IMPORTS],
})
class ExplicitHostComponent {
  public lastDivider = signal<boolean | undefined>(undefined);
}

const hasLastDivider = (host: HTMLElement) =>
  host.querySelector('et-accordion-group')?.hasAttribute('data-last-divider');

const setup = (providers: ReturnType<typeof provideAccordionConfig> = [], value?: boolean) => {
  TestBed.configureTestingModule({ providers });
  const fixture = TestBed.createComponent(ExplicitHostComponent);
  fixture.componentInstance.lastDivider.set(value);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
};

describe('provideAccordionConfig', () => {
  it('keeps the last divider off without a provider', () => {
    expect(hasLastDivider(setup())).toBe(false);
  });

  it('applies the provided lastDivider default', () => {
    expect(hasLastDivider(setup(provideAccordionConfig({ lastDivider: true })))).toBe(true);
  });

  it('lets an explicit false win over the provider', () => {
    expect(hasLastDivider(setup(provideAccordionConfig({ lastDivider: true }), false))).toBe(false);
  });

  it('lets an explicit true win over the provider', () => {
    expect(hasLastDivider(setup(provideAccordionConfig({ lastDivider: false }), true))).toBe(true);
  });
});
