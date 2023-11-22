import { AsyncPipe, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ComboboxImports, provideValidatorErrorsService } from '@ethlete/cdk';
import { map, timer } from 'rxjs';

@Component({
  selector: 'ethlete-playground-combobox',
  templateUrl: './combobox.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [ReactiveFormsModule, ComboboxImports, AsyncPipe, JsonPipe],
  hostDirectives: [],
  providers: [provideValidatorErrorsService()],
})
export class PlaygroundComboboxComponent {
  DEFAULT_VALUE = [
    {
      type: 'foo',
      label: 'Foo',
    },
    {
      type: 'bar',
      label: 'Bar',
    },
  ];

  items$ = timer(300).pipe(
    map(() => {
      return [
        {
          type: 'foo',
          label: 'Foo',
          id: 1,
          stuff: 'stuff',
        },
        {
          type: 'bar',
          label: 'Bar',
          id: 2,
          stuff: 'stuff',
        },
        {
          type: 'baz',
          label: 'Baz',
          id: 3,
          stuff: null,
        },
      ];
    }),
  );

  ctrl = new FormGroup({
    a: new FormControl(null),
    b: new FormControl(null),
  });
}
