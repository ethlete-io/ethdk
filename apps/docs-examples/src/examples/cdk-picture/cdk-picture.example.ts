import { Component, ViewEncapsulation } from '@angular/core';
import { PictureComponent } from '@ethlete/cdk';
import { FALLBACK_SRC, WIDE_SRC } from './cdk-picture.data';

@Component({
  selector: 'app-cdk-picture-example',
  template: `
    <et-picture
      [sources]="sources"
      [defaultSrc]="fallbackSrc"
      [width]="600"
      [height]="300"
      figcaption="Wide crop from 700px, fallback below."
      alt="A coloured block labelled with its size"
    />
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [PictureComponent],
})
export class CdkPictureExampleComponent {
  public fallbackSrc = FALLBACK_SRC;

  public sources = [{ srcset: WIDE_SRC, media: '(min-width: 700px)', type: 'image/svg+xml' }];
}
