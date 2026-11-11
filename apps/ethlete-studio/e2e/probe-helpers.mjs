export const CANVAS = 'ethlete-design-canvas, ethlete-canvas-viewport';

const drawnIn = async (iframe) => {
  const frame = await iframe.contentFrame();

  if (!frame) return 'no frame';

  return Promise.race([
    frame
      .evaluate(
        () =>
          document.readyState !== 'loading' &&
          [...(document.body?.children ?? [])].some(
            (child) => child.tagName !== 'SCRIPT' && child.getBoundingClientRect().height > 0,
          ),
      )
      .then((drawn) => (drawn ? 'drawn' : 'blank'))
      .catch(() => 'no context'),
    new Promise((done) => setTimeout(() => done('no answer in 250 ms'), 250)),
  ]);
};

const censusCells = (page, only = null) =>
  page.evaluate(
    ({ CANVAS, only }) => {
      const shots = [...document.querySelectorAll('ethlete-sketch-view [data-shot]')];
      const view = shots[0]?.closest(CANVAS)?.getBoundingClientRect();
      const showing = (node) => {
        const style = node && getComputedStyle(node);

        return !!style && style.opacity !== '0' && style.visibility !== 'hidden' && style.display !== 'none';
      };

      return shots
        .map((cell, index) => ({ cell, index }))
        .filter(({ cell }) => only === null || cell.dataset['shot'] === only)
        .map(({ cell, index }) => {
          const box = cell.getBoundingClientRect();
          const img = cell.querySelector('img');
          const iframe = cell.querySelector('iframe');

          if (iframe) iframe.dataset['census'] = cell.dataset['shot'];

          return {
            index,
            key: cell.dataset['shot'],
            top: box.top - view.top,
            below: box.bottom - view.bottom,
            visible:
              box.height > 0 &&
              box.bottom > view.top &&
              box.top < view.bottom &&
              box.right > view.left &&
              box.left < view.right,
            picture: !!img && img.complete && img.naturalWidth > 0 && showing(img),
            pictureSrc: img?.src ?? null,
            framed: !!iframe && showing(iframe),
          };
        });
    },
    { CANVAS, only },
  );

const probeCell = async (page, cell, recensused = false) => {
  const iframe = cell.visible && cell.framed && (await page.$(`iframe[data-census="${cell.key}"]`));

  const drawn = iframe ? await drawnIn(iframe) : null;

  if (drawn && drawn !== 'no frame' && drawn !== 'no context') return drawn;
  if (!cell.visible || !cell.framed) return null;
  if (recensused) return drawn ?? 'frame gone twice';

  const [now] = await censusCells(page, cell.key);

  Object.assign(cell, now ?? { visible: false, framed: false, picture: false });
  cell.gone = drawn ? `${drawn} after the census` : 'frame gone after the census';

  return now?.visible && now.framed ? probeCell(page, cell, true) : null;
};

export const sketchCells = async (page) => {
  const cells = await censusCells(page);

  for (const cell of cells) {
    cell.probe = await probeCell(page, cell);
    cell.drawn = cell.probe === 'drawn';
    cell.shows = cell.framed ? cell.drawn : cell.picture;
  }

  return cells;
};

export const listingWait = ({ holdActive, requested, outstanding, pendingMarker }) => {
  if (pendingMarker) return { done: false, reason: 'a listing request is still pending in the page' };
  if (!holdActive) return { done: true };
  if (!requested) return { done: false, reason: 'a listing hold is active but no listing was requested' };
  if (outstanding) return { done: false, reason: `${outstanding} held listing request(s) are still unanswered` };

  return { done: true };
};
