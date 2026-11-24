/**
 * Reads, in the drawn frame of one state, what a human would see broken: images that did not load, text whose ink is
 * cut off or runs out of its box, content larger than the frame, and a scrollbar on the page or on an element in it.
 * Runs in the page; returns plain data so `frameFindingsOf` can judge it without a browser.
 */
export const PROBE_SCRIPT = `(() => {
  const root = document.getElementById('root');
  if (!root) return null;
  const rectOf = (el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
  };
  const nameOf = (el) => {
    const classes = typeof el.className === 'string' ? el.className.trim().split(/\\s+/).filter(Boolean) : [];
    return el.tagName.toLowerCase() + (classes.length ? '.' + classes.slice(0, 2).join('.') : '');
  };
  const clips = (style) => style.overflowX !== 'visible' || style.overflowY !== 'visible';
  const visibleOf = (el) => {
    let { x, y, width, height } = rectOf(el);
    let right = x + width;
    let bottom = y + height;
    for (let up = el.parentElement; up && up !== root && root.contains(up); up = up.parentElement) {
      if (!clips(getComputedStyle(up))) continue;
      const r = rectOf(up);
      x = Math.max(x, r.x);
      y = Math.max(y, r.y);
      right = Math.min(right, r.x + r.width);
      bottom = Math.min(bottom, r.y + r.height);
    }
    return { x, y, width: Math.max(right - x, 0), height: Math.max(bottom - y, 0) };
  };
  const all = [...root.querySelectorAll('*')].filter((el) => {
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
  const images = all
    .filter((el) => el.tagName === 'IMG')
    .map((img) => ({
      element: nameOf(img),
      src: img.getAttribute('src') ?? '',
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      box: rectOf(img),
    }));
  const ink = document.createElement('canvas').getContext('2d');
  const inkInsetOf = (style, text) => {
    ink.font = [style.fontStyle, style.fontWeight, style.fontSize, style.fontFamily].join(' ');
    const m = ink.measureText(text);
    return {
      top: Math.max(Math.floor(m.fontBoundingBoxAscent - m.actualBoundingBoxAscent), 0),
      bottom: Math.max(Math.floor(m.fontBoundingBoxDescent - m.actualBoundingBoxDescent), 0),
    };
  };
  const texts = [];
  for (const el of all) {
    const own = [...el.childNodes].filter((node) => node.nodeType === 3 && node.textContent.trim());
    if (!own.length) continue;
    const range = document.createRange();
    range.selectNodeContents(el);
    const text = range.getBoundingClientRect();
    const style = getComputedStyle(el);
    const clippers = [];
    for (let up = el; up && up !== document.body; up = up.parentElement) {
      if (up === el ? false : clips(getComputedStyle(up))) clippers.push({ element: nameOf(up), box: rectOf(up) });
      if (up === root) break;
    }
    texts.push({
      element: nameOf(el),
      text: el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 60),
      box: rectOf(el),
      textBox: { x: Math.round(text.x), y: Math.round(text.y), width: Math.round(text.width), height: Math.round(text.height) },
      ink: inkInsetOf(style, own.map((node) => node.textContent).join(' ')),
      clips: clips(style),
      ellipsis: style.textOverflow === 'ellipsis',
      scroll: { width: el.scrollWidth, height: el.scrollHeight },
      client: { width: el.clientWidth, height: el.clientHeight },
      clippers,
    });
  }
  const page = document.scrollingElement;
  const px = (value) => parseFloat(value) || 0;
  const scrollbars = [];
  const pageBars = { vertical: innerWidth - page.clientWidth, horizontal: innerHeight - page.clientHeight };
  if (pageBars.vertical > 0 || pageBars.horizontal > 0)
    scrollbars.push({
      element: 'html',
      bars: pageBars,
      scroll: { width: page.scrollWidth, height: page.scrollHeight },
      client: { width: page.clientWidth, height: page.clientHeight },
    });
  for (const el of all) {
    const style = getComputedStyle(el);
    if (!/auto|scroll/.test(style.overflowX + ' ' + style.overflowY)) continue;
    const bars = {
      vertical: el.offsetWidth - el.clientWidth - px(style.borderLeftWidth) - px(style.borderRightWidth),
      horizontal: el.offsetHeight - el.clientHeight - px(style.borderTopWidth) - px(style.borderBottomWidth),
    };
    const overflows = el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1;
    if (bars.vertical > 0 || bars.horizontal > 0 || overflows)
      scrollbars.push({
        element: nameOf(el),
        bars,
        scroll: { width: el.scrollWidth, height: el.scrollHeight },
        client: { width: el.clientWidth, height: el.clientHeight },
      });
  }
  return {
    viewport: { width: innerWidth, height: innerHeight },
    page: { width: page.scrollWidth, height: page.scrollHeight },
    root: rectOf(root),
    boxes: all.map((el) => ({ element: nameOf(el), box: visibleOf(el) })),
    images,
    texts,
    scrollbars,
  };
})()`;

const SLACK = 1;

const outside = (inner, outer) =>
  Math.max(
    outer.x - inner.x,
    outer.y - inner.y,
    inner.x + inner.width - (outer.x + outer.width),
    inner.y + inner.height - (outer.y + outer.height),
  );

const shown = (box) => box.width > 0 && box.height > 0;

const inkBoxOf = ({ textBox, ink = { top: 0, bottom: 0 } }) => ({
  ...textBox,
  y: textBox.y + ink.top,
  height: Math.max(textBox.height - ink.top - ink.bottom, 0),
});

/**
 * The findings a human would notice in one drawn state, from its probe and the image requests that failed.
 * Each finding is `{ seen, cause }` in German, as `findings.md` lists them.
 */
