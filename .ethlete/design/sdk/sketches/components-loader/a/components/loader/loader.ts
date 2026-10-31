import { brandLoader, loaderStyles, progressBar, spinner } from '@ethlete/components/design/loader';
import { definePart, drawing } from '@design-system';
import frame from './loader.css?inline';

type Props = {
  form: 'spinner' | 'spinner-determinate' | 'spinner-themed' | 'progress-bar' | 'progress-bar-themed' | 'brand-loader';
};

const row = (items: string[]) => `<div class="loader-row">${items.join('')}</div>`;

const column = (items: string[]) => `<div class="loader-column">${items.join('')}</div>`;

const render = ({ form }: Props) => {
  switch (form) {
    case 'spinner':
      return row([
        spinner(),
        spinner({ diameter: 45, strokeWidth: 2 }),
        spinner({ diameter: 45, strokeWidth: 2, track: true }),
        spinner({ diameter: 72, strokeWidth: 4, track: true }),
      ]);
    case 'spinner-determinate':
      return row([
        spinner({ diameter: 45, strokeWidth: 2, track: true, value: 0 }),
        spinner({ diameter: 45, strokeWidth: 2, track: true, value: 65 }),
        spinner({ diameter: 45, strokeWidth: 2, track: true, value: 100 }),
        spinner({ diameter: 45, strokeWidth: 2, value: 65 }),
      ]);
    case 'spinner-themed':
      return row([
        spinner({ diameter: 45, strokeWidth: 2, track: true, color: 'brand' }),
        spinner({ diameter: 45, strokeWidth: 2, track: true, value: 65, color: 'brand' }),
        spinner({ diameter: 45, strokeWidth: 2, track: true, color: 'danger' }),
        spinner({ diameter: 45, strokeWidth: 2, track: true, color: 'warning' }),
      ]);
    case 'progress-bar':
      return column([progressBar({ value: 42 }), progressBar({ value: 100 }), progressBar()]);
    case 'progress-bar-themed':
      return column([
        progressBar({ value: 42, color: 'brand' }),
        progressBar({ color: 'brand' }),
        progressBar({ value: 42, color: 'danger' }),
        progressBar({ value: 42, color: 'warning' }),
      ]);
    case 'brand-loader':
      return row([brandLoader()]);
  }
};

export default definePart({
  note: 'The SDK loaders, drawn by their mock from @ethlete/components/design on the page: et-spinner (a 2.25px-of-18px stroke circle by default, round caps, optional track = the indicator at 24%, indeterminate sweep held at 30% of its 1333ms cycle, determinate arc from the top), et-progress-bar (4px pill, track = the text colour at 12%, indicator full height, indeterminate sweep held at 62% of 2s with both bars in view) and et-brand-loader (the 10rem Ethlete E: a ghost of the accent at 14% in the text colour pulsing 12-20%, a 1.4 outline stroke in the accent and an accent fill sweeping in, held at 55% of 3200ms: outline drawn, fill half swept; accent defaults to --et-theme-color-primary-solid). Spinner and bar inherit currentColor; with color set they take --et-theme-color-primary-solid. States: spinner sizes (18 default, 45 with and without track, 72/4 with track), determinate 0/65/100 and 65 without track, themed brand/danger/warning, progress bar 42/100/indeterminate, themed brand (also indeterminate)/danger/warning, and the brand loader. No hover, focus or disabled state exists.',
  madeBy: ['claude-opus-5-5'],
  states: {
    spinner: { form: 'spinner' },
    'spinner-determinate': { form: 'spinner-determinate' },
    'spinner-themed': { form: 'spinner-themed' },
    'progress-bar': { form: 'progress-bar' },
    'progress-bar-themed': { form: 'progress-bar-themed' },
    'brand-loader': { form: 'brand-loader' },
  },
  checks: { skip: ['CLIPPED'] },
  widths: [480],
  render: (props: Props) =>
    drawing({
      body: `<div class="loader-frame">${render(props)}</div>`,
      styles: [loaderStyles, frame].join('\n'),
    }),
});
