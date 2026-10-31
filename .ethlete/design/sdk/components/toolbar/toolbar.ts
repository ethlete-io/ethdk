import { toolbar, toolbarStyles, type ToolbarMockItem } from '@ethlete/components/design/toolbar';
import { SDK_ICONS } from '@ethlete/components/design/icon-set';
import { definePart, drawing } from '@design-system';
import frame from './toolbar.css?inline';

const icon = (name: string) => SDK_ICONS.find((each) => each.name === name)!;

type Interaction = 'hover' | 'active' | 'focus-visible';
type Control = 'bold' | 'italic' | 'underline' | 'bulleted' | 'numbered' | 'quote' | 'link';

type Props = {
  orientation?: 'horizontal' | 'vertical';
  /** The controls an interaction is forced on. */
  forced?: Control[];
  interaction?: Interaction;
  italicDisabled?: boolean;
  tabStop?: Control;
  size?: 'xs' | 'md' | 'lg' | 'xl';
};

const BUTTONS: { control: Control; icon: (typeof SDK_ICONS)[number]; label: string; pressed?: boolean }[] = [
  { control: 'bold', icon: icon('et-bold'), label: 'Bold', pressed: true },
  { control: 'italic', icon: icon('et-italic'), label: 'Italic', pressed: false },
  { control: 'underline', icon: icon('et-underline'), label: 'Underline', pressed: false },
  { control: 'bulleted', icon: icon('et-list-bulleted'), label: 'Bulleted list', pressed: true },
  { control: 'numbered', icon: icon('et-list-numbered'), label: 'Numbered list', pressed: false },
  { control: 'quote', icon: icon('et-quote'), label: 'Quote', pressed: false },
  { control: 'link', icon: icon('et-link'), label: 'Link' },
];

const GROUP_ENDS: Control[] = ['underline', 'numbered'];

const items = ({ forced = [], interaction, italicDisabled }: Props) =>
  BUTTONS.flatMap(({ control, icon, label, pressed }): ToolbarMockItem[] => {
    const attributes = [
      `data-et-control="${control}" data-can-animate`,
      interaction && forced.includes(control) && `data-et-force="${interaction}"`,
    ]
      .filter(Boolean)
      .join(' ');
    const button: ToolbarMockItem = {
      type: 'button',
      icon,
      label,
      pressed,
      disabled: control === 'italic' && italicDisabled,
      attributes,
    };

    return GROUP_ENDS.includes(control) ? [button, { type: 'divider' }] : [button];
  });

const render = (props: Props) => {
  const list = items(props);
  const tabStop = props.tabStop
    ? list.findIndex((item) => item.type === 'button' && item.attributes?.includes(`"${props.tabStop}"`))
    : undefined;

  return toolbar({ items: list, orientation: props.orientation, size: props.size, tabStop });
};

export default definePart({
  note: 'scale of the decided shape, Q182, lead merge',
  madeBy: ['claude-opus-5-5'],
  states: {
    default: {},
    hover: { interaction: 'hover', forced: ['bold', 'italic'] },
    active: { interaction: 'active', forced: ['bold', 'italic'] },
    'focus-visible': { interaction: 'focus-visible', forced: ['bold'] },
    'focus-visible-unpressed': { interaction: 'focus-visible', forced: ['italic'], tabStop: 'italic' },
    disabled: { italicDisabled: true },
    vertical: { orientation: 'vertical' },
    'size-xs': { size: 'xs' },
    'size-md': { size: 'md' },
    'size-lg': { size: 'lg' },
    'size-xl': { size: 'xl' },
  },
  widths: [528],
  controls: Object.fromEntries(
    BUTTONS.map(({ control }) => [control, { kind: 'button', input: ['pointer', 'keyboard'] }]),
  ),
  frame: (body) => `<div class="toolbar-frame">${body}</div>`,
  render: (props: Props) =>
    drawing({
      body: render(props),
      styles: [toolbarStyles, frame].join('\n'),
    }),
});
