import { AsyncPipe, JsonPipe, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import {
  BottomSheetService,
  BracketComponent,
  BRACKET_MATCH_ID_TOKEN,
  createBracketConfig,
  DialogService,
} from '@ethlete/components';
import { ContentfulModule, RichTextResponse } from '@ethlete/contentful';
import { SeoDirective, ViewportService } from '@ethlete/core';
import { ThemeProviderDirective } from '@ethlete/theming';
import { BehaviorSubject } from 'rxjs';
import { AsyncTableComponent } from './async-table.component';
import { BottomSheetExampleComponent } from './bottom-sheet-example.component';
import {
  CONTENTFUL_RICHTEXT_TEST_DATA_DE,
  CONTENTFUL_RICHTEXT_TEST_DATA_EN,
  CONTENTFUL_RICH_TEXT_DUMMY_DATA,
} from './contentful-rich-text-dummy-data';
import { DialogExampleComponent } from './dialog-example.component';

@Component({
  selector: 'ethlete-test-comp',
  template: `<span>test {{ matchId }}</span>`,
  styles: [
    `
      :host {
        display: block;
        border: 1px solid red;
        height: 100px;
      }
    `,
  ],
  standalone: true,
  hostDirectives: [SeoDirective],
})
export class TestCompComponent {
  matchId = inject(BRACKET_MATCH_ID_TOKEN, { optional: true });
  seoDirective = inject(SeoDirective);

  title$ = new BehaviorSubject('bar');
  foo$ = new BehaviorSubject<string | null>('bar');

  constructor() {
    this.seoDirective.updateConfig({
      title: this.title$,
      foo: this.foo$,
      canonical: 'foo',
      description: 'foo',
      og: {
        title: 'foo',
        description: 'bar',
        type: 'foo',
        url: 'bar',
        image: 'foo',
        siteName: 'bar',
        locale: 'foo',
        localeAlternate: ['foo', 'bar'],
      },
    });

    setTimeout(() => {
      this.title$.next('bar - baz');
      this.foo$.next(null);
    }, 2500);
  }
}

@Component({
  selector: 'ethlete-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [
    ThemeProviderDirective,
    AsyncPipe,
    JsonPipe,
    AsyncTableComponent,
    BracketComponent,
    ContentfulModule,
    TestCompComponent,
    NgIf,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [SeoDirective],
})
export class AppComponent {
  currentTheme = 'primary';
  seoDirective = inject(SeoDirective);

  config = createBracketConfig({ matchComponent: TestCompComponent });

  contentfulData = CONTENTFUL_RICH_TEXT_DUMMY_DATA;

  seoShowComp = true;
  contentfulRichTextTest!: RichTextResponse | null;
  contentfulRichTextTestEn = CONTENTFUL_RICHTEXT_TEST_DATA_EN;
  contentfulRichTextTestDe = CONTENTFUL_RICHTEXT_TEST_DATA_DE;

  lang: 'de' | 'en' = 'en';
  // data = ET_DUMMY_DATA_DOUBLE_16;

  constructor(
    private _viewportService: ViewportService,
    private _dialogService: DialogService,
    private _bottomSheetService: BottomSheetService,
  ) {
    this.seoDirective.updateConfig({
      title: 'foo',
      description: 'Sandbox app',
      alternate: [
        { href: 'foo', hreflang: 'bar' },
        { href: 'foo2', hreflang: 'bar2' },
      ],
    });

    this.contentfulRichTextTest = this.lang === 'de' ? this.contentfulRichTextTestDe : this.contentfulRichTextTestEn;
    // setTimeout(() => {
    //   this.seoDirective.updateConfig({ title: 'updated', description: 'Sandbox app 123' });
    // }, 5000);
  }

  toggleTheme() {
    this.currentTheme = this.currentTheme === 'primary' ? 'accent' : 'primary';
  }

  updateText() {
    this.lang = this.lang === 'de' ? 'en' : 'de';
    this.contentfulRichTextTest = this.lang === 'de' ? this.contentfulRichTextTestDe : this.contentfulRichTextTestEn;
  }

  showDialog() {
    this._dialogService.open(DialogExampleComponent);
  }

  showBottomSheet() {
    this._bottomSheetService.open(BottomSheetExampleComponent);
  }
}
