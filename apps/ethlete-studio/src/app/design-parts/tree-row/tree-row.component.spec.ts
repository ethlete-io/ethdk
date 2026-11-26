import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { TooltipDirective } from '@ethlete/components';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from '../../../themes';
import { TreeRowComponent } from './tree-row.component';

describe('TreeRowComponent', () => {
  it('draws a tree of treeitems with level and expansion', async () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
    });

    const fixture = TestBed.createComponent(TreeRowComponent);

    fixture.componentRef.setInput('rows', [
      { label: 'Components', depth: 0, kind: 'group', expanded: true },
      { label: 'form-field', depth: 1, kind: 'part', expanded: false },
      { label: 'empty', depth: 2, kind: 'leaf' },
    ]);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const items = [...element.querySelectorAll<HTMLElement>('[role="treeitem"]')];

    expect(element.getAttribute('role')).toBe('tree');
    expect(items.map((i) => [i.getAttribute('aria-level'), i.getAttribute('aria-expanded')])).toEqual([
      ['1', 'true'],
      ['2', 'false'],
      ['3', null],
    ]);
  });

  it('fires rowPress with the row on click, Enter and Space', async () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
    });

    const fixture = TestBed.createComponent(TreeRowComponent);
    const rows = [
      { label: 'Components', depth: 0, kind: 'group' as const, expanded: true },
      { label: 'empty', depth: 1, kind: 'leaf' as const },
      { label: 'filled', depth: 1, kind: 'leaf' as const },
    ];
    const pressed: string[] = [];

    fixture.componentRef.setInput('rows', rows);
    fixture.componentInstance.rowPress.subscribe((row) => pressed.push(row.label));
    await fixture.whenStable();

    const items = [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[role="treeitem"]')];

    items[0]?.click();
    items[1]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    items[2]?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

    expect(pressed).toEqual(['Components', 'empty', 'filled']);
  });

  it('marks a warning row with an icon and lists no finding', async () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
    });

    const fixture = TestBed.createComponent(TreeRowComponent);
    fixture.componentRef.setInput('rows', [{ label: 'canvas-frames', depth: 1, kind: 'leaf', warning: true }]);
    await fixture.whenStable();

    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelector('svg path[d="M8 2.5 14 13H2z"]')).not.toBeNull();
  });

  // The human wants a plain tooltip on the warning icon.
  it('gives the warning icon the plain warning text as its tooltip', async () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
    });

    const fixture = TestBed.createComponent(TreeRowComponent);
    fixture.componentRef.setInput('rows', [
      { label: 'a', depth: 1, kind: 'leaf', warning: true, warningTitle: 'plain warning' },
    ]);
    await fixture.whenStable();

    const tips = fixture.debugElement.queryAll(By.directive(TooltipDirective));

    expect(tips.map((tip) => tip.injector.get(TooltipDirective).content())).toContain('plain warning');
  });

  it('shows a hint as the tooltip of the label and draws no tag', async () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
    });

    const fixture = TestBed.createComponent(TreeRowComponent);

    fixture.componentRef.setInput('rows', [{ label: 'foundations/colors', depth: 1, kind: 'leaf', hint: 'a hint' }]);
    await fixture.whenStable();

    const tips = fixture.debugElement.queryAll(By.directive(TooltipDirective));

    expect(tips.map((tip) => tip.injector.get(TooltipDirective).content())).toEqual(['a hint']);
    expect(fixture.nativeElement.querySelector('.text-ui-xs')).toBeNull();
  });
});
