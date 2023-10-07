import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { TooltipImports } from '../../../tooltip';
import { OVERLAY_DATA } from '../../constants';
import { OverlayCloseDirective, OverlayTitleDirective } from '../../partials';
import { OverlayRef } from '../../utils';

@Component({
  selector: 'et-sb-overlay',
  template: `
    <div class="et-sb-overlay">
      <h3 etOverlayTitle>Lorem header</h3>
      <p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Vero, quia.</p>
      <p style="width: 1500px;">
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Labore ex natus libero nulla omnis dolores minima fuga
        animi ipsum est delectus, numquam cum architecto! Aperiam adipisci praesentium incidunt voluptatum repellendus
        voluptas voluptatibus cupiditate sed illum nobis sit, illo itaque explicabo accusamus perspiciatis iusto vitae
        dolorem possimus laboriosam ipsum recusandae quos.
      </p>

      <p>
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Labore ex natus libero nulla omnis dolores minima fuga
        animi ipsum est delectus, numquam cum architecto! Aperiam adipisci praesentium incidunt voluptatum repellendus
        voluptas voluptatibus cupiditate sed illum nobis sit, illo itaque explicabo accusamus perspiciatis iusto vitae
        dolorem possimus laboriosam ipsum recusandae quos.
      </p>

      <p>
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Labore ex natus libero nulla omnis dolores minima fuga
        animi ipsum est delectus, numquam cum architecto! Aperiam adipisci praesentium incidunt voluptatum repellendus
        voluptas voluptatibus cupiditate sed illum nobis sit, illo itaque explicabo accusamus perspiciatis iusto vitae
        dolorem possimus laboriosam ipsum recusandae quos.
      </p>

      <p>
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Labore ex natus libero nulla omnis dolores minima fuga
        animi ipsum est delectus, numquam cum architecto! Aperiam adipisci praesentium incidunt voluptatum repellendus
        voluptas voluptatibus cupiditate sed illum nobis sit, illo itaque explicabo accusamus perspiciatis iusto vitae
        dolorem possimus laboriosam ipsum recusandae quos.
      </p>

      <p>
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Labore ex natus libero nulla omnis dolores minima fuga
        animi ipsum est delectus, numquam cum architecto! Aperiam adipisci praesentium incidunt voluptatum repellendus
        voluptas voluptatibus cupiditate sed illum nobis sit, illo itaque explicabo accusamus perspiciatis iusto vitae
        dolorem possimus laboriosam ipsum recusandae quos.
      </p>

      <p>
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Labore ex natus libero nulla omnis dolores minima fuga
        animi ipsum est delectus, numquam cum architecto! Aperiam adipisci praesentium incidunt voluptatum repellendus
        voluptas voluptatibus cupiditate sed illum nobis sit, illo itaque explicabo accusamus perspiciatis iusto vitae
        dolorem possimus laboriosam ipsum recusandae quos.
      </p>

      <p>
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Labore ex natus libero nulla omnis dolores minima fuga
        animi ipsum est delectus, numquam cum architecto! Aperiam adipisci praesentium incidunt voluptatum repellendus
        voluptas voluptatibus cupiditate sed illum nobis sit, illo itaque explicabo accusamus perspiciatis iusto vitae
        dolorem possimus laboriosam ipsum recusandae quos.
      </p>

      <p>
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Labore ex natus libero nulla omnis dolores minima fuga
        animi ipsum est delectus, numquam cum architecto! Aperiam adipisci praesentium incidunt voluptatum repellendus
        voluptas voluptatibus cupiditate sed illum nobis sit, illo itaque explicabo accusamus perspiciatis iusto vitae
        dolorem possimus laboriosam ipsum recusandae quos.
      </p>

      <p>
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Labore ex natus libero nulla omnis dolores minima fuga
        animi ipsum est delectus, numquam cum architecto! Aperiam adipisci praesentium incidunt voluptatum repellendus
        voluptas voluptatibus cupiditate sed illum nobis sit, illo itaque explicabo accusamus perspiciatis iusto vitae
        dolorem possimus laboriosam ipsum recusandae quos.
      </p>

      <p>
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Labore ex natus libero nulla omnis dolores minima fuga
        animi ipsum est delectus, numquam cum architecto! Aperiam adipisci praesentium incidunt voluptatum repellendus
        voluptas voluptatibus cupiditate sed illum nobis sit, illo itaque explicabo accusamus perspiciatis iusto vitae
        dolorem possimus laboriosam ipsum recusandae quos.
      </p>

      <p>
        Lorem ipsum dolor sit amet consectetur adipisicing elit. Labore ex natus libero nulla omnis dolores minima fuga
        animi ipsum est delectus, numquam cum architecto! Aperiam adipisci praesentium incidunt voluptatum repellendus
        voluptas voluptatibus cupiditate sed illum nobis sit, illo itaque explicabo accusamus perspiciatis iusto vitae
        dolorem possimus laboriosam ipsum recusandae quos.
      </p>

      <h4>Data</h4>
      <pre>{{ (data | json) || 'Noting passed' }}</pre>

      <input type="text" />
      <br /><br />

      <p etTooltip="Tooltip content!">I have a tooltip that closes by pressing esc without closing the overlay</p>

      <button (click)="close()" type="button">Close me</button>
      <button etOverlayClose type="button">Or close me</button>
    </div>
  `,
  styles: [
    `
      .et-sb-overlay {
        display: block;
        padding: 1rem;
      }
    `,
  ],
  standalone: true,
  imports: [OverlayTitleDirective, OverlayCloseDirective, JsonPipe, TooltipImports],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverlayStorybookComponent {
  private readonly _overlayRef = inject<OverlayRef<OverlayStorybookComponent>>(OverlayRef);
  protected readonly data = inject(OVERLAY_DATA);

  close() {
    this._overlayRef.close();
  }
}
