import { AsyncPipe, JsonPipe, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { BLOCKS } from '@contentful/rich-text-types';
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
import { CONTENTFUL_RICH_TEXT_DUMMY_DATA } from './contentful-rich-text-dummy-data';
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
  RICHTEXT_TEST!: RichTextResponse | null;

  RICHTEXT_TEST_EN: RichTextResponse = {
    json: {
      nodeType: BLOCKS.DOCUMENT,
      data: {},
      content: [
        {
          data: {},
          content: [
            {
              data: {},
              marks: [
                {
                  type: 'bold',
                },
              ],
              value: 'What you need to know',
              nodeType: 'text',
            },
          ],
          nodeType: BLOCKS.HEADING_3,
        },
        {
          data: {},
          content: [
            {
              data: {},
              marks: [],
              value:
                '\nOn 30.11.22 at 18:00 the Winter Cup starts in the first round! To participate, all team members must be at least 16 years old. You also need a Playstation 5 with PS+ membership and FIFA 22.',
              nodeType: 'text',
            },
          ],
          nodeType: BLOCKS.PARAGRAPH,
        },
        {
          data: {},
          content: [
            {
              data: {},
              content: [
                {
                  data: {},
                  content: [
                    {
                      data: {},
                      marks: [],
                      value:
                        'After the registration deadline we will inform you by e-mail if you have a starting place and provide you with all information about the tournament.',
                      nodeType: 'text',
                    },
                  ],
                  nodeType: BLOCKS.PARAGRAPH,
                },
              ],
              nodeType: BLOCKS.LIST_ITEM,
            },
            {
              data: {},
              content: [
                {
                  data: {},
                  content: [
                    {
                      data: {},
                      marks: [],
                      value:
                        'To participate you have to be at least two people. So grab your FIFA partners and register!  Your team can consist of max. 4 players.',
                      nodeType: 'text',
                    },
                  ],
                  nodeType: BLOCKS.PARAGRAPH,
                },
              ],
              nodeType: BLOCKS.LIST_ITEM,
            },
            {
              data: {},
              content: [
                {
                  data: {},
                  content: [
                    {
                      data: {},
                      marks: [],
                      value:
                        'After the group stage, the winning team will be played in single elimination mode - whoever loses once is out!',
                      nodeType: 'text',
                    },
                  ],
                  nodeType: BLOCKS.PARAGRAPH,
                },
              ],
              nodeType: BLOCKS.LIST_ITEM,
            },
          ],
          nodeType: BLOCKS.UL_LIST,
        },
        {
          data: {},
          content: [
            {
              data: {},
              marks: [],
              value: 'Please note:',
              nodeType: 'text',
            },
          ],
          nodeType: BLOCKS.HEADING_3,
        },
        {
          data: {},
          content: [
            {
              data: {},
              marks: [],
              value:
                '\nRegistration and participation are free of charge. Attention: In case of non-participation or false entries, you will be immediately excluded from participation in this and further BVB tournaments.',
              nodeType: 'text',
            },
          ],
          nodeType: BLOCKS.PARAGRAPH,
        },
        {
          data: {},
          content: [
            {
              data: {},
              marks: [],
              value:
                "To register for the tournament, please log in with your BVB account, or create a new account if you don't have a BVB account yet.",
              nodeType: 'text',
            },
          ],
          nodeType: BLOCKS.PARAGRAPH,
        },
      ],
    },
    links: {
      assets: {},
    },
  };

  RICHTEXT_TEST_DE: RichTextResponse = {
    json: {
      data: {},
      content: [
        {
          data: {},
          content: [
            {
              data: {},
              marks: [],
              value: 'Das müsst ihr wissen',
              nodeType: 'text',
            },
          ],
          nodeType: BLOCKS.HEADING_3,
        },
        {
          data: {},
          content: [
            {
              data: {},
              marks: [],
              value:
                'Am 30.11.22 um 18:00 Uhr startet der Wintercup in die erste Runde! Für die Teilnahme müssen alle Teammitglieder mindestens 16 Jahre alt sein. Zudem benötigt ihr eine Playstation 5 mit PS+ Mitgliedschaft sowie FIFA 22.',
              nodeType: 'text',
            },
          ],
          nodeType: BLOCKS.PARAGRAPH,
        },
        {
          data: {},
          content: [
            {
              data: {},
              content: [
                {
                  data: {},
                  content: [
                    {
                      data: {},
                      marks: [],
                      value:
                        'Wir informieren euch nach Anmeldeschluss per E-Mail darüber, ob ihr einen Startplatz ergattert habt und versorgen euch mit allen Informationen zum Turnierablauf.',
                      nodeType: 'text',
                    },
                  ],
                  nodeType: BLOCKS.PARAGRAPH,
                },
              ],
              nodeType: BLOCKS.LIST_ITEM,
            },
            {
              data: {},
              content: [
                {
                  data: {},
                  content: [
                    {
                      data: {},
                      marks: [],
                      value:
                        'Für die Teilnahme müsst ihr mindestens zu zweit sein. Also schnappt euch eure FIFA-Partner und meldet euch an!  Euer Team darf aus max. 4 Spielern bestehen.',
                      nodeType: 'text',
                    },
                  ],
                  nodeType: BLOCKS.PARAGRAPH,
                },
              ],
              nodeType: BLOCKS.LIST_ITEM,
            },
            {
              data: {},
              content: [
                {
                  data: {},
                  content: [
                    {
                      data: {},
                      marks: [],
                      value:
                        'Nach der Gruppenphase wird das Gewinner-Team im Single Elimination Modus ausgespielt - wer einmal verliert ist raus!',
                      nodeType: 'text',
                    },
                  ],
                  nodeType: BLOCKS.PARAGRAPH,
                },
              ],
              nodeType: BLOCKS.LIST_ITEM,
            },
          ],
          nodeType: BLOCKS.UL_LIST,
        },
        {
          data: {},
          content: [
            {
              data: {},
              marks: [],
              value: 'Bitte beachtet:',
              nodeType: 'text',
            },
          ],
          nodeType: BLOCKS.HEADING_3,
        },
        {
          data: {},
          content: [
            {
              data: {},
              marks: [],
              value:
                'Die Anmeldung und Teilnahme sind kostenlos. Achtung: Bei Nichtantritt oder Falschangaben, wirst du umgehend von der Teilnahme an diesem und weiteren BVB Turnieren ausgeschlossen.',
              nodeType: 'text',
            },
          ],
          nodeType: BLOCKS.PARAGRAPH,
        },
        {
          data: {},
          content: [
            {
              data: {},
              marks: [],
              value:
                '\nUm dich für das Turnier anzumelden, logge dich bitte mit deinem BVB-Account ein, oder erstelle ein neues Konto, wenn du noch keinen BVB-Account hast.',
              nodeType: 'text',
            },
          ],
          nodeType: BLOCKS.PARAGRAPH,
        },
      ],
      nodeType: BLOCKS.DOCUMENT,
    },
    links: {
      assets: {
        block: [],
      },
    },
  };

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

    this.RICHTEXT_TEST = this.lang === 'de' ? this.RICHTEXT_TEST_DE : this.RICHTEXT_TEST_EN;
    // setTimeout(() => {
    //   this.seoDirective.updateConfig({ title: 'updated', description: 'Sandbox app 123' });
    // }, 5000);
  }

  toggleTheme() {
    this.currentTheme = this.currentTheme === 'primary' ? 'accent' : 'primary';
  }

  updateText() {
    this.lang = this.lang === 'de' ? 'en' : 'de';
    this.RICHTEXT_TEST = this.lang === 'de' ? this.RICHTEXT_TEST_DE : this.RICHTEXT_TEST_EN;
  }

  showDialog() {
    this._dialogService.open(DialogExampleComponent);
  }

  showBottomSheet() {
    this._bottomSheetService.open(BottomSheetExampleComponent);
  }
}
