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
  openCount,
  withUncommittedHint,
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

const openedByHover = (markup: string) => markup.replace('<button ', '<button data-et-opened-by="hover" ');

const withHint = (markup: string, text: string | undefined, { force }: Props) =>
  text
    ? `<span class="relative inline-flex">${force?.control === 'notice' ? markup : openedByHover(markup)}<span class="st-notice-hint absolute top-full right-0 left-0 z-10 mt-2 flex justify-end">${tooltip({ text, placement: 'bottom-end' })}</span></span>`
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

const uncommittedState = (props: Props) =>
  props.uncommitted?.length
    ? withUncommittedHint(
        `<span class="inline-flex items-center gap-1 whitespace-nowrap text-et-surface-muted" data-uncommitted-state>${icon('pencil', { size: 12 })}${openCount(props.uncommitted)}</span>`,
        props,
      )
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
    props,
  );

export default definePart({
  implements: 'apps/ethlete-studio/src/app/components/title-bar/title-bar.component.ts',
  note: 'The window title bar: a compact 32 px drag region on the app background, closed off from the content below by a 1 px bottom border. The centred search field (components/title-search) names the product and part you are in and draws its own states. Update, a filled brand button, shows only when an update is ready and ends the bar before the window controls. macOS reserves 78 px left for the native traffic lights (drawn as three neutral grey dots, like an inactive window); Linux draws round buttons on the side its button layout gives; Windows draws the Windows 11 caption buttons: 46 x 32 px tiles at the full bar height, close flush with the top right edge, each with a glyph of 10 px ink (minimize a 10 x 1 px line), which `platformMeasures` declares and the check measures; a red close hover. The grid draws each control at rest, hovered, pressed and focused: Update (linux-full-update), the tonal Neu starten of the notice (linux-full-notice), minimize (linux-left), the round close (linux-close), maximize (windows) and the square close (windows-update). The push state of the checkout (unpushed commits, age of the oldest, push gate) is a small badge before Update: tonal, a check when the gate is green, the warning theme when it did not run on this head, and filled in the error theme when it is red; its title says fix before any feature slice. Neu starten is the SDK busy button: on click the tonal Neu starten button turns loading: the spinner covers the label, the button is disabled and aria-busy, takes no second press, and the tooltip is gone. A failed restart drops the busy state and shows the danger error toast (Neustart fehlgeschlagen) under the bar until dismissed; the tooltip stays gone, so it never covers the toast.',
  madeBy: ['claude-opus-5-5', 'claude-sonnet-5-5'],
  widths: [1440],
  states,
  grid,
  platformMeasures: [
    {
      platform: 'Windows 11',
      states: ['windows', 'windows-update'],
      target: '[aria-label="Minimieren"]',
      width: 46,
      height: 32,
      inset: { edge: '.st-title-bar', top: 0 },
      ink: { width: 10, height: 1 },
    },
    {
      platform: 'Windows 11',
      states: ['windows', 'windows-update'],
      target: '[aria-label="Maximieren"]',
      width: 46,
      height: 32,
      inset: { edge: '.st-title-bar', top: 0 },
      ink: { width: 10, height: 10 },
    },
    {
      platform: 'Windows 11',
      states: ['windows', 'windows-update'],
      target: '[aria-label="Schließen"]',
      width: 46,
      height: 32,
      inset: { edge: '.st-title-bar', top: 0, right: 0 },
      ink: { width: 10, height: 10 },
    },
  ],
  describe: {
    push: 'The Linux bar with the tonal 158 ungepusht · 5 h badge; check that the badge sits left of the window buttons on one line.',
    uncommitted:
      'The Linux bar with the muted pencil and 3 offen; check that the count sits left of the window buttons.',
    'uncommitted-push':
      'The bar with both the push badge and 3 offen; check their order and that neither wraps or pushes the search field.',
    'uncommitted-push-hint':
      '3 offen hovered with its tooltip; check the three kinds with their part names in the tooltip under the bar, aligned to the right.',
    'push-update': 'The push badge beside the brand Update button; check that both fit before the window buttons.',
    'macos-push':
      'The macOS bar with the push badge; check the reserved traffic-light space on the left and the badge at the right end.',
    'linux-full':
      'The Linux bar at rest; check minimize, maximize and close at the right and the centred search field with studio / Title bar.',
    'linux-left':
      'The left-hand Linux bar at rest; check close, minimize and maximize at the left and nothing at the right.',
    'linux-close': 'The close-only Linux bar at rest; check that only close shows at the right.',
    windows:
      'The Windows bar at rest; check the square window buttons at the full bar height, flush with the right edge.',
    macos: 'The macOS bar at rest; check the empty traffic-light space at the left and no window buttons.',
    'linux-full-update':
      'The Linux bar with the brand Update button; check that Update sits before the window buttons and keeps the bar at 32 px.',
    'linux-left-update':
      'The left-hand Linux bar with the brand Update button; check that Update sits alone at the right end and keeps the bar at 32 px.',
    'linux-close-update':
      'The close-only Linux bar with the brand Update button; check that Update sits before the window buttons and keeps the bar at 32 px.',
    'windows-update':
      'The Windows bar with the brand Update button; check that Update sits before the window buttons and keeps the bar at 32 px.',
    'macos-update':
      'The macOS bar with the brand Update button; check that Update sits at the right end and keeps the bar at 32 px.',
    'linux-full-notice':
      'The Linux bar with the tonal Neu starten button and its CLI geändert hint; check the hint under the bar and Update beside it.',
    'linux-left-notice':
      'The left-hand Linux bar with the tonal Neu starten button and its CLI geändert hint; check the hint under the bar and Update beside it.',
    'linux-close-notice':
      'The close-only Linux bar with the tonal Neu starten button and its CLI geändert hint; check the hint under the bar and Update beside it.',
    'windows-notice':
      'The Windows bar with the tonal Neu starten button and its CLI geändert hint; check the hint under the bar and Update beside it.',
    'macos-notice':
      'The macOS bar with the tonal Neu starten button and its CLI geändert hint; check the hint under the bar and Update beside it.',
    'linux-full-cli-dirty':
      'The Linux bar with the muted CLI-dirty text; check that the long text stays on one line and does not reach the search field.',
    'linux-left-cli-dirty':
      'The left-hand Linux bar with the muted CLI-dirty text; check that the long text stays on one line and does not reach the search field.',
    'linux-close-cli-dirty':
      'The close-only Linux bar with the muted CLI-dirty text; check that the long text stays on one line and does not reach the search field.',
    'windows-cli-dirty':
      'The Windows bar with the muted CLI-dirty text; check that the long text stays on one line and does not reach the search field.',
    'macos-cli-dirty':
      'The macOS bar with the muted CLI-dirty text; check that the long text stays on one line and does not reach the search field.',
    'linux-full-update-hover':
      'Update hovered in the Linux bar; check its hover fill and that the bar keeps its height.',
    'linux-full-update-active': 'Update pressed in the Linux bar; check its press fill.',
    'linux-full-update-focus-visible':
      'Update focused by keyboard in the Linux bar; check its focus ring, not clipped by the 32 px bar.',
    'linux-full-notice-hover':
      'Neu starten hovered in the Linux bar; check its hover fill and that the bar keeps its height.',
    'linux-full-notice-active': 'Neu starten pressed in the Linux bar; check its press fill.',
    'linux-full-notice-focus-visible':
      'Neu starten focused by keyboard in the Linux bar; check its focus ring, not clipped by the 32 px bar.',
    'linux-left-hover':
      'Minimize hovered in the left-hand Linux bar; check its hover fill and that the bar keeps its height.',
    'linux-left-active': 'Minimize pressed in the left-hand Linux bar; check its press fill.',
    'linux-left-focus-visible':
      'Minimize focused by keyboard in the left-hand Linux bar; check its focus ring, not clipped by the 32 px bar.',
    'linux-close-hover':
      'Close hovered in the close-only Linux bar; check its hover fill and that the bar keeps its height.',
    'linux-close-active': 'Close pressed in the close-only Linux bar; check its press fill.',
    'linux-close-focus-visible':
      'Close focused by keyboard in the close-only Linux bar; check its focus ring, not clipped by the 32 px bar.',
    'windows-hover': 'Maximize hovered in the Windows bar; check its hover fill and that the bar keeps its height.',
    'windows-active': 'Maximize pressed in the Windows bar; check its press fill.',
    'windows-focus-visible':
      'Maximize focused by keyboard in the Windows bar; check its focus ring, not clipped by the 32 px bar.',
    'windows-update-hover': 'Close hovered in the Windows bar; check its hover fill and that the bar keeps its height.',
    'windows-update-active': 'Close pressed in the Windows bar; check its press fill.',
    'windows-update-focus-visible':
      'Close focused by keyboard in the Windows bar; check its focus ring, not clipped by the 32 px bar.',
    'linux-full-notice-pending':
      'Neu starten after the click; check its spinner, that the hint is gone and the button takes no second click.',
    'linux-full-notice-failed':
      'A failed restart; check the Neustart fehlgeschlagen toast under the bar at the right, with its message and dismiss button.',
  },
  controls,
  render: async (props: Props) => {
    const search = await titleSearchPart.render({ product: props.product, part: props.part, os: props.os });

    return drawing({
      body: html`<div
          class="${props.notice && !props.restart ? 'pb-12' : ''} ${props.force?.control === 'uncommitted' ? 'pb-32' : ''}"
        >
          <div
            class="st-title-bar grid h-8 grid-cols-[1fr_auto_1fr] items-center gap-2 bg-et-surface-bg shadow-[inset_0_-1px_0_var(--color-et-surface-border)] ${props.os === 'windows' ? 'pl-1.5' : 'px-1.5'} text-et-surface font-ui text-ui-sm"
            data-et-surface
            data-tauri-drag-region="deep"
          >
            ${await ng(
              `<div class="flex items-center gap-2">${props.os === 'macos' ? MAC_RESERVE : ''}${sideControls(props, props.left)}</div>`,
              { imports },
            )}${search.body}
            <div class="flex items-center justify-end gap-2 ${props.os === 'windows' ? 'self-stretch' : ''}">
              ${pushState(props)}${uncommittedState(props)}${dirtyText(props)}${props.notice ? await notice(props) : ''}${await ng(
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
