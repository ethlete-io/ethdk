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
