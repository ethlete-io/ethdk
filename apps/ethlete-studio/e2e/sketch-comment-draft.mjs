/** Clicks Kommentar in the floating sketch toolbar, then the first drawn frame of a variant, and reports what comment mode showed. */
export const placeSketchDraft = async (page, timeout = 30_000) => {
  const toggle = page.locator('ethlete-sketches [data-sk-toolbar] button[data-sk-comment]');

  await toggle.click({ timeout });
  await page.waitForTimeout(300);

  const aim = await page.evaluate(() => {
    for (const frame of document.querySelectorAll(
      'ethlete-sketches [data-sk-variant]:not([data-sk-variant="current"]) [data-sk-frame]',
    )) {
      const box = frame.getBoundingClientRect();
      const x = Math.round(box.left + box.width / 2);
      const y = Math.round(box.top + Math.min(box.height / 2, 40));
      const top = document.elementFromPoint(x, y);

      if (box.width > 0 && box.height > 0 && top)
        return {
          x,
          y,
          frame: frame.getAttribute('data-sk-frame'),
          cursor: getComputedStyle(top).cursor,
          matrix: !!document.querySelector('ethlete-sketches [data-sk-matrix]'),
        };
    }

    return null;
  });
  const pressed = await toggle.getAttribute('aria-pressed');

  if (!aim) return { ok: false, detail: `comment mode ${pressed}: no frame on screen` };
  await page.mouse.click(aim.x, aim.y);

  const drafted = await page
    .locator('ethlete-sketches ethlete-comment-draft')
    .first()
    .waitFor({ timeout: 5000 })
    .then(
      () => true,
      () => false,
    );
  const pin = await page.evaluate(
    ({ x, y }) =>
      [...document.querySelectorAll('ethlete-sketches ethlete-comment-pin')].some((element) => {
        const box = element.getBoundingClientRect();

        return Math.abs(box.left - x) < 40 && Math.abs(box.bottom - y) < 40;
      }),
    aim,
  );

  return {
    ok: pressed === 'true' && aim.cursor === 'crosshair' && drafted && pin,
    detail: `${aim.matrix ? 'matrix' : 'list'} layout, frame ${aim.frame}: comment mode ${pressed}, cursor ${aim.cursor}, draft ${drafted}, draft pin at the click ${pin}`,
  };
};
