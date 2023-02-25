export const nextFrame = (cb: () => void) => {
  requestAnimationFrame(() => {
    requestAnimationFrame(cb);
  });
};

export const forceReflow = (element: HTMLElement = document.body) => {
  return element.offsetHeight;
};
