import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { OverlayImports, provideOverlay } from '../../../overlay';
import { FilterOverlayLinkDirective } from '../../directives';
import { FilterOverlayService } from '../../services';
import { FilterOverlayStorybookComponent } from './filter-overlay.storybook.component';

@Component({
  selector: 'et-sb-filter-one',
  template: `
    <h1>Please select a filter</h1>
    <button etFilterOverlayLink="/two">Filter A</button>
    <button etFilterOverlayLink="/three">Filter B</button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [FilterOverlayLinkDirective],
})
export class FilterOneComponent {}

@Component({
  selector: 'et-sb-filter-two',
  template: `
    <h1>Filter A</h1>
    <button etFilterOverlayLink="/">Back</button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [FilterOverlayLinkDirective],
})
export class FilterTwoComponent {}

@Component({
  selector: 'et-sb-filter-three',
  template: `
    <h1>Filter B</h1>
    <button etFilterOverlayLink="/">Back</button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  standalone: true,
  imports: [FilterOverlayLinkDirective],
})
export class FilterThreeComponent {}

@Component({
  selector: 'et-sb-filter-overlay-host',
  template: ` <button (click)="transformingBottomSheetToDialog()" type="button">Open filter</button> `,
  standalone: true,
  imports: [OverlayImports, NgIf],
  providers: [provideOverlay(), FilterOverlayService],
})
export class FilterOverlayHostStorybookComponent {
  private readonly _overlayService = inject(FilterOverlayService);

  transformingBottomSheetToDialog() {
    this._overlayService.open(FilterOverlayStorybookComponent, {
      form: new FormGroup({}),
      defaultFormValue: {},
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
        positions: this._overlayService.positions.transformingBottomSheetToDialog({}),
      },
    });
  }
}
