import { definePart, drawing, forceInteraction, interactionRows, ng } from '@design-system';
import { control } from '@ethlete/components/design/control';
import { icon } from '@system/foundations/icons';

type TitleSearchInteraction = 'hover' | 'active' | 'focus-visible';

type Os = 'linux' | 'windows' | 'macos';

export type Props = { product: string; part: string; os?: Os; interaction?: TitleSearchInteraction };

const INTERACTIONS = ['hover', 'active', 'focus-visible'] as const;

const kbdPlatform = (os: Os | undefined) => (os === 'macos' ? 'apple' : 'other');

/** The search field as an Angular template for `ng()`, with `BUTTON_IMPORTS` and `KBD_IMPORTS`. */
export const titleSearch = ({ product, part, os, interaction }: Props) => {
  const drawn = control(
    `<button et-button type="button" variant="tonal" color="surface" size="xs" stretchContents class="w-2xl justify-start px-space-2 text-et-surface-muted hover:text-et-surface active:text-et-surface focus-visible:text-et-surface [--et-button-gap:var(--space-2)]" aria-haspopup="dialog" aria-label="Suchen in ${product}, ${part}">${icon(
      'search',
      { size: 14 },
    )}<span class="flex min-w-0 flex-1 justify-center-safe gap-1 font-ui"><span class="shrink-0">${product}</span><span class="shrink-0" aria-hidden="true">/</span><span class="min-w-0 truncate text-et-surface font-ui-strong">${part}</span></span><et-kbd class="[--et-kbd-color:currentColor] [&_.et-kbd-key]:leading-(--text-xs-line)" data-et-skip="CLIPPED" keys="mod+k" platform="${kbdPlatform(os)}" /></button>`,
    'search',
  );

  return interaction ? forceInteraction(drawn, interaction) : drawn;
};

export const imports = ['BUTTON_IMPORTS', 'KBD_IMPORTS'];

export const { states, grid } = interactionRows<Props, 'studio' | 'long', TitleSearchInteraction>(
  {
    studio: { product: 'studio', part: 'Title bar' },
    long: { product: 'studio', part: 'Canvas viewport with a long part name that has to be cut off', os: 'macos' },
  },
  { interactions: INTERACTIONS, force: (props, interaction) => ({ ...props, interaction }) },
);

export default definePart({
  implements: 'apps/ethlete-studio/src/app/components/title-search/title-search.component.ts',
  note: 'The search field in the window title bar: a wide tonal field that names the product and part you are in and opens the command palette (click or Ctrl K / ⌘ K). Search icon, product name and shortcut are muted at rest and take the full surface text colour when hovered, pressed or focused; the product name is always whole; a part name too long for the field ends in an ellipsis and the label then starts at the left instead of the centre. Each row draws the field at rest, hovered, pressed and focused; the long row cuts the part name off with an ellipsis and shows the macOS shortcut.',
  madeBy: ['claude-opus-5-5'],
  states,
  grid,
  controls: { search: { kind: 'button', input: ['pointer', 'keyboard'] } },
  render: async (props: Props) =>
    drawing({
      body: await ng(titleSearch(props), { imports }),
    }),
});
