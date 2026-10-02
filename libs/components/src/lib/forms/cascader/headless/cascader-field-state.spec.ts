import { Component, resource, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormField, form, maxLength, validateAsync } from '@angular/forms/signals';
import { provideColorThemes } from '@ethlete/core';
import '../../../../test-helpers';
import { TEST_COLOR_THEMES } from '../../../testing/color-themes';
import { FORM_FIELD_IMPORTS } from '../../form-field/form-field.imports';
import { CASCADER_IMPORTS } from '../cascader.imports';
import { CascaderDataSource } from './internals/cascader-tree';

const source: CascaderDataSource<string> = {
  loadChildren: (parent) =>
    parent
      ? []
      : [
          { value: 'euro', label: 'Euro', isLeaf: true },
          { value: 'world', label: 'World Cup', isLeaf: true },
        ],
};

@Component({
  template: `
    <et-form-field>
      <et-label>Competition</et-label>
      <et-cascader [formField]="demoForm.competition" [dataSource]="source" placeholder="Pick one" />
    </et-form-field>

    <et-form-field>
      <et-label>Competitions</et-label>
      <et-cascader [formField]="demoForm.competitions" [dataSource]="source" multiple placeholder="Pick some" />
      <et-counter />
    </et-form-field>
  `,
  imports: [FormField, FORM_FIELD_IMPORTS, CASCADER_IMPORTS],
})
class CascaderFieldStateTestHost {
  source = source;
  model = signal<{ competition: string | null; competitions: string[] }>({
    competition: 'euro',
    competitions: ['world'],
  });
  demoForm = form(this.model, (s) => {
    maxLength(s.competitions, 2);
    validateAsync(s.competition, {
      params: ({ value }) => value(),
      factory: (params) => resource({ params, loader: () => new Promise<null>(() => undefined) }),
      onSuccess: () => null,
      onError: () => null,
    });
  });
}

describe('CascaderDirective field state from signal forms', () => {
  let fields: HTMLElement[];

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideColorThemes(TEST_COLOR_THEMES)] });

    const fixture = TestBed.createComponent(CascaderFieldStateTestHost);

    fixture.detectChanges();
    fields = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('et-form-field'));
  });

  it('marks the field busy while an async validator is pending', () => {
    expect(fields[0]!.getAttribute('aria-busy')).toBe('true');
    expect(fields[1]!.hasAttribute('aria-busy')).toBe(false);
  });

  it('feeds the schema maxLength to the counter', () => {
    expect(fields[1]!.querySelector('et-counter [aria-hidden]')?.textContent?.trim()).toBe('1 / 2');
  });
});
