export const PICTURE_EXAMPLES = {
  'picture/picture-default': () => import('./picture-default.example').then((m) => m.PictureDefaultExampleComponent),
  'picture/picture-fit': () => import('./picture-fit.example').then((m) => m.PictureFitExampleComponent),
};
