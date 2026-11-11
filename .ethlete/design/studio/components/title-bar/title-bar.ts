import { definePart, drawing, html, ng, svgAsset, withAction } from '@design-system';
import captionClose from '@assets/icons/caption-close.svg?raw';
import captionMaximize from '@assets/icons/caption-maximize.svg?raw';
import captionMinimize from '@assets/icons/caption-minimize.svg?raw';
import { button } from '@ethlete/components/design/button';
import { badge, badgeStyles } from '@ethlete/components/design/badge';
import { tooltip, tooltipStyles } from '@ethlete/components/design/tooltip';
import { loaderStyles } from '@ethlete/components/design/loader';
import { notification, notificationStack, notificationStyles } from '@ethlete/components/design/notification';
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
  pushCount,
  type Props,
  type WindowButton,
} from './shared/chrome';
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

const withHint = (markup: string, text: string | undefined) =>
  text
    ? `<span class="relative inline-flex">${markup}<span class="absolute top-full right-0 z-10 mt-2">${tooltip({ text, placement: 'bottom-end' })}</span></span>`
    : markup;

const dirtyText = ({ notice, noticeText }: Props) =>
  !notice && noticeText
    ? `<span class="whitespace-nowrap text-et-surface-muted" data-code-notice>${noticeText}</span>`
    : '';

const pushState = ({ push }: Props) =>
  push
    ? `<span class="inline-flex" data-push-state>${badge({
        label: `<span class="flex items-center gap-1 whitespace-nowrap"><span class="[text-box:trim-both_cap_alphabetic]">${pushCount(push)} · ${push.age}</span></span>`,
        variant: 'tonal',
        size: 'sm',
      })}</span>`
    : '';

const failedToast = ({ restart }: Props) =>
  restart === 'failed'
    ? `<div class="flex justify-end px-space-3 pt-space-3">${notificationStack([
        notification({
          status: 'error',
          color: 'danger',
          title: 'Neustart fehlgeschlagen',
          message: 'Der Design-Server antwortet nicht. Das Log steht im Studio-Menü.',
          attributes: 'data-et-surface-fill',
          dismissAttributes: 'data-et-control="dismiss" data-et-action="emit:dismiss"',
        }),
      ])}</div>`
    : '';

const restartButton = (markup: string, { restart }: Props) =>
  restart === 'pending' ? markup : withAction(markup, 'emit:restart');

const notice = async (props: Props) =>
  withHint(
    await ng(
      titleBarControl(
        restartButton(
          button({
            label: 'Neu starten',
            variant: 'tonal',
            color: 'brand',
            size: 'xs',
            icon: icon('up-down', { size: 12 }),
            loading: props.restart === 'pending',
          }),
          props,
        ),
        'notice',
        props,
      ),
      { imports },
    ),
    props.restart ? undefined : props.noticeText,
  );

export default definePart({
  implements: 'apps/ethlete-studio/src/app/components/title-bar/title-bar.component.ts',
  note: 'The window title bar: a compact 32 px drag region on the app background, closed off from the content below by a 1 px bottom border. The centred search field (components/title-search) names the product and part you are in and draws its own states. Update, a filled brand button, shows only when an update is ready and ends the bar before the window controls. macOS reserves 78 px left for the native traffic lights (drawn as three neutral grey dots, like an inactive window); Linux draws round buttons on the side its button layout gives; Windows draws square tiles with a red close hover. The grid draws each control at rest, hovered, pressed and focused: Update (linux-full-update), the tonal Neu starten of the notice (linux-full-notice), minimize (linux-left), the round close (linux-close), maximize (windows) and the square close (windows-update). The push state of the checkout (unpushed commits, age of the oldest, push gate) is a small badge before Update: tonal, a check when the gate is green, the warning theme when it did not run on this head, and filled in the error theme when it is red; its title says fix before any feature slice. Neu starten is the SDK busy button: on click the tonal Neu starten button turns loading: the spinner covers the label, the button is disabled and aria-busy, takes no second press, and the tooltip is gone. A failed restart drops the busy state and shows the danger error toast (Neustart fehlgeschlagen) under the bar until dismissed; the tooltip stays gone, so it never covers the toast.',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5'],
  widths: [1440],
  states,
  grid,
  controls,
  render: async (props: Props) => {
    const search = await titleSearchPart.render({ product: props.product, part: props.part, os: props.os });

    return drawing({
      body: html`<div class="${props.notice && !props.restart ? 'pb-12' : ''}">
          <div
            class="st-title-bar grid h-8 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-et-surface-border bg-et-surface-bg ${props.os === 'windows' ? 'pl-1.5' : 'px-1.5'} text-et-surface font-ui text-ui-sm"
            data-et-surface
            data-tauri-drag-region="deep"
          >
            ${await ng(
              `<div class="flex items-center gap-2">${props.os === 'macos' ? MAC_RESERVE : ''}${sideControls(props, props.left)}</div>`,
              { imports },
            )}${search.body}
            <div class="flex items-center justify-end gap-2 ${props.os === 'windows' ? 'self-stretch' : ''}">
              ${pushState(props)}${dirtyText(props)}${props.notice ? await notice(props) : ''}${await ng(
                `${props.update ? update(props) : ''}${sideControls(props, props.right)}`,
                { imports },
              )}
            </div>
          </div>
        </div>
        ${failedToast(props)}`,
      styles: [styles, tooltipStyles, loaderStyles, notificationStyles, badgeStyles].join('\n'),
    });
  },
});
