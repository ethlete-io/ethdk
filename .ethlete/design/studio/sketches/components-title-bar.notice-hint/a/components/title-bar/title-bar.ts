import { definePart, drawing, html, ng, svgAsset, withAction } from '@design-system';
import captionClose from '@assets/icons/caption-close.svg?raw';
import captionMaximize from '@assets/icons/caption-maximize.svg?raw';
import captionMinimize from '@assets/icons/caption-minimize.svg?raw';
import { button } from '@ethlete/components/design/button';
import { icon } from '@system/foundations/icons';
import titleSearchPart from '@system/components/title-search';
import {
  controls,
  errorClose,
  grid,
  imports,
  LABELS,
  MAC_RESERVE,
  states,
  titleBarControl,
  windowControls,
  type Props,
  type WindowButton,
} from '@shared/chrome';
import styles from './title-bar.css?inline';

const captionGlyphs: Record<WindowButton, string> = {
  minimize: captionMinimize,
  maximize: captionMaximize,
  close: captionClose,
};

const captionControls = (props: Props, buttons: WindowButton[]) =>
  `<div class="flex self-stretch">${buttons
    .map((button) => {
      const tile = titleBarControl(
        `<button et-window-control-button type="button" color="surface" size="md" shape="caption"${
          button === 'close' ? ' kind="close"' : ''
        } data-et-action="emit:${button}" aria-label="${LABELS[button]}">${svgAsset(captionGlyphs[button], { size: '1em', attrs: { 'aria-hidden': 'true' } })}</button>`,
        button,
        props,
      );

      return button === 'close' ? errorClose(tile) : tile;
    })
    .join('')}</div>`;

const sideControls = (props: Props, buttons: WindowButton[]) =>
  props.os === 'windows' ? captionControls(props, buttons) : windowControls(props, buttons);

const update = (props: Props) =>
  titleBarControl(
    withAction(button({ label: 'Update', variant: 'filled', color: 'brand', size: 'xs' }), 'emit:update'),
    'update',
    props,
  );

const notice = (props: Props) =>
  titleBarControl(
    withAction(
      button({
        label: 'Neu starten',
        variant: 'tonal',
        color: 'brand',
        size: 'xs',
        icon: icon('up-down', { size: 12 }),
      }),
      'emit:restart',
    ),
    'notice',
    props,
  );

const noticeHint = ({ noticeText }: Props) =>
  noticeText ? `<span class="whitespace-nowrap text-et-surface-muted" data-code-notice>${noticeText}</span>` : '';

export default definePart({
  implements: 'apps/ethlete-studio/src/app/components/title-bar/title-bar.component.ts',
  note: 'The window title bar: a compact 32 px drag region on the app background, closed off from the content below by a 1 px bottom border. The centred search field (components/title-search) names the product and part you are in and draws its own states. Update, a filled brand button, shows only when an update is ready and ends the bar before the window controls. macOS reserves 78 px left for the native traffic lights (drawn as three neutral grey dots, like an inactive window); Linux draws round buttons on the side its button layout gives; Windows draws square tiles with a red close hover. The grid draws each control at rest, hovered, pressed and focused: Update (linux-full-update), minimize (linux-left), the round close (linux-close), maximize (windows) and the square close (windows-update).',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5'],
  widths: [1440],
  states,
  grid,
  controls,
  render: async (props: Props) => {
    const search = await titleSearchPart.render({ product: props.product, part: props.part, os: props.os });

    return drawing({
      body: html`<div
        class="st-title-bar grid h-8 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-et-surface-border bg-et-surface-bg ${props.os === 'windows' ? 'pl-1.5' : 'px-1.5'} text-et-surface font-ui text-ui-sm"
        data-et-surface
        data-tauri-drag-region="deep"
      >
        ${await ng(
          `<div class="flex items-center gap-2">${props.os === 'macos' ? MAC_RESERVE : ''}${sideControls(props, props.left)}</div>`,
          { imports },
        )}${search.body}${await ng(
          `<div class="flex items-center justify-end gap-2 ${props.os === 'windows' ? 'self-stretch' : ''}">${noticeHint(props)}${props.notice ? notice(props) : ''}${props.update ? update(props) : ''}${sideControls(props, props.right)}</div>`,
          { imports },
        )}
      </div>`,
      styles,
    });
  },
});
