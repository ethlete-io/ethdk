import { SDK_ICONS } from '@ethlete/components/design/icon-set';
import { definePart, iconSheet } from '@design-system';

const GRID = 16;

const PADDING = 1;

const svg = (body: string) =>
  `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

const FILL = 'fill="currentColor" stroke="none"';

const REDRAWN: Record<string, string> = {
  'et-arrow-out-up-right': svg(
    '<path d="M5.5 5.5H4A1.5 1.5 0 0 0 2.5 7v5A1.5 1.5 0 0 0 4 13.5h5a1.5 1.5 0 0 0 1.5-1.5v-1.5"/><path d="M9.5 2.5h4v4M13.5 2.5l-6 6"/>',
  ),
  'et-arrow-right': svg('<path d="M2.5 8.5h11M9 4l4.5 4.5L9 13"/>'),
  'et-arrow-up': svg('<path d="M8.5 13.5v-11M4 7l4.5-4.5L13 7"/>'),
  'et-arrows-left-right': svg('<path d="M2 8.5h12M5.5 5 2 8.5 5.5 12M10.5 5 14 8.5 10.5 12"/>'),
  'et-calendar': svg('<rect x="2.5" y="3.5" width="11" height="10" rx="1.5"/><path d="M5.5 2v3M10.5 2v3M2.5 6.5h11"/>'),
  'et-check': svg('<path d="M2.5 8.5 6 12l7.5-7.5"/>'),
  'et-chevron': svg('<path d="M3 10.5 8 5.5l5 5"/>'),
  'et-circle-check': svg('<circle cx="8" cy="8" r="6.25"/><path d="M5.25 8.25 7.2 10.2 10.75 6.5"/>'),
  'et-circle-info': svg(
    `<circle cx="8" cy="8" r="6.25"/><path d="M8 7.25V11"/><circle cx="8" cy="4.75" r=".85" ${FILL}/>`,
  ),
  'et-clipboard-check': svg(
    '<path d="M5.5 3.5H4A1.5 1.5 0 0 0 2.5 5v7A1.5 1.5 0 0 0 4 13.5h8a1.5 1.5 0 0 0 1.5-1.5V5A1.5 1.5 0 0 0 12 3.5h-1.5"/><rect x="5.5" y="2" width="5" height="2.5" rx=".75"/><path d="M5.5 9 7.25 10.75 10.5 7.5"/>',
  ),
  'et-clock': svg('<circle cx="8" cy="8" r="6.25"/><path d="M8 4.5V8l2.5 1.5"/>'),
  'et-ellipsis': svg(
    `<circle cx="3" cy="8" r="1.25" ${FILL}/><circle cx="8" cy="8" r="1.25" ${FILL}/><circle cx="13" cy="8" r="1.25" ${FILL}/>`,
  ),
  'et-ellipsis-vertical': svg(
    `<circle cx="8" cy="3" r="1.25" ${FILL}/><circle cx="8" cy="8" r="1.25" ${FILL}/><circle cx="8" cy="13" r="1.25" ${FILL}/>`,
  ),
  'et-eye': svg(
    '<path d="M1.75 8C3 5.5 5.25 3.5 8 3.5s5 2 6.25 4.5C13 10.5 10.75 12.5 8 12.5S3 10.5 1.75 8Z"/><circle cx="8" cy="8" r="2"/>',
  ),
  'et-eye-slash': svg(
    '<mask id="et-eye-slash-cut"><rect width="16" height="16" fill="#fff"/><path d="M2.5 2.5l11 11" stroke="#000" stroke-width="4.2"/></mask><g mask="url(#et-eye-slash-cut)"><path d="M1.75 8C3 5.5 5.25 3.5 8 3.5s5 2 6.25 4.5C13 10.5 10.75 12.5 8 12.5S3 10.5 1.75 8Z"/><circle cx="8" cy="8" r="2"/></g><path d="M2.5 2.5l11 11"/>',
  ),
  'et-eyedropper': svg(
    '<path d="M2 14l.67-.67h2l5.67-5.67"/><path d="M2.67 13.33v-2l5.67-5.67"/><path d="M10 4l1.93-1.93a1.37 1.37 0 0 1 1.93 1.93L11.93 5.93l.27.27a1.37 1.37 0 0 1-1.93 1.93l-2.4-2.4a1.37 1.37 0 0 1 1.93-1.93l.2.2Z"/>',
  ),
  'et-file': svg(
    '<path d="M9 2H5a1.5 1.5 0 0 0-1.5 1.5v9A1.5 1.5 0 0 0 5 14h6a1.5 1.5 0 0 0 1.5-1.5V5.5M9 2l3.5 3.5M9 2v3.5h3.5"/>',
  ),
  'et-floppy-disk': svg(
    '<path d="M2.5 2.5H11l2.5 2.5v7a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 12Z"/><path d="M5.5 2.5v3h4v-3M5.5 10.5h5"/>',
  ),
  'et-focus-frame': svg(
    `<rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><rect x="5.5" y="5.5" width="5" height="5" rx=".75" ${FILL}/>`,
  ),
  'et-grid-2x2': svg('<rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><path d="M8 2.5v11M2.5 8h11"/>'),
  'et-image': svg(
    `<rect x="1.5" y="2.5" width="13" height="11" rx="1.5"/><circle cx="5.25" cy="5.75" r="1.1" ${FILL}/><path d="M3.75 11 6.5 8l1.6 1.75L10 6.5l2.25 4.5Z" ${FILL}/>`,
  ),
  'et-location': svg(
    '<path d="M8 14.25s-4.75-4.2-4.75-7.75a4.75 4.75 0 0 1 9.5 0c0 3.55-4.75 7.75-4.75 7.75Z"/><circle cx="8" cy="6.5" r="1.75"/>',
  ),
  'et-lock': svg(
    `<path d="M5.5 7.5V4.75a2.5 2.5 0 0 1 5 0V7.5"/><rect x="2.5" y="7.5" width="11" height="6" rx="1.5"/><circle cx="8" cy="10.5" r="1" ${FILL}/>`,
  ),
  'et-minus': svg('<path d="M3.5 8.5h10"/>'),
  'et-pause': svg(
    `<rect x="4" y="3" width="3" height="10" rx=".75" ${FILL}/><rect x="9" y="3" width="3" height="10" rx=".75" ${FILL}/>`,
  ),
  'et-pencil': svg(
    '<path d="M2.5 13.5l.75-3.1L9.6 4.05a1.3 1.3 0 0 1 1.85 0l.5.5a1.3 1.3 0 0 1 0 1.85L5.6 12.75Z"/><path d="M8.5 5.25l2.25 2.25"/>',
  ),
  'et-play': svg('<path d="M5 3.5v9l7.5-4.5Z" fill="currentColor"/>'),
  'et-plus': svg('<path d="M8.5 3.5v10M3.5 8.5h10"/>'),
  'et-quote': svg(
    `<path d="M6.5 4.5C4.5 5.17 3.5 6.83 3.5 8.83V11.5H7V8H5.17c0-1.33.47-2.2 1.33-2.67Z" ${FILL}/><path d="M12.5 4.5c-2 .67-3 2.33-3 4.33v2.67H13V8h-1.83c0-1.33.47-2.2 1.33-2.67Z" ${FILL}/>`,
  ),
  'et-redo': svg('<path d="M10 10l3.5-3.5L10 3M13.5 6.5h-7a3.5 3.5 0 0 0 0 7h2"/>'),
  'et-rotate-right': svg(
    '<path d="M2.75 6A5.5 5.5 0 0 1 12.25 4M13.5 2v4h-4M13.25 10A5.5 5.5 0 0 1 3.75 12M2.5 14v-4h4"/>',
  ),
  'et-star': svg(
    '<path d="M8 2.5l1.62 3.88 4.18.33-3.18 2.74.97 4.09L8 11.35l-3.59 2.19.97-4.09L2.2 6.71l4.18-.33Z" fill="currentColor"/>',
  ),
  'et-thumbtack': svg('<path d="M6 2.5h4M6.75 2.5v3.75L4.5 9.5h7L9.25 6.25V2.5M8 9.5v4"/>'),
  'et-times': svg('<path d="M4 4l8 8M12 4l-8 8"/>'),
  'et-trash': svg(
    '<path d="M2.5 4h11M6 4V2.75A.75.75 0 0 1 6.75 2h2.5a.75.75 0 0 1 .75.75V4M3.75 4l.7 8.75A1.25 1.25 0 0 0 5.7 14h4.6a1.25 1.25 0 0 0 1.25-1.25l.7-8.75M6.5 7v4M9.5 7v4"/>',
  ),
  'et-triangle-exclamation': svg(
    `<path d="M8 1.75 14.25 13.75H1.75Z"/><path d="M8 6.25v3"/><circle cx="8" cy="11.4" r=".85" ${FILL}/>`,
  ),
  'et-trophy': svg(
    '<path d="M4.5 2.5h7V6a3.5 3.5 0 0 1-7 0Z"/><path d="M4.5 3.5h-2v1a2.5 2.5 0 0 0 2.2 2.48M11.5 3.5h2v1a2.5 2.5 0 0 1-2.2 2.48M8 9.5v2M5 13.5h6l-.5-2h-5Z"/>',
  ),
  'et-undo': svg('<path d="M6 10 2.5 6.5 6 3M2.5 6.5h7a3.5 3.5 0 0 1 0 7h-2"/>'),
  'et-upload': svg(
    '<path d="M8 10V2.5M4.5 6 8 2.5 11.5 6M2.5 10.5V12A1.5 1.5 0 0 0 4 13.5h8a1.5 1.5 0 0 0 1.5-1.5v-1.5"/>',
  ),
};

const icons = SDK_ICONS.map((icon) => {
  const name = icon.variant ? `${icon.name}--${icon.variant}` : icon.name;

  return { name, svg: REDRAWN[name] ?? icon.data, grid: GRID, padding: PADDING };
});

const titles = {
  catalogue: `Icons: the ${SDK_ICONS.length} icons the SDK ships, at each size a component draws`,
  construction: `Every icon on the ${GRID} px candidate grid: pixel lines, centre lines, and the ${PADDING} px padding`,
};

type View = 'catalogue' | 'construction';

export default definePart<{ view: View }>({
  note: 'The 16 px redraw: every icon the SDK ships on the 16 px grid with 1 px padding. The icons off it are redrawn here; the rest are read from libs/components/src/lib/icon/headless.',
  madeBy: ['claude-opus-5-5'],
  states: { catalogue: { view: 'catalogue' }, construction: { view: 'construction' } },
  render: ({ view }) => iconSheet({ view, title: titles[view], icons, sizes: [16, 20, 24] }),
});
