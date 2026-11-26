import { PictureErrorDirective, PicturePlaceholderDirective } from './picture-slots.directive';
import { PictureComponent } from './picture.component';

export const PICTURE_IMPORTS = [PictureComponent, PicturePlaceholderDirective, PictureErrorDirective] as const;
