/**
 * Gives the jsdom page the 10px root the SDK requires, so `provideRootFontSizeCheck` stays silent
 * the way it does in a correctly set up app.
 */
export const applySdkRootFontSize = () => {
  if (typeof document === 'undefined') return;

  const style = document.createElement('style');

  style.textContent = 'html { font-size: 62.5%; }';
  document.head.appendChild(style);
};
