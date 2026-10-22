export const SLIDER_EXAMPLES = {
  'slider/slider-default': () => import('./slider-default.example').then((m) => m.SliderDefaultExampleComponent),
  'slider/range-slider-default': () =>
    import('./range-slider-default.example').then((m) => m.RangeSliderDefaultExampleComponent),
  'slider/slider-vertical': () => import('./slider-vertical.example').then((m) => m.SliderVerticalExampleComponent),
  'slider/slider-marks': () => import('./slider-marks.example').then((m) => m.SliderMarksExampleComponent),
  'slider/slider-labelled-marks': () =>
    import('./slider-labelled-marks.example').then((m) => m.SliderLabelledMarksExampleComponent),
  'slider/slider-value-label': () =>
    import('./slider-value-label.example').then((m) => m.SliderValueLabelExampleComponent),
};
