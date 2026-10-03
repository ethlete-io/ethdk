import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { provideChipLabels } from './chip-labels';
import { ChipComponent } from './chip.component';
import { CHIP_REMOVE_FOCUS_FALLBACK, ChipDirective, ChipRemoveDirective } from './headless';

@Component({
  template: `
    <div class="chip-parent">
      <et-chip [removable]="removable()" (remove)="removeCount = removeCount + 1">Tag</et-chip>
    </div>
  `,
  imports: [ChipComponent],
})
class ChipComponentHost {
  removable = signal(true);
  removeCount = 0;
}

@Component({
  template: `
    <span etChip removable>
      Chip
      <button [removeLabel]="label()" etChipRemove>x</button>
    </span>
  `,
  imports: [ChipDirective, ChipRemoveDirective],
  providers: [provideChipLabels({ remove: 'Entfernen' })],
})
class LabelHost {
  label = signal<string | null>(null);
}

@Component({
  template: `
    @for (item of items(); track item) {
      <span
        [attr.data-item]="item"
        [disabled]="item === disabledItem()"
        (remove)="drop(item)"
        etChip
        removable
        tabindex="0"
        >{{ item }}</span
      >
    }
  `,
  imports: [ChipDirective],
  providers: [{ provide: CHIP_REMOVE_FOCUS_FALLBACK, useFactory: () => () => fallbackCalls.push(1) }],
})
class FocusListHost {
  items = signal(['a', 'b', 'c']);
  disabledItem = signal<string | null>(null);

  drop(item: string) {
    this.items.update((items) => items.filter((i) => i !== item));
  }
}

let fallbackCalls: number[] = [];

describe('ChipComponent', () => {
  it('renders a labelled remove button only while removable', () => {
    const fixture = TestBed.createComponent(ChipComponentHost);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const button = el.querySelector<HTMLButtonElement>('.et-chip-remove-button')!;
    const label = el.querySelector('.et-chip-label')!;

    expect(button.getAttribute('aria-label')).toBe('Remove');
    expect(button.getAttribute('aria-describedby')).toBe(label.id);
    expect(document.getElementById(label.id)).toBe(label);

    fixture.componentInstance.removable.set(false);
    fixture.detectChanges();
    expect(el.querySelector('.et-chip-remove-button')).toBeNull();
  });

  it('removes without activating a clickable ancestor', () => {
    const fixture = TestBed.createComponent(ChipComponentHost);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const parentClick = vi.fn();
    el.querySelector('.chip-parent')!.addEventListener('click', parentClick);

    el.querySelector<HTMLButtonElement>('.et-chip-remove-button')!.click();

    expect(fixture.componentInstance.removeCount).toBe(1);
    expect(parentClick).not.toHaveBeenCalled();
  });
});

describe('ChipRemoveDirective labels', () => {
  it('uses the provided label set, and a per-instance removeLabel over it', () => {
    const fixture = TestBed.createComponent(LabelHost);
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;

    expect(button.getAttribute('aria-label')).toBe('Entfernen');

    fixture.componentInstance.label.set('Tag löschen');
    fixture.detectChanges();
    expect(button.getAttribute('aria-label')).toBe('Tag löschen');
  });
});

describe('ChipDirective focus hand-off edges', () => {
  beforeEach(() => {
    fallbackCalls = [];
  });

  const setup = () => {
    const fixture = TestBed.createComponent(FocusListHost);
    fixture.detectChanges();
    const chip = (item: string) =>
      (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-item="${item}"]`);

    return { fixture, chip };
  };

  const removeWithKey = async (fixture: ReturnType<typeof setup>['fixture'], target: HTMLElement) => {
    target.focus();
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }));
    fixture.detectChanges();
    await fixture.whenStable();
  };

  it('falls back to the previous chip when the last one is removed', async () => {
    const { fixture, chip } = setup();

    await removeWithKey(fixture, chip('c')!);

    expect(chip('c')).toBeNull();
    expect(document.activeElement).toBe(chip('b'));
  });

  it('calls the focus fallback when the removed chip was the only one', async () => {
    const { fixture, chip } = setup();
    fixture.componentInstance.items.set(['a']);
    fixture.detectChanges();

    await removeWithKey(fixture, chip('a')!);

    expect(fallbackCalls).toHaveLength(1);
  });

  it('does not prevent Backspace on a disabled chip', () => {
    const { fixture, chip } = setup();
    fixture.componentInstance.disabledItem.set('a');
    fixture.detectChanges();

    const event = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
    chip('a')!.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(chip('a')!.getAttribute('aria-disabled')).toBe('true');
    expect(fixture.componentInstance.items()).toEqual(['a', 'b', 'c']);
  });
});
