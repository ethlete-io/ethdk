export const elementCanScroll = (element: HTMLElement) => {
  const { scrollHeight, clientHeight, scrollWidth, clientWidth } = element;

  return scrollHeight > clientHeight || scrollWidth > clientWidth;
};
