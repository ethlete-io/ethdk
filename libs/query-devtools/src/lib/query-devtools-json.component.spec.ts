import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ColorTheme, provideColorThemesWithTailwind4, ThemeSwatch } from '@ethlete/core';
import { QueryDevtoolsOverridesRecorder } from '@ethlete/query';
import { describe, expect, it } from 'vitest';
import { QueryDevtoolsJsonComponent } from './query-devtools-json.component';

const swatch: ThemeSwatch = {
  color: { default: '0 0 0', hover: '0 0 0', focus: '0 0 0', active: '0 0 0', disabled: '0 0 0' },
  onColor: { default: '255 255 255' },
};

const THEMES: ColorTheme[] = [
  { name: 'test-default', isDefault: true, primary: swatch },
  { name: 'test-error', type: 'error', primary: swatch },
];

const overrides = { list: () => [] } as unknown as QueryDevtoolsOverridesRecorder;

@Component({
  template: `<et-query-devtools-json [value]="value" [overrides]="overrides" />`,
  imports: [QueryDevtoolsJsonComponent],
})
class HostComponent {
  protected value = Array.from({ length: 150 }, (_, index) => index);
  protected overrides = overrides;
}

const cyclicList = () => {
  const items = Array.from(
    { length: 150 },
    (_, index) => ({ id: index, name: `item ${index}` }) as Record<string, unknown>,
  );

  items[0]!['self'] = items[0];

  return items;
};

@Component({
  template: `<et-query-devtools-json [value]="value" [overrides]="overrides" search="zzz" />`,
  imports: [QueryDevtoolsJsonComponent],
})
class CycleHostComponent {
  protected value = cyclicList();
  protected overrides = overrides;
}

const selfHolding = () => {
  const value: Record<string, unknown> = { name: 'needle' };

  value['self'] = value;

  return value;
};

@Component({
  template: `<et-query-devtools-json [value]="value" [overrides]="overrides" [search]="search" />`,
  imports: [QueryDevtoolsJsonComponent],
})
class SearchHostComponent {
  public value: unknown = { hit: { deep: 'needle' }, miss: { other: { leaf: 1 } } };
  public search = 'needle';
  protected overrides = overrides;
}

const renderSearch = async (value: unknown) => {
  TestBed.configureTestingModule({
    imports: [SearchHostComponent],
    providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
  });

  const fixture = TestBed.createComponent(SearchHostComponent);

  fixture.componentInstance.value = value;
  await fixture.whenStable();

  const keys = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.et-query-devtools-json-key')];

  return keys.map((key) => key.textContent?.trim());
};

@Component({
  template: `<et-query-devtools-json
    [value]="value"
    [expandedPaths]="expandedPaths"
    [collapsedPaths]="collapsedPaths"
    [toggleFn]="toggleFn"
  />`,
  imports: [QueryDevtoolsJsonComponent],
})
class DottedKeyHostComponent {
  protected value = { 'a.b': { x: 1 }, a: { b: { y: 2 } } };
  protected expandedPaths = new Set(['a', 'a.b']);
  protected collapsedPaths = new Set<string>();
  protected toggleFn = () => undefined;
}

describe('QueryDevtoolsJsonComponent', () => {
  it('should keep the expand state of a dotted key apart from the nested path it spells', async () => {
    TestBed.configureTestingModule({
      imports: [DottedKeyHostComponent],
      providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
    });

    const fixture = TestBed.createComponent(DottedKeyHostComponent);
    await fixture.whenStable();

    const keys = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.et-query-devtools-json-key')];

    expect(keys.map((key) => key.textContent?.trim())).toEqual(['a.b', 'a', 'b', 'y']);
  });

  it('should unfold only the containers that hold a search hit', async () => {
    const keys = await renderSearch({ hit: { deep: 'needle' }, miss: { other: { leaf: 1 } } });

    expect(keys).toEqual(['hit', 'deep', 'miss']);
  });

  it('should search a self-referential value that holds a hit without rendering forever', async () => {
    const keys = await renderSearch(selfHolding());

    expect(keys).toEqual(['name', 'self']);
  });

  it('should not offer an override menu on a folded slice', async () => {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
    });

    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();

    const chunks = fixture.nativeElement.querySelectorAll('.et-query-devtools-json-chunk');
    const menus = fixture.nativeElement.querySelectorAll('et-query-devtools-override-menu');

    expect(chunks.length).toBe(2);
    expect(menus.length).toBe(1);
  });

  it('should search a folded slice holding a self-referential value without overflowing', async () => {
    TestBed.configureTestingModule({
      imports: [CycleHostComponent],
      providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
    });

    const fixture = TestBed.createComponent(CycleHostComponent);

    await expect(fixture.whenStable()).resolves.not.toThrow();

    const chunks = (fixture.nativeElement as HTMLElement).querySelectorAll('.et-query-devtools-json-chunk');

    expect(chunks.length).toBe(2);
  });
});
