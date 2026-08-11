import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  viewChild,
  viewChildren,
  ViewEncapsulation,
} from '@angular/core';
import {
  AnimatableDirective,
  createCanAnimateSignal,
  createFlipAnimationGroup,
  injectPrefersReducedMotion,
  injectRenderer,
  ProvideColorDirective,
} from '@ethlete/core';
import { IconButtonComponent } from '../../button/icon-button.component';
import { FocusRingDirective } from '../../focus-ring/focus-ring.directive';
import {
  FILE_ICON,
  IconDirective,
  provideIcons,
  ROTATE_RIGHT_ICON,
  TIMES_ICON,
  UPLOAD_ICON,
} from '../../icon/headless';
import { ProgressBarComponent } from '../../loader/progress-bar/progress-bar.component';
import { FormErrorComponent } from '../form-field/form-error.component';
import { FormWarningComponent } from '../form-field/form-warning.component';
import { FormFieldDirective, injectFormSupport, wireFormSupport, provideFormSupport } from '../form-field/headless';
import { DropzoneEntry, DROPZONE_ENTRY_STATUSES, formatFileSize } from './headless/dropzone-entry';
import { DropzoneDirective } from './headless/dropzone.directive';
import { injectDropzoneLabels } from '../../forms/dropzone/dropzone-labels';

@Component({
  selector: 'et-dropzone',
  templateUrl: './dropzone.component.html',
  styleUrl: './dropzone.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    AnimatableDirective,
    FormErrorComponent,
    FormWarningComponent,
    ProvideColorDirective,
    ProgressBarComponent,
    FocusRingDirective,
    IconButtonComponent,
    IconDirective,
  ],
  providers: [provideFormSupport(), provideIcons(UPLOAD_ICON, FILE_ICON, ROTATE_RIGHT_ICON, TIMES_ICON)],
  hostDirectives: [
    FormFieldDirective,
    {
      directive: DropzoneDirective,
      inputs: ['value', 'touched', 'disabled', 'invalid', 'errors', 'required', 'name', 'upload', 'multiple'],
      outputs: [
        'valueChange',
        'touchedChange',
        'filesReject',
        'uploadSucceed',
        'uploadFail',
        'deleteSucceed',
        'deleteFail',
      ],
    },
    { directive: ProvideColorDirective, inputs: ['etProvideColor:color'] },
  ],
  host: {
    class: 'et-dropzone',
    '[attr.data-error]': 'support.displaysError() || null',
    '[attr.data-warning]': 'support.displaysWarning() || null',
    '[attr.data-multiple]': 'dropzoneDir.multiple() || null',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
  },
})
export class DropzoneComponent {
  private dropzoneLabels = injectDropzoneLabels();

  protected dropzoneDir = inject(DropzoneDirective);
  public support = injectFormSupport();
  private injector = inject(Injector);
  private renderer = injectRenderer();
  private prefersReducedMotion = injectPrefersReducedMotion();

  /** Label of the retry button shown for failed uploads. */
  public retryLabel = input<string | null>(null);

  /** Accessible label prefix of the remove button. The entry name is appended. */
  public removeLabel = input<string | null>(null);

  /** Accessible label of the replace button shown in single mode. */
  public replaceLabel = input<string | null>(null);

  /** Fallback error message shown when the upload error has no message. */
  public uploadErrorLabel = input<string | null>(null);

  /** Overrides the built-in per-entry upload failure message (e.g. for i18n). */
  public uploadErrorMessage = input<((entry: DropzoneEntry) => string) | null>(null);

  private fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  private browseButton = viewChild<ElementRef<HTMLButtonElement>>('browseButton');
  private errorContentRef = viewChild<ElementRef<HTMLElement>>('errorContent');
  private warningContentRef = viewChild<ElementRef<HTMLElement>>('warningContent');
  private hintContentRef = viewChild<ElementRef<HTMLElement>>('hintContent');
  private errorAnimatableRef = viewChild<AnimatableDirective>('errorAnimatable');
  private warningAnimatableRef = viewChild<AnimatableDirective>('warningAnimatable');
  private hintAnimatableRef = viewChild<AnimatableDirective>('hintAnimatable');
  private entryElements = viewChildren<ElementRef<HTMLElement>>('entryEl');

  /** The string in effect: this instance's `retryLabel`, else the domain's label set. */
  protected resolvedRetryLabel = computed(() => this.retryLabel() ?? this.dropzoneLabels().retry);

  /** The string in effect: this instance's `removeLabel`, else the domain's label set. */
  protected resolvedRemoveLabel = computed(() => this.removeLabel() ?? this.dropzoneLabels().remove);

  /** The string in effect: this instance's `replaceLabel`, else the domain's label set. */
  protected resolvedReplaceLabel = computed(() => this.replaceLabel() ?? this.dropzoneLabels().replaceFile);

