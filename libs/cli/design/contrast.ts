type Rgba = [number, number, number, number];

const rgbaIn = (probe: HTMLElement, value: string): Rgba => {
  probe.style.color = `color-mix(in srgb, ${value} 100%, transparent)`;

  const computed = getComputedStyle(probe).color;
  const numbers = [...computed.matchAll(/-?[\d.]+(?:e-?\d+)?/g)].map((match) => parseFloat(match[0]));
  const scale = computed.startsWith('color(') ? 1 : 255;
  const [r = 0, g = 0, b = 0] = numbers.map((channel) => Math.min(1, Math.max(0, channel / scale)));

  return [r, g, b, numbers[3] ?? 1];
};

const over = (top: Rgba, under: Rgba): Rgba => [
  top[0] * top[3] + under[0] * (1 - top[3]),
  top[1] * top[3] + under[1] * (1 - top[3]),
  top[2] * top[3] + under[2] * (1 - top[3]),
  1,
];

const luminanceOf = ([r, g, b]: Rgba) => {
  const linear = (channel: number) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);

  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
};

/**
 * The WCAG 2 contrast ratio of the colour `text` on the colour `on`, both CSS colours resolved inside `within`
 * (`document.body` by default), so `var(--token)` works. A translucent `on` is laid over the background of
 * `document.body`. For a ratio table in a drawing's `setup`: `contrastRatioOf({ text: 'var(--text)', on: 'var(--surface)', within: root })`.
 */
export const contrastRatioOf = (options: { text: string; on: string; within?: Element }) => {
  const probe = document.createElement('i');

  probe.style.display = 'none';
  (options.within ?? document.body).append(probe);

  try {
    const page = over(rgbaIn(probe, getComputedStyle(document.body).backgroundColor), [1, 1, 1, 1]);
    const behind = over(rgbaIn(probe, options.on), page);
    const [light, dark] = [luminanceOf(over(rgbaIn(probe, options.text), behind)), luminanceOf(behind)].sort(
      (a, b) => b - a,
    );

    return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
  } finally {
    probe.remove();
  }
};
