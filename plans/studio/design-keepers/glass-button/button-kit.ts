import { button, iconButton } from '@ethlete/components/design/button';
import { control } from '@ethlete/components/design/control';
import { iconMarkup } from '@ethlete/components/design/icon';
import { SDK_ICONS } from '@ethlete/components/design/icon-set';
import { drawing, forceInteraction, html, interactionRows, type Interaction } from '@design-system';
import backdrop from '@assets/titles/dune-part-two-2024-hintergrund.webp';

export type TfButtonKind = 'primary' | 'secondary' | 'icon';

/** A Tomflix button on the SDK `et-button` (`primary`, `secondary`) or `et-icon-button` (`icon`), 44px high. */
export type TfButtonOptions =
  | { kind: 'primary' | 'secondary'; label: string; icon?: string; disabled?: boolean; tag?: 'button' | 'a' }
  | { kind: 'icon'; icon: string; ariaLabel: string; disabled?: boolean; tag?: 'button' | 'a' };

/** Draws one Tomflix button as markup; it needs the part's `styles` (or `tfButtonStyles`) in the host's drawing. */
export const tfButton = (options: TfButtonOptions) => {
  const classes = `tf-button tf-button--${options.kind}`;
  const markup =
    options.kind === 'icon'
      ? iconButton({
          icon: options.icon,
          ariaLabel: options.ariaLabel,
          variant: 'outline',
          disabled: options.disabled,
          tag: options.tag,
          class: classes,
        })
      : button({
          label: options.label,
          icon: options.icon,
          variant: options.kind === 'primary' ? 'filled' : 'outline',
          disabled: options.disabled,
          tag: options.tag,
          class: classes,
        });

  return control(markup, 'button');
};

const fail = (message: string): never => {
  throw new Error(message);
};

const sdkIcon = (name: string) =>
  iconMarkup(SDK_ICONS.find((each) => each.name === name) ?? fail(`SDK_ICONS has no ${name}`));

export const tfIcons = {
  play: sdkIcon('et-play'),
  info: sdkIcon('et-circle-info'),
  plus: sdkIcon('et-plus'),
  filter: sdkIcon('et-filter'),
  more: sdkIcon('et-ellipsis'),
};

type ButtonInteraction = Exclude<Interaction, 'disabled'>;

type Props = (TfButtonOptions & { interaction?: ButtonInteraction }) | { kind: 'scene' };

const ROWS = {
  abspielen: { kind: 'primary', label: 'Abspielen', icon: tfIcons.play },
  'mehr-infos': { kind: 'secondary', label: 'Mehr Infos', icon: tfIcons.info },
  filter: { kind: 'icon', icon: tfIcons.filter, ariaLabel: 'Filter' },
  merken: { kind: 'secondary', label: 'Merken', icon: tfIcons.plus },
  'ueber-bild': { kind: 'scene' },
} satisfies Record<string, Props>;

const rows = interactionRows<Props, keyof typeof ROWS, Interaction, 'merken' | 'ueber-bild'>(ROWS, {
  interactions: ['hover', 'focus-visible', 'active', 'disabled'],
  force: (props, interaction) =>
    props.kind === 'scene'
      ? props
      : interaction === 'disabled'
        ? { ...props, disabled: true }
        : { ...props, interaction },
  restOnly: ['merken', 'ueber-bild'],
});

const scene = html`<div
  class="flex w-130 items-center gap-3 rounded-[0.8rem] bg-cover bg-position-[center_30%] px-8 pt-30 pb-8"
  style="background-image: url('${backdrop}')"
>
  ${tfButton({ kind: 'primary', label: 'Abspielen', icon: tfIcons.play })}
  ${tfButton({ kind: 'secondary', label: 'Mehr Infos', icon: tfIcons.info })}
  ${tfButton({ kind: 'icon', icon: tfIcons.more, ariaLabel: 'Weitere Aktionen' })}
</div>`;

/** States, grid, frame and render shared by every look of the Tomflix button; the look comes from the part's stylesheet. */
export const buttonPart = {
  ...rows,
  frame: (body: string) => `<div class="tf-button-frame p-4">${body}</div>`,
  render: (props: Props) => {
    if (props.kind === 'scene') return drawing({ body: scene });

    const { interaction, ...options } = props;
    const markup = tfButton(options);

    return drawing({ body: interaction ? forceInteraction(markup, interaction) : markup });
  },
};
