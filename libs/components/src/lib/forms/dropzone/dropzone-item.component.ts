import { Component, computed, ElementRef, inject, input, output, ViewEncapsulation } from '@angular/core';
import { injectSemanticColorTheme, ProvideColorDirective } from '@ethlete/core';
import { IconButtonComponent } from '../../button/icon-button.component';
import {
  FILE_ICON,
  IconDirective,
  provideIcons,
  ROTATE_RIGHT_ICON,
  TIMES_ICON,
  UPLOAD_ICON,
} from '../../icon/headless';
import { ProgressBarComponent } from '../../loader/progress-bar/progress-bar.component';
import { injectUploadedAtFormatter } from './dropzone-uploaded-at';
import { DropzoneEntry, formatFileSize } from './headless/dropzone-entry';

@Component({
  selector: 'et-dropzone-item',
  templateUrl: './dropzone-item.component.html',
  styleUrl: './dropzone-item.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [IconButtonComponent, IconDirective, ProgressBarComponent, ProvideColorDirective],
  providers: [provideIcons(FILE_ICON, ROTATE_RIGHT_ICON, TIMES_ICON, UPLOAD_ICON)],
  host: {
    class: 'et-dropzone-item',
    '[attr.role]': 'listItem() ? "listitem" : null',
    '[attr.data-status]': 'entry().status()',
  },
})
export class DropzoneItemComponent {
  public elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  protected errorColorTheme = injectSemanticColorTheme('error');
  private formatUploadedAt = injectUploadedAtFormatter();

  public entry = input.required<DropzoneEntry>();
  public readonly = input(false);
  public interactive = input(true);
  public retryLabel = input('');
  public removeLabel = input('');
  public replaceLabel = input<string | null>(null);
  public listItem = input(true);
  public errorMessage = input<string | null>(null);

  public retry = output<void>();
  public remove = output<void>();
  public replace = output<void>();

  protected uploadedAt = computed(() => this.formatUploadedAt(this.entry().uploadedAt()));

  protected readonly FORMAT_FILE_SIZE = formatFileSize;
}
