import { Component, ViewEncapsulation, input, signal } from '@angular/core';
import { ProvideSurfaceDirective } from '@ethlete/core';
import { PICTURE_IMPORTS } from '../picture.imports';

@Component({
  selector: 'et-sb-picture-fit',
  template: `
    <div [etProvideSurface]="surface()" class="text-medium flex flex-col gap-8 p-8 font-sans">
      <section class="flex flex-col gap-2">
        <h3 class="text-large m-0">Fitting a box the host defines</h3>
        <p class="text-small m-0 opacity-60">
          The same 16:9 source in every 180 &times; 120 box, so the only difference is the fit mode. The box is the
          host's - <code>fit</code> makes the figure, the picture and the image fill it. The boxes clip, since
          <code>none</code> otherwise paints outside its own.
        </p>

        <div class="flex flex-wrap gap-4">
          @for (mode of FIT_MODES; track mode) {
            <div class="flex flex-col gap-1">
              <span class="text-small opacity-60">{{ mode }}</span>

              <et-picture
                [fit]="mode"
                [defaultSrc]="WIDE_SRC"
                [style.inline-size.px]="180"
                [style.block-size.px]="120"
                class="overflow-hidden"
                style="border: 1px solid var(--et-surface-border-solid)"
                alt="A coloured block fitted to a fixed box"
              />
            </div>
          }
        </div>
      </section>

      <section class="flex flex-col gap-2">
        <h3 class="text-large m-0">Natural size, once it is known</h3>
        <p class="text-small m-0 opacity-60">
          <code>naturalSize()</code> and <code>naturalAspectRatio()</code> report what the browser decoded, and
          <code>imgLoad</code> carries the same numbers. Both are null until then, and after a failure.
        </p>

        <et-picture
          #picture
          [defaultSrc]="WIDE_SRC"
          [aspectRatio]="16 / 9"
          [style.max-inline-size.px]="320"
          (imgLoad)="loadedRatio.set($event.naturalWidth / $event.naturalHeight)"
          alt="A coloured block whose intrinsic size is reported below"
        />

        <p class="text-small m-0 opacity-60">
          state: {{ picture.state() }} · naturalSize: {{ picture.naturalSize()?.width }} &times;
          {{ picture.naturalSize()?.height }} · naturalAspectRatio: {{ picture.naturalAspectRatio() }} · from imgLoad:
          {{ loadedRatio() }}
        </p>
      </section>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [PICTURE_IMPORTS, ProvideSurfaceDirective],
})
export class PictureFitStorybookComponent {
  public surface = input('dark');

  protected readonly FIT_MODES = ['cover', 'contain', 'fill', 'none', 'scale-down'] as const;

  protected readonly WIDE_SRC = WIDE;

  protected loadedRatio = signal<number | null>(null);
}

// Below the component on purpose: an interpolated template literal above an inline `template:` breaks Angular
// language service completions inside it - see the `ethlete/no-template-literal-before-inline-template` rule.
const WIDE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">` +
      `<rect width="100%" height="100%" fill="#00ffa1"/>` +
      `<text x="50%" y="50%" fill="#000" font-family="sans-serif" font-size="48" text-anchor="middle" ` +
      `dominant-baseline="middle">800 &#215; 450</text></svg>`,
  );
