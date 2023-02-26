import { BLOCKS } from '@contentful/rich-text-types';
import { RichTextResponse } from '@ethlete/contentful';

export const CONTENTFUL_RICH_TEXT_DUMMY_DATA = {
  data: {
    pageCollection: {
      items: [
        {
          hero: {
            sys: { id: '26DvSto8QNmkTOLw8lioLc' },
            headline: 'Unser Team 2022/23',
            subline:
              'Seit September 2020 stehen vier eFootballer im Kader von Borussia Dortmund: Sie sind jung, talentiert, reichweitenstark, passioniert und einfach gut. Die eFootballer unterhalten die schwarzgelbe Gaming-Community regelmäßig mit abwechslungsreichen Streaming- & Video-Formaten. Watchparties, eFriendlies und Interviews mit BVB-Profis gehören zum Programm. Und auch die Interaktion mit der Community kommt nicht zu kurz.',
            type: 'default',
            picture: {
              sys: { id: 'qQZvhNfto19LJ3TsxF5rv' },
              url: 'https://images.ctfassets.net/wcqlxk2zon25/qQZvhNfto19LJ3TsxF5rv/4eaf22f492741ed0061ebf2724a73af2/ImagePlaceholder.png',
              title: 'G eFootball Verlaengerung bvbinfobild regular',
              width: 2560,
              height: 1096,
              description: null,
              contentType: 'image/png',
              size: 2556518,
            },
          },
          content: {
            json: {
              nodeType: 'document',
              data: {},
              content: [
                {
                  nodeType: 'embedded-entry-block',
                  data: {
                    target: {
                      sys: {
                        id: 'lLeh1chqXefXwEEsfuGH3',
                        type: 'Link',
                        linkType: 'Entry',
                      },
                    },
                  },
                },
                {
                  nodeType: 'embedded-entry-block',
                  data: { target: { sys: { id: '6kizyVeRlmAI5BPY4E2Qof', type: 'Link', linkType: 'Entry' } } },
                  content: [],
                },
                { nodeType: 'paragraph', data: {}, content: [{ nodeType: 'text', value: '', marks: [], data: {} }] },
                {
                  nodeType: 'embedded-asset-block',
                  data: {
                    target: {
                      sys: {
                        id: '39AMJFgxyYaU1DAOeAhrbf',
                        type: 'Link',
                        linkType: 'Asset',
                      },
                    },
                  },
                  content: [],
                },
              ],
            },
            links: {
              entries: {
                block: [
                  {
                    sys: { id: '6kizyVeRlmAI5BPY4E2Qof' },
                    __typename: 'ContentTeaserHero',
                    title: 'BVB-eFootballer verlängern für die Saison 2022/23',
                    image: {
                      sys: { id: 'qQZvhNfto19LJ3TsxF5rv' },
                      url: 'https://images.ctfassets.net/wcqlxk2zon25/qQZvhNfto19LJ3TsxF5rv/4eaf22f492741ed0061ebf2724a73af2/ImagePlaceholder.png',
                      title: 'G eFootball Verlaengerung bvbinfobild regular',
                      width: 2560,
                      height: 1096,
                      description: null,
                      contentType: 'image/png',
                      size: 2556518,
                    },
                    url: '/news',
                    urlTarget: 'internal',
                  },
                  {
                    __typename: 'Image',
                    sys: {
                      id: 'lLeh1chqXefXwEEsfuGH3',
                    },
                    asset: {
                      sys: {
                        id: '6Td2RxBig6AFndUFkZkZ86',
                      },
                      url: 'https://images.ctfassets.net/wcqlxk2zon25/6Td2RxBig6AFndUFkZkZ86/15a900e3911e593c67bdb7ead6a9b07a/G-Emre-Vertragsunterschrift_regular.jpg',
                      title: 'G-Emre-Vertragsunterschrift regular',
                      width: 1760,
                      height: 1172,
                      description: null,
                      contentType: 'image/jpeg',
                      size: 929272,
                    },
                    srcsetSizes: ['400', '1200', '200x200'],
                    sizes: ['(max-width: 400px) 400px', '(max-width: 1200px) 1200px', '200x200'],
                    alt: 'Bild von Erné Embeli',
                    caption: 'Erné Embeli unterschreibt den Vertrag',
                    resizeBehavior: 'pad',
                    focusArea: 'top_left',
                    quality: 10,
                    backgroundColor: null,
                  },
                ],
              },
              assets: {
                block: [
                  {
                    sys: { id: '39AMJFgxyYaU1DAOeAhrbf' },
                    __typename: 'Asset',
                    url: 'https://images.ctfassets.net/wcqlxk2zon25/qQZvhNfto19LJ3TsxF5rv/4eaf22f492741ed0061ebf2724a73af2/ImagePlaceholder.png',
                    title: 'G eFootball Verlaengerung bvbinfobild regular',
                    width: 2560,
                    height: 1096,
                    description: null,
                    contentType: 'image/png',
                    size: 2556518,
                  },
                ],
              },
            },
          },
        },
      ],
    },
  },
} as const;

export const CONTENTFUL_RICHTEXT_TEST_DATA_EN: RichTextResponse = {
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

export const CONTENTFUL_RICHTEXT_TEST_DATA_DE: RichTextResponse = {
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
