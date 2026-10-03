import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { defineStaticProvider, defineStaticRootProvider, toInjectFn, toProvideFn } from '../index';
import { useScenario } from './harness';

type FieldDefaults = { size: 'sm' | 'md' | null; label: string | null; dense: boolean };

const FIELD_DEFAULTS_DEF = /* @__PURE__ */ defineStaticRootProvider<FieldDefaults>(
  { size: 'md', label: 'Name', dense: false },
  { name: 'Field Defaults' },
);
const provideFieldDefaults = /* @__PURE__ */ toProvideFn(FIELD_DEFAULTS_DEF);
const injectFieldDefaults = /* @__PURE__ */ toInjectFn(FIELD_DEFAULTS_DEF);

const PAGE_DEFAULTS_DEF = /* @__PURE__ */ defineStaticProvider<FieldDefaults>(
  { size: 'sm', label: 'Page', dense: true },
  { name: 'Page Defaults' },
);
const providePageDefaults = /* @__PURE__ */ toProvideFn(PAGE_DEFAULTS_DEF);
const injectPageDefaults = /* @__PURE__ */ toInjectFn(PAGE_DEFAULTS_DEF);

@Component({
  selector: 'et-scenario-field-host',
  providers: [
    provideFieldDefaults({ size: undefined, label: null, dense: true }),
    providePageDefaults({ size: undefined, label: undefined }),
  ],
  template: '',
})
class FieldHostComponent {
  field = injectFieldDefaults();
  page = injectPageDefaults();
}

describe('static provider override with undefined keys', () => {
  const scenario = useScenario();

  it('keeps the default for a key passed as undefined and still applies null', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(FieldHostComponent);

    s.tick();

    expect(fixture.componentInstance.field).toEqual({ size: 'md', label: null, dense: true });
    expect(fixture.componentInstance.page).toEqual({ size: 'sm', label: 'Page', dense: true });
  });
});
