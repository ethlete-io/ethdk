export const CAROUSEL_EXAMPLES = {
  'carousel/carousel-default': () =>
    import('./carousel-default.example').then((m) => m.CarouselDefaultExampleComponent),
  'carousel/carousel-loop': () => import('./carousel-loop.example').then((m) => m.CarouselLoopExampleComponent),
  'carousel/carousel-wipe': () => import('./carousel-wipe.example').then((m) => m.CarouselWipeExampleComponent),
  'carousel/carousel-headless': () =>
    import('./carousel-headless.example').then((m) => m.CarouselHeadlessExampleComponent),
};
