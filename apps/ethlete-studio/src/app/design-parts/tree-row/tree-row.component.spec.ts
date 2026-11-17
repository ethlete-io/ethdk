import { provideZonelessChangeDetection, TemplateRef } from '@angular/core';
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

  it('shows each warning finding on its own line', async () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), provideColorThemesWithTailwind4(THEMES)],
    });

    const fixture = TestBed.createComponent(TreeRowComponent);
    const warning = ['LOAD: the part draws it', 'UTILITY-CSS: min-width: 100% outside foundations'];

    fixture.componentRef.setInput('rows', [{ label: 'canvas-frames', depth: 1, kind: 'leaf', warning }]);
    await fixture.whenStable();

    const tip = fixture.debugElement.query(By.directive(TooltipDirective)).injector.get(TooltipDirective);
    const content = tip.content();

    if (!(content instanceof TemplateRef)) throw new Error('the warning tooltip is not a list template');

    const view = content.createEmbeddedView({});
    view.detectChanges();

    const lines = view.rootNodes
      .flatMap((node: Node) => (node instanceof HTMLElement ? [...node.querySelectorAll('li')] : []))
      .map((line) => line.textContent?.trim());

    expect(tip.ariaDescription()).toBe(warning.join('; '));
    expect(lines).toEqual(warning);
  });
});
