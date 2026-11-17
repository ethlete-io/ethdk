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
  consumerAction: 'its buttons run the commands the consumer binds',
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
  describe: {
    default:
      'Seven format buttons in three groups with Bold and Bulleted pressed; check the dividers and the pressed fill.',
    hover: 'Pressed Bold and unpressed Italic hovered; check that hover reads on both and Bold stays pressed.',
    active: 'Pressed Bold and unpressed Italic pressed down; check that the press look is deeper than hover on both.',
    'focus-visible': 'The pressed Bold button focused by keyboard; check that the ring shows around the pressed fill.',
    'focus-visible-unpressed':
      'Italic as tab stop and focused by keyboard; check that the ring wraps the unpressed button.',
    disabled: 'Italic disabled; check that only Italic fades.',
    vertical: 'The toolbar stacked vertically; check that dividers turn horizontal between the groups.',
    'size-xs': 'The toolbar at size xs; check that buttons and icons shrink together.',
    'size-md': 'The toolbar at size md; check button and icon sizes against the default.',
    'size-lg': 'The toolbar at size lg; check that buttons and icons grow together.',
    'size-xl': 'The toolbar at size xl; check that it still fits the 528px frame.',
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
