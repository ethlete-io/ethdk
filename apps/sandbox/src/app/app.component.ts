import { AsyncPipe, JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import {
  BottomSheetService,
  BracketComponent,
  BracketConfig,
  BRACKET_MATCH_DATA_TOKEN,
  DialogService,
} from '@ethlete/components';
import { ContentfulModule } from '@ethlete/contentful';
import { ViewportService } from '@ethlete/core';
import { ThemeProviderDirective } from '@ethlete/theming';
import { AsyncTableComponent } from './async-table.component';
import { BottomSheetExampleComponent } from './bottom-sheet-example.component';
import { CONTENTFUL_RICH_TEXT_DUMMY_DATA } from './contentful-rich-text-dummy-data';
import { DialogExampleComponent } from './dialog-example.component';

@Component({
  selector: 'ethlete-test-comp',
  template: `<span>test {{ data.data.id }}</span>`,
  styles: [
    `
      :host {
        display: block;
        border: 1px solid red;
        height: 100px;
      }
    `,
  ],
})
export class TestCompComponent {
  data = inject(BRACKET_MATCH_DATA_TOKEN);
}

@Component({
  selector: 'ethlete-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [ThemeProviderDirective, AsyncPipe, JsonPipe, AsyncTableComponent, BracketComponent, ContentfulModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class AppComponent {
  currentTheme = 'primary';

  config: BracketConfig = {
    match: {
      component: TestCompComponent,
    },
  };

  contentfulData = CONTENTFUL_RICH_TEXT_DUMMY_DATA;

  // data = ET_DUMMY_DATA_DOUBLE_16;

  constructor(
    private _viewportService: ViewportService,
    private _dialogService: DialogService,
    private _bottomSheetService: BottomSheetService,
  ) {}

  toggleTheme() {
    this.currentTheme = this.currentTheme === 'primary' ? 'accent' : 'primary';
  }

  showDialog() {
    this._dialogService.open(DialogExampleComponent);
  }

  showBottomSheet() {
    this._bottomSheetService.open(BottomSheetExampleComponent);
  }
}
