import { Component, ViewEncapsulation, signal } from '@angular/core';
import { PICTURE_IMPORTS } from '@ethlete/components';
import { PICTURE_WIDE_SRC } from './picture.data';

@Component({
  selector: 'app-picture-fit-example',
  template: `
    <section class="example-picture-section">
      <h3>Fitting a box the host defines</h3>
      <p>
        The same 16:9 source in every 180 &times; 120 box, so the only difference is the fit mode. The box is the host's
        - <code>fit</code> makes the figure, the picture and the image fill it. The boxes clip, since
        <code>none</code> otherwise paints outside its own.
      </p>

      <div class="example-picture-modes">
        @for (mode of FIT_MODES; track mode) {
          <div class="example-picture-mode">
            <span>{{ mode }}</span>

            <et-picture
              [fit]="mode"
              [defaultSrc]="WIDE_SRC"
              class="example-picture-box"
              alt="A mountain range at sunrise"
            />
          </div>
        }
      </div>
    </section>

    <section class="example-picture-section">
      <h3>Natural size, once it is known</h3>
      <p>
        <code>naturalSize()</code> and <code>naturalAspectRatio()</code> report what the browser decoded, and
        <code>imageLoad</code> carries the same numbers. Both are null until then, and after a failure.
      </p>

      <et-picture
        #picture
        [defaultSrc]="WIDE_SRC"
        [aspectRatio]="16 / 9"
        (imageLoad)="loadedRatio.set($event.naturalWidth / $event.naturalHeight)"
        class="example-picture-natural"
        alt="A mountain range at sunrise"
      />

      <p>
        state: {{ picture.state() }} · naturalSize: {{ picture.naturalSize()?.width }} &times;
        {{ picture.naturalSize()?.height }} · naturalAspectRatio: {{ picture.naturalAspectRatio() }} · from imageLoad:
        {{ loadedRatio() }}
      </p>
    </section>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [PICTURE_IMPORTS],
  styles: `
    .example-picture-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-block-end: 32px;
    }

    .example-picture-section h3,
    .example-picture-section p {
      margin: 0;
    }

    .example-picture-section p,
    .example-picture-mode span {
      opacity: 0.6;
    }

    .example-picture-modes {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
    }

    .example-picture-mode {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .example-picture-box {
      overflow: hidden;
      inline-size: 180px;
      block-size: 120px;
      border-radius: 8px;
      background: var(--et-surface-elevated-solid, transparent);
    }

    .example-picture-natural {
      max-inline-size: 320px;
      overflow: hidden;
      border-radius: 12px;
    }
  `,
})
export class PictureFitExampleComponent {
  protected readonly FIT_MODES = ['cover', 'contain', 'fill', 'none', 'scale-down'] as const;
  protected readonly WIDE_SRC = PICTURE_WIDE_SRC;

  protected loadedRatio = signal<number | null>(null);
}
