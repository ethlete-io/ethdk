import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
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
});
