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
  checks: { skip: ['CLIPPED'] },
  widths: [480],
  render: (props: Props) =>
    drawing({
      body: `<div class="loader-frame">${render(props)}</div>`,
      styles: [loaderStyles, frame].join('\n'),
    }),
});
