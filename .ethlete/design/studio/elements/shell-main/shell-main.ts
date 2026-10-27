import { definePart, drawing } from '@design-system';
import { box, heading, icon, tabs, textLines } from '@design-system/kit';
import styles from './shell-main.css?inline';

type Section = 'System' | 'Sketches' | 'Flows' | 'Inbox';

type Props = {
  section: Section;
  content: string;
  side: string;
};

const SECTIONS: Section[] = ['System', 'Sketches', 'Flows', 'Inbox'];

const row = (children: string[], gap = 8) => box(children, { direction: 'row', plain: true, padding: 0, gap });

const header = (section: Section) =>
  `<div class="st-shell-bar">${box(
    [row([icon({ glyph: 'studio' }), heading('Studio', { size: 16 })]), tabs(SECTIONS, { active: section })],
    { direction: 'row', gap: 24, padding: 12 },
  )}</div>`;

export default definePart<Props>({
  note: 'Shell b: a top bar with the logo and the four sections, over a side list and the content.',
  madeBy: ['claude-opus-5-5'],
  states: {
    system: {
      section: 'System',
      content: textLines({ lines: 3, width: 320 }),
      side: textLines({ lines: 6, width: 160 }),
    },
  },
  render: ({ section, content, side }) =>
    drawing({
      body: `<div class="st-shell">${box(
        [
          header(section),
          box([box([side], { width: 240 }), box([content], { grow: true, padding: 24, gap: 20 })], {
            direction: 'row',
            plain: true,
            padding: 0,
            gap: 0,
            grow: true,
          }),
        ],
        { plain: true, padding: 0, gap: 0, fill: true },
      )}</div>`,
      styles,
    }),
});
