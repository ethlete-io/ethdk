import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { provideValidatorErrorsService } from '../../../../../../services';
import { ComboboxImports } from '../../combobox.imports';
import { ComboboxDirective } from '../../directives/combobox';

@Component({
  template: `
    <et-select-field [formControl]="control">
      <et-combobox [options]="options" [multiple]="false" bindLabel="label" bindValue="value" />
    </et-select-field>
  `,
  imports: [ComboboxImports, ReactiveFormsModule],
})
class ComboboxHostComponent {
  control = new FormControl<string | null>('a');
  options = [
    { label: 'Apple', value: 'a' },
    { label: 'Banana', value: 'b' },
  ];
}

describe('ComboboxComponent clear button', () => {
  it('keeps the input focused by cancelling mousedown', async () => {
    TestBed.configureTestingModule({ providers: [provideValidatorErrorsService()] });
    const fixture = TestBed.createComponent(ComboboxHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const clear = fixture.nativeElement.querySelector('.et-combobox-clear') as HTMLButtonElement;
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });

    clear.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });
});

type Option = { label: string; value: string };

@Component({
  template: `
    <et-select-field [formControl]="control">
      <et-combobox [options]="options()" [multiple]="false" bindLabel="label" bindValue="value" />
    </et-select-field>
  `,
  imports: [ComboboxImports, ReactiveFormsModule],
})
class AsyncOptionsComboboxHostComponent {
  control = new FormControl<string | null>('b');
  options = signal<Option[]>([]);
}

describe('ComboboxComponent with a pre-filled control and async options', () => {
  const asyncOptions: Option[] = [
    { label: 'Apple', value: 'a' },
    { label: 'Banana', value: 'b' },
  ];

  const setup = async (initialValue: string) => {
    TestBed.configureTestingModule({ providers: [provideValidatorErrorsService()] });
    const fixture = TestBed.createComponent(AsyncOptionsComboboxHostComponent);
    fixture.componentInstance.control.setValue(initialValue);
    fixture.detectChanges();
    await fixture.whenStable();

    const combobox = fixture.debugElement.query(By.directive(ComboboxDirective)).injector.get(ComboboxDirective);

    const loadOptions = async () => {
      fixture.componentInstance.options.set(asyncOptions);
      fixture.detectChanges();
      await fixture.whenStable();
    };

    return { fixture, combobox, control: fixture.componentInstance.control, loadOptions };
  };

  it('keeps the control value while the options are empty', async () => {
    const { control } = await setup('b');

    expect(control.value).toBe('b');
  });

  it('selects the option once options containing the value arrive', async () => {
    const { control, combobox, loadOptions } = await setup('b');

    await loadOptions();

    expect(control.value).toBe('b');
    expect(combobox._selectionModel.selection).toEqual([asyncOptions[1]]);
    expect(combobox.currentFilter).toBe('Banana');
  });

  it('keeps the control value when the loaded options do not contain it', async () => {
    const { control, loadOptions } = await setup('z');

    await loadOptions();

    expect(control.value).toBe('z');
  });

  it('writes null when the user clears the value', async () => {
    const { control, combobox, loadOptions } = await setup('z');

    await loadOptions();
    combobox.clearValue();

    expect(control.value).toBeNull();
  });

  it('writes null when the user clears before the options arrive', async () => {
    const { control, combobox, loadOptions } = await setup('b');

    combobox.clearValue();
    await loadOptions();

    expect(control.value).toBeNull();
  });
});
