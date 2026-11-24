/**
 * Reads, in the drawn frame of one state, what a human would see broken: images that did not load, text cut off
 * or running out of its box, and content larger than the frame (cut off, or a scrollbar in the cell).
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
      clips: clips(style),
      ellipsis: style.textOverflow === 'ellipsis',
      scroll: { width: el.scrollWidth, height: el.scrollHeight },
      client: { width: el.clientWidth, height: el.clientHeight },
      clippers,
    });
  }
  const page = document.scrollingElement;
  return {
    viewport: { width: innerWidth, height: innerHeight },
    page: { width: page.scrollWidth, height: page.scrollHeight },
    root: rectOf(root),
    boxes: all.map((el) => ({ element: nameOf(el), box: visibleOf(el) })),
    images,
    texts,
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
    const clipper = text.clippers.find((up) => outside(text.textBox, up.box) > SLACK);
    if (
      text.clips &&
      (text.scroll.width > text.client.width + SLACK || text.scroll.height > text.client.height + SLACK)
    )
      add(
        `Text ${quote} ist abgeschnitten${text.ellipsis ? ' (endet mit …)' : ''}.`,
        `${text.element} ist ${text.client.width}x${text.client.height} groß, der Text braucht ${text.scroll.width}x${text.scroll.height}.`,
      );
    else if (!text.clips && outside(text.textBox, text.box) > SLACK)
      add(
        `Text ${quote} läuft aus seinem Kasten.`,
        `Text ${text.textBox.width}x${text.textBox.height} in ${text.element} ${text.box.width}x${text.box.height}.`,
      );
    else if (clipper)
      add(
        `Text ${quote} wird vom Rand abgeschnitten.`,
        `Text ragt ${outside(text.textBox, clipper.box)} px über ${clipper.element} hinaus, das überlaufenden Inhalt versteckt.`,
      );
  }
  const spill = probe.boxes.filter(({ box }) => shown(box) && outside(box, probe.root) > SLACK);
  if (spill.length || probe.page.width > probe.viewport.width + SLACK)
    add(
      `Inhalt ist größer als der Rahmen (${probe.root.width}x${probe.root.height}) und wird abgeschnitten.`,
      spill.length
        ? `${spill
            .slice(0, 3)
            .map(({ element, box }) => `${element} ${box.width}x${box.height} bei ${box.x},${box.y}`)
            .join('; ')}.`
        : `Seite ist ${probe.page.width} px breit.`,
    );
  return findings;
};

const IMAGE = /\.(png|jpe?g|webp|avif|gif|svg)(\?|$)/i;

/** Opens the frame of one state the way the shot route draws it and returns its probe and failed image requests. */
export const probeFrame = async ({ page, url }) => {
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
    await page.goto(url, { waitUntil: 'load', timeout: 120_000 });
    await page.waitForFunction("document.getElementById('root')?.childElementCount > 0", null, { timeout: 60_000 });
    await page
      .waitForFunction('[...document.images].every((image) => image.complete)', null, { timeout: 15_000 })
      .catch(() => undefined);
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined);
    return { probe: await page.evaluate(PROBE_SCRIPT), failedImages: [...new Set(failedImages)] };
  } finally {
    page.off('response', onResponse);
    page.off('requestfailed', onFailed);
  }
};
