import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RichTextEditorTokenPopupComponent } from './rich-text-editor-token-popup.component';
import { RichTextEditorTriggerItem } from './rich-text-editor-trigger';

@Component({
  imports: [RichTextEditorTokenPopupComponent],
  template: `<et-rich-text-editor-token-popup
    [items]="items"
    [activeIndex]="activeIndex()"
    emptyLabel="Nothing"
    listboxId="lb"
  />`,
})
class HostComponent {
  items: RichTextEditorTriggerItem[] = Array.from({ length: 30 }, (_, i) => ({ id: `${i}`, label: `Item ${i}` }));
  activeIndex = signal(0);
}

describe('RichTextEditorTokenPopupComponent', () => {
  const scrolled: string[] = [];

  beforeEach(() => {
    scrolled.length = 0;
    Element.prototype.scrollIntoView = vi.fn(function (this: Element, options?: unknown) {
      expect(options).toEqual({ block: 'nearest' });
      scrolled.push(this.textContent?.trim() ?? '');
    });
  });

  afterEach(() => {
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  });

  it('scrolls the active row into view as the active index moves', () => {
    const fixture = TestBed.createComponent(HostComponent);

    fixture.detectChanges();
    scrolled.length = 0;

    fixture.componentInstance.activeIndex.set(25);
    fixture.detectChanges();

    expect(scrolled).toEqual(['Item 25']);

    fixture.componentInstance.activeIndex.set(24);
    fixture.detectChanges();

    expect(scrolled).toEqual(['Item 25', 'Item 24']);
  });
});