export const frameFindingsOf = ({ probe, failedImages = [] }) => {
  if (!probe) return [];
  const findings = [];
  const add = (seen, cause) => findings.push({ seen, cause });
  for (const image of probe.images) {
    if (!image.src) add(`Bildfläche ${image.element} ist leer (kein Bild angegeben).`, '`<img>` ohne `src`.');
    else if (image.complete && image.naturalWidth === 0)
      add(`Bild ${image.element} fehlt (kaputtes Bild-Symbol).`, `\`${image.src}\` lädt nicht.`);
  }
  for (const url of failedImages)
    if (!probe.images.some((image) => url.endsWith(image.src)))
      add('Ein Hintergrundbild fehlt.', `\`${url}\` lädt nicht.`);
  for (const text of probe.texts) {
    if (!shown(text.box)) continue;
    const quote = `„${text.text}“`;
    const inkBox = inkBoxOf(text);
    const clipper = text.clippers.find((up) => outside(inkBox, up.box) > SLACK);
    if (
      text.clips &&
      (text.scroll.width > text.client.width + SLACK ||
        text.scroll.height > text.client.height + (text.ink?.bottom ?? 0) + SLACK)
    )
      add(
        `Text ${quote} ist abgeschnitten${text.ellipsis ? ' (endet mit …)' : ''}.`,
        `${text.element} ist ${text.client.width}x${text.client.height} groß, der Text braucht ${text.scroll.width}x${text.scroll.height}.`,
      );
    else if (!text.clips && outside(inkBox, text.box) > SLACK)
      add(
        `Text ${quote} läuft aus seinem Kasten.`,
        `Text ${text.textBox.width}x${text.textBox.height} in ${text.element} ${text.box.width}x${text.box.height}.`,
      );
    else if (clipper)
      add(
        `Text ${quote} wird vom Rand abgeschnitten.`,
        `Text ragt ${outside(inkBox, clipper.box)} px über ${clipper.element} hinaus, das überlaufenden Inhalt versteckt.`,
      );
  }
  for (const bar of probe.scrollbars ?? [])
    add(
      `${bar.element === 'html' ? 'Der Rahmen' : bar.element} zeigt eine Scrollleiste.`,
      `${bar.element} ist ${bar.client.width}x${bar.client.height} groß, der Inhalt ${bar.scroll.width}x${bar.scroll.height}${
        bar.scroll.width <= bar.client.width && bar.scroll.height <= bar.client.height
          ? ', er passt hinein und die Leiste bleibt trotzdem'
          : ''
      }.`,
    );
  const spill = probe.boxes.filter(({ box }) => shown(box) && outside(box, probe.root) > SLACK);
  const wide = probe.page.width > probe.viewport.width + SLACK;
  const tall = probe.page.height > probe.viewport.height + SLACK;
  if (spill.length || wide)
    add(
      `Inhalt ist größer als der Rahmen (${probe.root.width}x${probe.root.height}) und wird abgeschnitten.`,
      spill.length
        ? `${spill
            .slice(0, 3)
            .map(({ element, box }) => `${element} ${box.width}x${box.height} bei ${box.x},${box.y}`)
            .join('; ')}.`
        : `Seite ist ${probe.page.width} px breit.`,
    );
  else if (tall)
    add(
      `Inhalt ist höher als der Rahmen (${probe.viewport.width}x${probe.viewport.height}) und wird abgeschnitten.`,
      `Seite ist ${probe.page.height} px hoch.`,
    );
  return findings;
};

const IMAGE = /\.(png|jpe?g|webp|avif|gif|svg)(\?|$)/i;

const START_HEIGHT = 150;

const FOLLOW_HEIGHT = `<script>
    addEventListener('message', ({ data }) => {
      if (data?.type === 'design-explore:height') document.getElementById('cell').style.height = data.height + 'px';
    });
  </script>`;

const cellPageOf = (url, width, height) => `<!doctype html>
<body style="margin: 0">
  <iframe id="cell" style="display: block; border: 0; width: ${width}px; height: ${height ?? START_HEIGHT}px" src="${url}"></iframe>
  ${height ? '' : FOLLOW_HEIGHT}
</body>`;

/**
 * Opens the frame of one state the way a Studio cell shows it, `width` wide and as high as the frame reports (or a
 * fixed `height`, as a cell of a part drawn at a preset height), and
 * returns its probe and failed image requests. Launch the browser with scrollbars shown (`ignoreDefaultArgs: ['--hide-scrollbars']`).
 */
export const probeFrame = async ({ page, url, width, height }) => {
  const failedImages = [];
  const failed = (requestUrl) => {
    if (IMAGE.test(requestUrl)) failedImages.push(new URL(requestUrl).pathname);
  };
  const onResponse = (response) => {
    if (response.status() >= 400 && response.request().resourceType() === 'image') failed(response.url());
  };
  const onFailed = (request) => {
    if (request.resourceType() === 'image') failed(request.url());
  };
  page.on('response', onResponse);
  page.on('requestfailed', onFailed);
  try {
    await page.setContent(cellPageOf(url, width, height), { waitUntil: 'load', timeout: 120_000 });
    const cell = await (await page.$('#cell')).contentFrame();
    await cell.waitForFunction("document.getElementById('root')?.childElementCount > 0", null, { timeout: 60_000 });
    await cell
      .waitForFunction('[...document.images].every((image) => image.complete)', null, { timeout: 15_000 })
      .catch(() => undefined);
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    return { probe: await cell.evaluate(PROBE_SCRIPT), failedImages: [...new Set(failedImages)] };
  } finally {
    page.off('response', onResponse);
    page.off('requestfailed', onFailed);
  }
};
