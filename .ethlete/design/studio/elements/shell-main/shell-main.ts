import { definePart, drawing } from '@design-system';
import { box, heading, icon, select, tabs, textLines } from '@design-system/kit';
import tokens from '@system/foundations/tokens.css?inline';
import styles from './shell-main.css?inline';

type Section = 'System' | 'Sketches' | 'Flows' | 'Inbox';

type Props = {
  section: Section;
  product: string;
  content: string;
  side: string;
};

const SECTIONS: Section[] = ['System', 'Sketches', 'Flows', 'Inbox'];

const row = (children: string[], gap = 8) => box(children, { direction: 'row', plain: true, padding: 0, gap });

const header = (section: Section, product: string) =>
  `<div class="st-shell-bar">${row([icon({ glyph: 'studio' }), heading('Studio', { size: 16 })])}${select({ value: product, width: 200 })}${tabs(SECTIONS, { active: section })}</div>`;

export default definePart<Props>({
  note: 'Shell b: a top bar with the logo, the product select and the four sections, over a side list and the content.',
  madeBy: ['claude-opus-5-5'],
  widths: [1440],
  states: {
    system: {
      section: 'System',
      product: 'studio',
      content: textLines({ lines: 3, width: 320 }),
      side: textLines({ lines: 6, width: 160 }),
    },
  },
  render: ({ section, product, content, side }) =>
    drawing({
      body: box(
        [
          `<div class="st-shell">${header(section, product)}<div class="st-shell-side">${side}</div><div class="st-shell-content">${content}</div></div>`,
        ],
        { padding: 0, gap: 0, height: 900 },
      ),
      styles: tokens + styles,
    }),
});
