import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { ChipRemoveDirective } from './chip-remove.directive';
import { ChipDirective } from './chip.directive';

@Component({
  template: `
    <span
      [disabled]="disabled()"
      [removable]="removable()"
      (remove)="removeCount = removeCount + 1"
      etChip
      tabindex="-1"
    >
      Chip
      <button etChipRemove>x</button>
    </span>
  `,
  imports: [ChipDirective, ChipRemoveDirective],
})
class ChipTestHost {
  disabled = signal(false);
  removable = signal(true);
  removeCount = 0;
}

describe('ChipDirective', () => {
  let fixture: ComponentFixture<ChipTestHost>;
  let chip: HTMLElement;
  let removeButton: HTMLButtonElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ChipTestHost] });
    fixture = TestBed.createComponent(ChipTestHost);
    fixture.detectChanges();
    chip = fixture.nativeElement.querySelector('[etChip]');
    removeButton = fixture.nativeElement.querySelector('[etChipRemove]');
  });

  it('reflects removable and disabled as data attributes', () => {
    expect(chip.getAttribute('data-removable')).toBe('true');
    expect(chip.getAttribute('data-disabled')).toBeNull();

    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();

    expect(chip.getAttribute('data-disabled')).toBe('true');
    expect(chip.getAttribute('aria-disabled')).toBe('true');
  });

  it('emits remove on remove button click', () => {
    removeButton.click();
    expect(fixture.componentInstance.removeCount).toBe(1);
  });

  it('emits remove on Backspace and Delete', () => {
    chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    expect(fixture.componentInstance.removeCount).toBe(2);
  });

  it('does not emit remove when disabled', () => {
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();

    removeButton.click();
    chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));

    expect(fixture.componentInstance.removeCount).toBe(0);
  });

  it('does not emit remove when not removable', () => {
    fixture.componentInstance.removable.set(false);
    fixture.detectChanges();

    removeButton.click();
    chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));

    expect(fixture.componentInstance.removeCount).toBe(0);
  });

  it('keeps the remove button out of the tab order and labelled', () => {
    expect(removeButton.getAttribute('tabindex')).toBe('-1');
    expect(removeButton.getAttribute('type')).toBe('button');
    expect(removeButton.getAttribute('aria-label')).toBe('Remove');
  });

  it('disables the native remove button while the chip is disabled', () => {
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();

    expect(removeButton.hasAttribute('disabled')).toBe(true);
  });
});
