import { definePart, drawing } from '@design-system';
import { box, button, heading, icon, select, tabs, textLines } from '@design-system/kit';
import styles from './shell-main.css?inline';

type Section = 'System' | 'Sketches' | 'Flows' | 'Inbox';

type Props = {
  section: Section;
  product: string | null;
  content: string;
  side?: string;
  panel?: string;
  overlay?: string;
};

const SECTIONS: Section[] = ['System', 'Sketches', 'Flows', 'Inbox'];

const row = (children: string[], gap = 8) => box(children, { direction: 'row', plain: true, padding: 0, gap });

const header = ({ section, product }: Pick<Props, 'section' | 'product'>) =>
  box(
    [
      row([icon({ glyph: 'studio' }), heading('Studio', { size: 16 })]),
      select({ value: product ?? 'No product', width: 200 }),
      tabs(
        SECTIONS.map((name) => (name === 'Inbox' ? 'Inbox 3' : name)),
        { active: section === 'Inbox' ? 'Inbox 3' : section },
      ),
      box([], { plain: true, padding: 0, grow: true }),
      button('Checkout: ethlete-sdk'),
    ],
    { direction: 'row', gap: 16, padding: 12, stackBelow: 760 },
  );

const placeholder = textLines({ lines: 3, width: 320 });

export default definePart<Props>({
  note: 'Shell b: a top bar with the product, the four sections and the checkout, over a side list, the content and a panel on demand.',
  madeBy: ['claude-opus-5-5'],
  states: {
    system: { section: 'System', product: 'studio', content: placeholder, side: textLines({ lines: 6, width: 160 }) },
    'panel open': {
      section: 'System',
      product: 'studio',
      content: placeholder,
      side: textLines({ lines: 6, width: 160 }),
      panel: textLines({ lines: 4 }),
    },
    inbox: { section: 'Inbox', product: 'studio', content: placeholder },
    'no product': { section: 'System', product: null, content: placeholder },
  },
  render: ({ section, product, content, side, panel, overlay }) =>
    drawing({
      body: `<div class="st-shell">${box(
        [
          header({ section, product }),
          box(
            [
              side ? box([side], { width: 240 }) : '',
              box([content], { grow: true, padding: 24, gap: 20 }),
              panel ? box([panel], { width: 320 }) : '',
            ],
            { direction: 'row', plain: true, padding: 0, gap: 0, grow: true, stackBelow: 760 },
          ),
        ],
        { plain: true, padding: 0, gap: 0, fill: true },
      )}${overlay ? `<div class="st-shell-overlay">${overlay}</div>` : ''}</div>`,
      styles,
    }),
});