  /** The string in effect: this instance's `uploadErrorLabel`, else the domain's label set. */
  public resolvedUploadErrorLabel = computed(() => this.uploadErrorLabel() ?? this.dropzoneLabels().uploadFailed);
  private removingEntryIds = new Set<string>();
  private filePickerOpen = false;
  public canAnimate = createCanAnimateSignal();

  protected singleEntry = computed(() =>
    this.dropzoneDir.multiple() ? null : (this.dropzoneDir.entries()[0] ?? null),
  );

  protected liveStatusMessage = computed(() => {
    const entries = this.dropzoneDir.entries();
    const uploading = entries.filter((entry) => entry.status() === DROPZONE_ENTRY_STATUSES.UPLOADING).length;

    if (uploading > 0) {
      return uploading === 1 ? 'Uploading 1 file' : `Uploading ${uploading} files`;
    }

    return '';
  });

  /** Upload failures, rendered like validation errors below the field. */
  protected internalErrorMessages = computed(() => {
    const messages: string[] = [];

    for (const entry of this.dropzoneDir.entries()) {
      if (entry.status() === DROPZONE_ENTRY_STATUSES.ERROR) {
        messages.push(this.uploadErrorMessage()?.(entry) ?? this.defaultUploadErrorMessage(entry));
      }
    }

    return messages;
  });

  protected readonly FORMAT_FILE_SIZE = formatFileSize;

  constructor() {
    wireFormSupport(this.support, {
      errorContent: this.errorContentRef,
      warningContent: this.warningContentRef,
      hintContent: this.hintContentRef,
      errorAnimatable: this.errorAnimatableRef,
      warningAnimatable: this.warningAnimatableRef,
      hintAnimatable: this.hintAnimatableRef,
    });

    afterNextRender(() => {
      this.dropzoneDir.focusTarget.set(this.browseButton()?.nativeElement ?? null);
    });
  }

  protected openFilePicker() {
    if (this.dropzoneDir.disabled()) {
      return;
    }

    this.filePickerOpen = true;
    this.fileInput()?.nativeElement.click();
  }

  /**
   * Opening the system file picker blurs the trigger - the control must not be
   * marked as touched (and show validation errors) while the dialog is open.
   */
  protected markTriggerTouched() {
    if (this.filePickerOpen) {
      return;
    }

    this.dropzoneDir.touched.set(true);
  }

  /** Called when focus returns to the trigger or the picker dialog is cancelled. */
  protected resetFilePickerState() {
    this.filePickerOpen = false;
  }

  protected uploadPickedFiles(event: Event) {
    this.filePickerOpen = false;

    const inputElement = event.target as HTMLInputElement;

    if (inputElement.files?.length) {
      this.dropzoneDir.selectFiles(inputElement.files);
    }

    // reset so picking the same file again re-triggers the change event
    inputElement.value = '';
  }

  /** Removes an entry, scaling out its element and FLIP-shifting the remaining ones. */
  protected removeEntryAnimated(entry: DropzoneEntry, entryElement: HTMLElement) {
    if (this.removingEntryIds.has(entry.id)) {
      return;
    }

    const shouldAnimate =
      typeof entryElement.animate === 'function' && this.canAnimate.state() && !this.prefersReducedMotion();

    if (!shouldAnimate) {
      this.dropzoneDir.removeEntry(entry.id);

      return;
    }

    this.removingEntryIds.add(entry.id);
    this.renderer.setStyle(entryElement, { pointerEvents: 'none' });

    // animate the real element and remove the entry only afterwards - Angular unloads
    // component styles once their last instance is destroyed, so a detached clone
    // would lose the button/progress-bar styling mid-animation
    const animation = entryElement.animate(
      [
        { opacity: 1, transform: 'scale(1)' },
        { opacity: 0, transform: 'scale(0.9)' },
      ],
      { duration: 180, easing: 'ease-in', fill: 'forwards' },
    );

    animation.finished
      .catch(() => undefined)
      .finally(() => {
        this.removingEntryIds.delete(entry.id);

        const siblings = this.entryElements()
          .map((ref) => ref.nativeElement)
          .filter((element) => element !== entryElement);
        const flip = siblings.length ? createFlipAnimationGroup({ elements: siblings, duration: 200 }) : null;

        this.dropzoneDir.removeEntry(entry.id);

        if (flip) {
          afterNextRender(() => flip.play(), { injector: this.injector });
        }
      });
  }

  private defaultUploadErrorMessage(entry: DropzoneEntry) {
    const serverMessage = entry.errorMessage();

    return serverMessage
      ? `"${entry.name()}": ${serverMessage}`
      : `"${entry.name()}" ${this.resolvedUploadErrorLabel()}.`;
  }
}
