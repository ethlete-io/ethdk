import { JsonPipe, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ViewEncapsulation, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Validators } from '@ethlete/core';
import { OverlayImports, provideOverlay } from '../../../../overlay';
import { FILTER_OVERLAY_REF } from '../../constants';
import { FilterOverlayLinkDirective } from '../../directives';
import { FilterOverlayService } from '../../services';
import { FilterOverlayRef } from '../../utils';
import { FilterOverlayStorybookComponent } from './filter-overlay.storybook.component';

type FilterForm = {
  acceptTermsAndConditions: FormControl<boolean | null>;
  personalInformation: FormGroup<{
    firstName: FormControl<string | null>;
    lastName: FormControl<string | null>;
    email: FormControl<string | null>;
  }>;
};

@Component({
  selector: 'et-sb-filter-one',
  template: `
    <h1>Please select a filter</h1>
    <button etFilterOverlayLink="/two">Filter A</button>
    <button etFilterOverlayLink="/three">Filter B</button>

    <p>acceptTermsAndConditions: {{ filterOverlayRef.form.getRawValue().acceptTermsAndConditions }}</p>
    <p>firstName: {{ filterOverlayRef.form.getRawValue().personalInformation.firstName }}</p>
    <p>lastName: {{ filterOverlayRef.form.getRawValue().personalInformation.lastName }}</p>
    <p>email: {{ filterOverlayRef.form.getRawValue().personalInformation.email }}</p>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [FilterOverlayLinkDirective],
})
export class FilterOneComponent {
  private readonly _cdr = inject(ChangeDetectorRef);
  protected readonly filterOverlayRef = inject<FilterOverlayRef<FilterForm>>(FILTER_OVERLAY_REF);

  constructor() {
    this.filterOverlayRef.form.valueChanges.subscribe(() => this._cdr.markForCheck());
  }
}

@Component({
  selector: 'et-sb-filter-two',
  template: `
    <h1>Filter A</h1>

    <input
      [formControl]="filterOverlayRef.form.controls.personalInformation.controls.firstName"
      placeholder="Firstname"
    />
    <br />
    <br />
    <input
      [formControl]="filterOverlayRef.form.controls.personalInformation.controls.lastName"
      placeholder="Lastname"
    />
    <br />
    <br />
    <input [formControl]="filterOverlayRef.form.controls.personalInformation.controls.email" placeholder="Email" />

    <br />
    <br />

    <button etFilterOverlayLink="/">Back</button>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [FilterOverlayLinkDirective, ReactiveFormsModule],
})
export class FilterTwoComponent {
  protected readonly filterOverlayRef = inject<FilterOverlayRef<FilterForm>>(FILTER_OVERLAY_REF);
}

@Component({
  selector: 'et-sb-filter-three',
  template: `
    <h1>Filter B</h1>

    <input [formControl]="filterOverlayRef.form.controls.acceptTermsAndConditions" type="checkbox" />
    <br />
    <br />
    <button etFilterOverlayLink="/">Back</button>
  `,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [FilterOverlayLinkDirective, ReactiveFormsModule],
})
export class FilterThreeComponent {
  protected readonly filterOverlayRef = inject<FilterOverlayRef<FilterForm>>(FILTER_OVERLAY_REF);
}

@Component({
  selector: 'et-sb-filter-overlay-host',
  template: `
    <button (click)="transformingBottomSheetToDialog($event)" type="button">Open filter</button>

    <pre> {{ form.value | json }} </pre>
  `,
  standalone: true,
  imports: [OverlayImports, NgIf, JsonPipe],
  providers: [provideOverlay(), FilterOverlayService],
})
export class FilterOverlayHostStorybookComponent {
  private readonly _overlayService = inject(FilterOverlayService);

  form = new FormGroup<FilterForm>({
    acceptTermsAndConditions: new FormControl(false),
    personalInformation: new FormGroup({
      firstName: new FormControl('John'),
      lastName: new FormControl('Doe'),
      email: new FormControl<string | null>(null, Validators.IsEmail),
    }),
  });

  transformingBottomSheetToDialog(event: MouseEvent) {
    this._overlayService.open(FilterOverlayStorybookComponent, {
      form: this.form,
      defaultFormValue: {
        acceptTermsAndConditions: false,
        personalInformation: {
          firstName: null,
          lastName: null,
          email: null,
        },
      },
      pages: [
        {
          component: FilterOneComponent,
          route: '',
        },
        {
          component: FilterTwoComponent,
          route: 'two',
        },
        {
          component: FilterThreeComponent,
          route: 'three',
        },
      ],
      overlay: {
        positions: this._overlayService.positions.transformingFullScreenDialogToRightSheet({}),
        origin: event,
      },
    });
  }
}
