import { definePart, drawing, html } from '@design-system';
import button from '@system/components/button';
import partTree from '@system/elements/part-tree';
import canvasFrames from '@system/elements/canvas-frames';
import shellMain from '@system/elements/shell-main';
import { PAGE_PIN, pageShot, pinMark } from './sketch-data';
import { agentLogo } from './agent-logos';
import kit from './sketch-data.css?inline';
import styles from './sketches.css?inline';

export default definePart({
  note: 'A focused variant has its identity, author, note and Merge in a small inspector; only a/b labels sit above the frames. The canvas runs behind the panel to the window edge. Cost: changing variant requires selection, and the floating inspector occludes part of the canvas.',
  madeBy: ['gpt-6'],
  states: { 'zoomed-page': {} },
  checks: { skip: ['CLIPPED'] },
  render: async () => {
    const side = await partTree.render({
      layers: [
        { title: 'Elements', open: true, parts: [{ name: 'part-tree', leaf: true }] },
        { title: 'Pages', open: true, parts: [{ name: 'system', leaf: true, selected: true }] },
      ],
    });
    const tree = await partTree.render(partTree.states['components-open']);
    const frames = await canvasFrames.render(canvasFrames.states.default);
    const open = await shellMain.render({
      section: 'System',
      product: 'studio',
      side: tree.body,
      content: frames.body,
    });
    const hidden = await shellMain.render({
      section: 'System',
      product: 'studio',
      side: tree.body,
      content: frames.body,
      panel: 'hidden',
    });
    const merge = await button.render({ label: 'Merge', variant: 'outline', size: 'sm' });
    const discard = await button.render({ label: 'Verwerfen', variant: 'transparent', size: 'sm' });
    const fit = await button.render({ label: 'Fit', variant: 'transparent', size: 'sm' });
    const content = html`<div class="zc-page" data-treatment="inspector">
      <header class="zc-head">
        <span class="sk-head-title">pages/system</span><span class="sk-status">In Arbeit</span
        ><span class="zc-gap"></span>${discard.body}
      </header>
      <div class="zc-round">
        <span class="sk-round-key">Runde 1</span><span class="sk-round-title">Mehr Platz für die Leinwand</span>
      </div>
      <section class="zc-world" aria-label="Varianten bei 60 Prozent Zoom">
        <figure class="sk-frame zc-frame">${pageShot('current', open.body)}</figure>
        <figure class="sk-frame zc-frame" data-selected>${pageShot('a', hidden.body, pinMark(PAGE_PIN))}</figure>
        <figure class="sk-frame zc-frame">${pageShot('b', open.body)}</figure>
      </section>
      <span class="zc-frame-id">a</span><span class="zc-frame-id" data-next>b</span>
      <aside class="zc-inspector">
        <span class="zc-name">Variante a</span><span class="sk-author">${agentLogo('claude', 'sk-logo')}Claude</span
        ><span class="zc-note">Panel ausgeblendet</span>${merge.body}
      </aside>
      <div class="st-canvas-zoom">${fit.body}<span class="st-canvas-zoom-value">60%</span></div>
    </div>`;
    const shell = await shellMain.render({ section: 'Sketches', product: 'studio', side: side.body, content });
    return drawing({
      body: shell.body,
      styles: shell.styles + side.styles + tree.styles + frames.styles + merge.styles + discard.styles + kit + styles,
    });
  },
});
