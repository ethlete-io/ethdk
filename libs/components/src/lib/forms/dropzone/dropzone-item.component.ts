import { Component, computed, ElementRef, inject, input, output, ViewEncapsulation } from '@angular/core';
import { injectLocale, injectSemanticColorTheme, ProvideColorDirective } from '@ethlete/core';
import { IconButtonComponent } from '../../button/icon-button.component';
import { FILE_ICON, IconDirective, provideIcons, ROTATE_RIGHT_ICON, TIMES_ICON } from '../../icon/headless';
import { ProgressBarComponent } from '../../loader/progress-bar/progress-bar.component';
import { DropzoneEntry, formatFileSize } from './headless/dropzone-entry';

@Component({
  selector: 'et-dropzone-item',
  templateUrl: './dropzone-item.component.html',
  styleUrl: './dropzone-item.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [IconButtonComponent, IconDirective, ProgressBarComponent, ProvideColorDirective],
  providers: [provideIcons(FILE_ICON, ROTATE_RIGHT_ICON, TIMES_ICON)],
  host: {
    class: 'et-dropzone-item',
    role: 'listitem',
    '[attr.data-status]': 'entry().status()',
  },
})
export class DropzoneItemComponent {
  public elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  protected errorColorTheme = injectSemanticColorTheme('error');
  private locale = injectLocale();

  public entry = input.required<DropzoneEntry>();
  public readonly = input(false);
  public interactive = input(true);
  public retryLabel = input('');
  public removeLabel = input('');
  public errorMessage = input<string | null>(null);

  public retry = output<void>();
  public remove = output<void>();

  private dateFormat = computed(() => new Intl.DateTimeFormat(this.locale.currentLocale(), { dateStyle: 'medium' }));

  protected uploadedAt = computed(() => {
    const date = this.entry().uploadedAt();

    return date ? { iso: date.toISOString(), label: this.dateFormat().format(date) } : null;
  });

  protected readonly FORMAT_FILE_SIZE = formatFileSize;
}
