import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideValidatorErrorsService } from '../../../../../../services';
import { ComboboxImports } from '../../combobox.imports';

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
