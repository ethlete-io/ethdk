import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { createOverlayDismissChecker } from '../../../../utils';
import { ToggletipImports } from '../../../toggletip';
import { TooltipImports } from '../../../tooltip';
import { OVERLAY_DATA } from '../../constants';
import { OverlayCloseDirective, OverlayTitleDirective } from '../../partials';
import { OverlayRef } from '../../utils';
import { StorybookExampleService } from './overlay-host.storybook.component';

@Component({
  selector: 'et-sb-overlay',
  template: `
    <div class="et-sb-overlay">
      <h3 etOverlayTitle>Lorem header</h3>
      <p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Vero, quia.</p>

      <p>Has example service injected?</p>
      <pre> {{ !!exampleService }} </pre>

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

      <input [formControl]="form.controls.foo" type="text" />
      <br /><br />

      <p etTooltip="Tooltip content!">I have a tooltip that closes by pressing esc without closing the overlay</p>

      <button
        [showToggletip]="showToggletip"
        (click)="showToggletip = !showToggletip"
        (toggletipClose)="showToggletip = false"
        etToggletip="Toggletip content!"
      >
        Show toggletip
      </button>

      <br /><br />

      <button (click)="close()" type="button">Close me</button>
      <button etOverlayClose type="button">Or close me</button>
      <button (click)="closeWithoutDismissCheck()" type="button">Or close me without dismiss check</button>
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
  imports: [
    OverlayTitleDirective,
    OverlayCloseDirective,
    JsonPipe,
    TooltipImports,
    ToggletipImports,
    ReactiveFormsModule,
  ],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverlayStorybookComponent {
  protected readonly exampleService = inject(StorybookExampleService, { optional: true });
  private readonly _overlayRef = inject<OverlayRef<OverlayStorybookComponent>>(OverlayRef);
  protected readonly data = inject(OVERLAY_DATA);

  showToggletip = false;

  form = new FormGroup({
    foo: new FormControl(''),
    bar: new FormControl(''),
  });

  private readonly _dismissCheckerRef = createOverlayDismissChecker({
    form: this.form,
    dismissCheckFn: (v) => confirm(`Are you sure you want to close? ${JSON.stringify(v)}`),
  });

  closeWithoutDismissCheck() {
    this._dismissCheckerRef.destroy();
    this._overlayRef.close();
  }

  close() {
    this._overlayRef.close();
  }
}
