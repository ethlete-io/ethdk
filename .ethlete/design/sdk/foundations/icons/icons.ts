import { SDK_ICONS } from '@ethlete/components/design/icon-set';
import { definePart, iconSheet } from '@design-system';

const icons = SDK_ICONS.map((icon) => ({
  name: icon.variant ? `${icon.name}--${icon.variant}` : icon.name,
  svg: icon.data,
}));

const titles = {
  catalogue: `Icons: the ${SDK_ICONS.length} icons the SDK ships, at each size a component draws`,
  construction: 'Icons on their grid: pixel lines, centre lines, and the padding',
};

type View = 'catalogue' | 'construction';

export default definePart<{ view: View }>({
  note: 'Every icon the SDK ships, read from the icon source files in libs/components/src/lib/icon/headless, with its registered name.',
  madeBy: ['claude-opus-5-5'],
  states: { catalogue: { view: 'catalogue' }, construction: { view: 'construction' } },
  render: ({ view }) => iconSheet({ view, title: titles[view], icons, sizes: [16, 20, 24] }),
});
