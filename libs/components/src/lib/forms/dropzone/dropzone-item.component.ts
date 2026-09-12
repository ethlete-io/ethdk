import { Component, ElementRef, inject, input, output, ViewEncapsulation } from '@angular/core';
import { IconButtonComponent } from '../../button/icon-button.component';
import { FILE_ICON, IconDirective, provideIcons, ROTATE_RIGHT_ICON, TIMES_ICON } from '../../icon/headless';
import { ProgressBarComponent } from '../../loader/progress-bar/progress-bar.component';
import { DropzoneEntry, formatFileSize } from './headless/dropzone-entry';

@Component({
  selector: 'et-dropzone-item',
  templateUrl: './dropzone-item.component.html',
  styleUrl: './dropzone-item.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [IconButtonComponent, IconDirective, ProgressBarComponent],
  providers: [provideIcons(FILE_ICON, ROTATE_RIGHT_ICON, TIMES_ICON)],
  host: {
    class: 'et-dropzone-item',
    role: 'listitem',
    '[attr.data-status]': 'entry().status()',
  },
})
export class DropzoneItemComponent {
  public elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  public entry = input.required<DropzoneEntry>();
  public readonly = input(false);
  public interactive = input(true);
  public retryLabel = input('');
  public removeLabel = input('');

  public retry = output<void>();
  public remove = output<void>();

  protected readonly FORMAT_FILE_SIZE = formatFileSize;
}
