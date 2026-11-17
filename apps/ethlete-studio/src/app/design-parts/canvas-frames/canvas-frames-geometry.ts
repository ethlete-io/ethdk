const LABEL_MIN_ZOOM = 0.25;
const FIT_PADDING = 64;

/** The factor that keeps frame heads and edges at screen size on a canvas drawn at `zoom`; it stops growing below 25 %. */
export const canvasLabelScale = (zoom: number) => 1 / Math.max(zoom, LABEL_MIN_ZOOM);

const layoutOffsetOf = (element: HTMLElement) => {
  let x = 0;
  let y = 0;

  for (let node: Element | null = element; node instanceof HTMLElement; node = node.offsetParent) {
    x += node.offsetLeft;
    y += node.offsetTop;
  }

  return [x, y] as const;
};

/** The strip transform that fits `frame` into the part of `canvas` right of its left padding, centred, at most 64 px from the top. */
export const fitTransform = ({
  canvas,
  strip,
  frame,
}: {
  canvas: HTMLElement;
  strip: HTMLElement;
  frame: HTMLElement;
}) => {
  const covered = parseFloat(getComputedStyle(canvas).paddingLeft) || 0;
  const width = canvas.clientWidth - covered;
  const height = canvas.clientHeight;
  const zoom = Math.min(
    1,
    (width - FIT_PADDING * 2) / frame.offsetWidth,
    (height - FIT_PADDING * 2) / frame.offsetHeight,
  );

  if (!Number.isFinite(zoom) || zoom <= 0) return null;

  const left = (width - frame.offsetWidth * zoom) / 2;
  const top = Math.min((height - frame.offsetHeight * zoom) / 2, FIT_PADDING);
  const [frameX, frameY] = layoutOffsetOf(frame);
  const [stripX, stripY] = layoutOffsetOf(strip);

  return `translate(${left - (frameX - stripX) * zoom}px, ${top - (frameY - stripY) * zoom}px) scale(${zoom})`;
};
