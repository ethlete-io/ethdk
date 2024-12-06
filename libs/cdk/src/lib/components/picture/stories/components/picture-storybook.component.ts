import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { PictureImports } from '../../picture.imports';

@Component({
  selector: 'et-sb-picture',
  template: `<div class="mb-4 flex justify-center px-14">
    <et-picture [alt]="alt" [defaultSrc]="defaultSrc" [width]="width" [height]="height" [hasPriority]="hasPriority" />
  </div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [PictureImports],
})
export class StorybookPictureComponent {
  defaultSrc = '';
  alt = '';
  width = 0;
  height = 0;
  hasPriority = false;
}
