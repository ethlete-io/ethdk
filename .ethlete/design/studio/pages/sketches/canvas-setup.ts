export const canvasSetup = (root: HTMLElement) => {
  const viewport = root.querySelector<HTMLElement>('.sk-viewport');
  const world = root.querySelector<HTMLElement>('.sk-world');
  const heads = root.querySelector<HTMLElement>('.sk-fixed-heads');
  if (!viewport || !world || !heads) return;
  const columns = [...heads.children] as HTMLElement[];
  const grid = getComputedStyle(world);
  const widths = grid.gridTemplateColumns.split(' ').map(parseFloat);
  const gap = parseFloat(grid.columnGap);
  const frames = [...world.querySelectorAll<HTMLElement>('.sk-frame')];
  const inset = 3;
  let zoom = 1;
  let x = 0;
  let y = 0;
  let focused: HTMLElement | null = null;
  let pressedFrame: HTMLElement | null = null;
  const paint = () => {
    let start = x;
    columns.forEach((head, index) => {
      const width = (widths[index] ?? 300) * zoom;
      const left = Math.max(inset, start);
      const right = Math.min(viewport.clientWidth - inset, start + width);
      head.hidden = right - left < 180;
      head.style.left = `${left}px`;
      head.style.width = `${Math.max(0, right - left)}px`;
      start += width + gap * zoom;
    });
    world.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
    const label = root.querySelector('[data-camera-reset] button');
    if (label) label.textContent = `${Math.round(zoom * 100)}%`;
  };
  const fit = (frame?: HTMLElement) => {
    focused = frame ?? null;
    const width = frame?.offsetWidth ?? world.offsetWidth;
    const height = frame?.offsetHeight ?? world.offsetHeight;
    zoom = Math.min(
      frame ? 8 : 1,
      (viewport.clientWidth - inset * 2) / (width + 2),
      (viewport.clientHeight - inset * 2) / (height + 2),
    );
    const padding = Math.max(inset, zoom + 1);
    x = padding - (frame?.offsetLeft ?? 0) * zoom;
    y = padding - (frame?.offsetTop ?? 0) * zoom;
    paint();
  };
  const nearestFrame = () => {
    if (focused) return focused;
    const bounds = viewport.getBoundingClientRect();
    const center = bounds.left + bounds.width / 2;
    return frames.reduce<HTMLElement | null>((nearest, frame) => {
      if (!nearest) return frame;
      const box = frame.getBoundingClientRect();
      const other = nearest.getBoundingClientRect();
      const distance = Math.abs(box.left + box.width / 2 - center) + Math.abs(box.top - bounds.top);
      const previous = Math.abs(other.left + other.width / 2 - center) + Math.abs(other.top - bounds.top);
      return distance < previous ? frame : nearest;
    }, null);
  };
  fit();
  viewport.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      focused = null;
      if (event.ctrlKey || event.metaKey) {
        const bounds = viewport.getBoundingClientRect();
        const px = event.clientX - bounds.left;
        const py = event.clientY - bounds.top;
        const next = Math.max(0.08, Math.min(8, zoom * Math.exp(-event.deltaY * 0.003)));
        x = px - ((px - x) * next) / zoom;
        y = py - ((py - y) * next) / zoom;
        zoom = next;
      } else {
        x -= event.shiftKey ? event.deltaY : event.deltaX;
        y -= event.shiftKey ? 0 : event.deltaY;
      }
      paint();
    },
    { passive: false },
  );
  viewport.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 && event.button !== 1) return;
    pressedFrame = (event.target as HTMLElement).closest<HTMLElement>('.sk-frame');
    viewport.focus();
    viewport.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  viewport.addEventListener('pointermove', (event) => {
    if (!viewport.hasPointerCapture(event.pointerId)) return;
    focused = null;
    x += event.movementX;
    y += event.movementY;
    paint();
  });
  viewport.addEventListener('pointerup', (event) => {
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
  });
  viewport.addEventListener('dblclick', (event) => {
    const frame = (event.target as HTMLElement).closest<HTMLElement>('.sk-frame') ?? pressedFrame;
    if (frame) fit(frame);
  });
  root.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-camera-fit]')) fit();
    if (target.closest('[data-camera-reset]')) {
      focused = nearestFrame();
      zoom = 1;
      x = inset - (focused?.offsetLeft ?? 0);
      y = inset - (focused?.offsetTop ?? 0);
      paint();
    }
  });
  viewport.addEventListener('keydown', (event) => {
    if (event.shiftKey && event.code === 'Digit1') fit();
    if (event.code === 'ArrowLeft') x += 80;
    if (event.code === 'ArrowRight') x -= 80;
    if (event.code === 'ArrowUp') y += 80;
    if (event.code === 'ArrowDown') y -= 80;
    if (event.code.startsWith('Arrow')) event.preventDefault();
    paint();
  });
};
