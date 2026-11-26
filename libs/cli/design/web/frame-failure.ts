export const paintFailure = (root: HTMLElement, message: string) => {
  const text = document.createElement('pre');

  text.textContent = message;
  text.setAttribute('style', 'margin:0;white-space:pre-wrap;overflow-wrap:anywhere');
  root.replaceChildren(text);
  root.setAttribute('style', 'padding:16px;font:14px monospace;color:#f0a0a0;background:#1a1414');
};
