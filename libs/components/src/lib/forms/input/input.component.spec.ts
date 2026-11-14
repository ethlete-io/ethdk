import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { InputComponent } from './input.component';

@Component({
  template: `
    <et-input
      [(value)]="value"
      [clearable]="clearable()"
      [readonly]="readonly()"
      (valueChange)="changes.push($event)"
      aria-label="Search"
    />
  `,
  imports: [InputComponent],
})
class InputHost {
  value = signal('kickoff');
  clearable = signal(true);
  readonly = signal(false);
  changes: string[] = [];
}

describe('InputComponent - clear button', () => {
  const mount = () => {
    const fixture = TestBed.createComponent(InputHost);
    fixture.detectChanges();
    TestBed.tick();

    const host = fixture.nativeElement as HTMLElement;
    const native = () => host.querySelector<HTMLInputElement>('.et-input-native')!;
    const clearButton = () => host.querySelector<HTMLButtonElement>('.et-input-clear');
    const focus = () => {
      native().focus();
      TestBed.tick();
    };

    return { fixture, native, clearButton, focus };
  };

  it('shows only while the input is focused and holds a value', () => {
    const { fixture, clearButton, focus } = mount();

    expect(clearButton()).toBeNull();

    focus();
    expect(clearButton()).not.toBeNull();

    fixture.componentInstance.value.set('');
    TestBed.tick();
    expect(clearButton()).toBeNull();
  });

  it('is absent without clearable', () => {
    const { fixture, clearButton, focus } = mount();

    fixture.componentInstance.clearable.set(false);
    focus();

    expect(clearButton()).toBeNull();
  });

  it('is absent while readonly', () => {
    const { fixture, clearButton, focus } = mount();

    fixture.componentInstance.readonly.set(true);
    focus();

    expect(clearButton()).toBeNull();
  });

  it('empties the value, emits the change and keeps focus on the input', () => {
    const { fixture, native, clearButton, focus } = mount();

    focus();
    const refocus = vi.spyOn(native(), 'focus');
    clearButton()!.click();
    TestBed.tick();

    expect(fixture.componentInstance.value()).toBe('');
    expect(fixture.componentInstance.changes).toEqual(['']);
    expect(native().value).toBe('');
    expect(document.activeElement).toBe(native());
    expect(refocus).toHaveBeenCalled();
  });

  it('labels the button with the shared clear label', () => {
    const { clearButton, focus } = mount();

    focus();

    expect(clearButton()!.getAttribute('aria-label')).toBe('Clear');
    expect(clearButton()!.tabIndex).toBe(-1);
  });
});
