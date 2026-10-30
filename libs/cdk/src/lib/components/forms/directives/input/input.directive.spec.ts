import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormFieldStateService, InputStateService } from '../../services';
import { InputDirective } from './input.directive';

@Component({
  template: `<input [formControl]="control()" etInput />`,
  imports: [ReactiveFormsModule, InputDirective],
  providers: [InputStateService, FormFieldStateService],
})
class HostComponent {
  control = signal(new FormControl('ok'));
  input = viewChild.required(InputDirective);
}

describe('InputDirective control swap', () => {
  it('follows a [formControl] that is replaced by an invalid control', async () => {
    vi.useFakeTimers();

    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(10);

    const input = fixture.componentInstance.input();
    const invalid: boolean[] = [];
    input.invalid$.subscribe((v) => invalid.push(v));

    expect(input.errors).toBeNull();

    const next = new FormControl('abc', Validators.minLength(13));
    fixture.componentInstance.control.set(next);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(10);

    expect(input.errors).toEqual(next.errors);
    expect(invalid.at(-1)).toBe(true);

    next.setValue('x');
    await vi.advanceTimersByTimeAsync(10);
    expect(input.errors?.['minlength']?.actualLength).toBe(1);

    vi.useRealTimers();
  });
});
