import { definePart, drawing, html, ng } from '@design-system';
import { button } from '@ethlete/components/design/button';
import titleSearchPart from '@system/components/title-search';
import {
  controls,
  grid,
  imports,
  MAC_RESERVE,
  states,
  titleBarControl,
  windowControls,
  type Props,
} from './shared/chrome';
import styles from './title-bar.css?inline';

const update = (props: Props) =>
  titleBarControl(
    button({ label: 'Update', variant: 'filled', color: 'brand', size: 'xs' }).replace(
      /<button\b/,
      '<button data-et-action="emit:update"',
    ),
    'update',
    props,
  );

export default definePart({
  implements: 'apps/ethlete-studio/src/app/components/title-bar/title-bar.component.ts',
  note: 'The window title bar: a compact 32 px drag region on the app background, closed off from the content below by a 1 px bottom border. The centred search field (components/title-search) names the product and part you are in and draws its own states. Update, a filled brand button, shows only when an update is ready and ends the bar before the window controls. macOS reserves 78 px left for the native traffic lights (drawn as three neutral grey dots, like an inactive window); Linux draws round buttons on the side its button layout gives; Windows draws square tiles with a red close hover. The grid draws each control at rest, hovered, pressed and focused: Update (linux-full-update), minimize (linux-left), the round close (linux-close), maximize (windows) and the square close (windows-update).',
  madeBy: ['claude-opus-5-5'],
  widths: [1440],
  states,
  grid,
  controls,
  render: async (props: Props) => {
    const search = await titleSearchPart.render({ product: props.product, part: props.part, os: props.os });

    return drawing({
      body: html`<div
        class="st-title-bar grid h-8 grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-et-surface-border bg-et-surface-bg px-1.5 text-et-surface font-ui text-ui-sm"
        data-et-surface
        data-tauri-drag-region="deep"
      >
        ${await ng(
          `<div class="flex items-center gap-2">${props.os === 'macos' ? MAC_RESERVE : ''}${windowControls(props, props.left)}</div>`,
          { imports },
        )}${search.body}${await ng(
          `<div class="flex items-center justify-end gap-2">${props.update ? update(props) : ''}${windowControls(props, props.right)}</div>`,
          { imports },
        )}
      </div>`,
      styles,
    });
  },
});
