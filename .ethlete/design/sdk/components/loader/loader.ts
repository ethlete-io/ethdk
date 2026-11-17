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
  note: 'Decided rules only',
  madeBy: ['claude-opus-5-5'],
  states: {
    spinner: { form: 'spinner' },
    'spinner-determinate': { form: 'spinner-determinate' },
    'spinner-themed': { form: 'spinner-themed' },
    'progress-bar': { form: 'progress-bar' },
    'progress-bar-themed': { form: 'progress-bar-themed' },
    'brand-loader': { form: 'brand-loader' },
  },
  describe: {
    spinner:
      'Indeterminate spinners in three sizes, with and without a track; check that stroke widths scale and tracks show.',
    'spinner-determinate':
      'Determinate spinners at 0, 65 and 100 percent; check that the arc length matches each value.',
    'spinner-themed': 'Spinners in brand, danger and warning; check that each arc and track takes its theme color.',
    'progress-bar': 'Progress bars at 42 and 100 percent and indeterminate; check that the fill matches each value.',
    'progress-bar-themed':
      'Progress bars in brand, danger and warning; check that each fill and track takes its theme color.',
    'brand-loader': 'The brand loader; check that the mark shows whole and centered in the frame.',
  },
  checks: { skip: ['CLIPPED'] },
  widths: [480],
  frame: (body) => `<div class="loader-frame">${body}</div>`,
  render: (props: Props) =>
    drawing({
      body: render(props),
      styles: [loaderStyles, frame].join('\n'),
    }),
});
