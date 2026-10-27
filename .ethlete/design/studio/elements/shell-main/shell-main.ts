import { definePart, drawing } from '@design-system';
import { box, heading, textLines } from '@design-system/kit';
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

const PRODUCTS = ['studio', 'timetrack', 'docs'];

const MARKS: Record<Section, string> = { System: 'Sy', Sketches: 'Sk', Flows: 'Fl', Inbox: 'In' };

const bubble = (mark: string, active = false) =>
  `<div class="st-shell-slot"${active ? ' data-active' : ''}><div class="st-shell-bubble">${mark}</div></div>`;

const logo = `<div class="st-shell-slot" data-logo><div class="st-shell-bubble">St</div></div>`;

const rail = (section: Section, product: string) =>
  `<div class="st-shell-rail">${logo}<div class="st-shell-sep"></div>${SECTIONS.map((s) => bubble(MARKS[s], s === section)).join('')}<div class="st-shell-rail-gap"></div><div class="st-shell-sep"></div>${PRODUCTS.map((p) => bubble(p.charAt(0).toUpperCase(), p === product)).join('')}${bubble('+')}</div>`;

export default definePart<Props>({
  note: 'f',
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
          `<div class="st-shell">${rail(section, product)}<div class="st-shell-side"><div class="st-shell-side-head">${heading(product, { size: 16 })}</div><div class="st-shell-side-list">${side}</div><div class="st-shell-side-foot">${heading('ethlete-sdk · next', { size: 12 })}</div></div><div class="st-shell-content">${content}</div></div>`,
        ],
        { padding: 0, gap: 0, height: 900 },
      ),
      styles: tokens + styles,
    }),
});
