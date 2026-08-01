import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injector, inputBinding, outputBinding, Provider } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { anchoredOverlayPosition, enableAnchoredOverlayPositionExtras, injectRenderer } from '@ethlete/core';
import { fromEvent, take, tap, timer } from 'rxjs';
import { OverlayConfig } from '../../../overlay/overlay-config';
import { injectOverlayManager } from '../../../overlay/overlay-manager';
import { OverlayRef } from '../../../overlay/overlay-ref';
import { injectAnchoredDialogStrategy, injectTopSheetStrategy } from '../../../overlay/strategies';
import { RichTextEditorDirective } from '../headless/rich-text-editor.directive';
import { RichTextEditorImageEditorComponent } from '../rich-text-editor-image-editor.component';
import { DEFAULT_RICH_TEXT_EDITOR_LABELS } from '../rich-text-editor-labels';
import { RICH_TEXT_EDITOR_TOOL, RichTextEditorToolDefinition } from '../rich-text-editor-tools';
import {
  RichTextEditorImageFailure,
  RichTextEditorImageUpload,
  startImageUpload,
} from './rich-text-editor-image-upload';
import { mountRichTextEditorImageStyles } from './rich-text-editor-image-styles.component';
import { RichTextEditorImageToolComponent } from './rich-text-editor-image-tool.component';
import { createImageOps } from './rich-text-editor-image.util';

/** How long a failed upload's placeholder stays visible before it removes itself. */
const FAILURE_VISIBLE_MS = 4000;

export type RichTextEditorImageToolConfig = {
  /**
   * Uploads one file and resolves to the URL to embed. Either a function returning a promise or
   * observable, or a dropzone upload config (`createDropzoneUpload`) - the latter reuses the
   * dropzone's per-file query machinery and reports upload progress on the placeholder.
   */
  upload: RichTextEditorImageUpload;

  /**
   * `accept` for the file picker, and the filter applied to pasted/dropped files.
   * @default 'image/*'
   */
  accept?: string;

  /** Largest file accepted, in bytes. A bigger one is rejected before the upload starts. */
  maxSize?: number;

  /**
   * Called when an image did not make it in: the wrong type, too large, or a failed upload. Wire it
   * to whatever your app uses to tell the user - a notification, a form error, a log.
   */
  onFailure?: (failure: RichTextEditorImageFailure) => void;
};

/** Whether a file is acceptable per the tool's `accept` pattern (`image/*`, `image/png`, `.png`). */
const matchesAccept = (file: File, accept: string) =>
  accept
    .split(',')
    .map((pattern) => pattern.trim().toLowerCase())
    .filter(Boolean)
    .some((pattern) => {
      if (pattern.startsWith('.')) return file.name.toLowerCase().endsWith(pattern);
      if (pattern.endsWith('/*')) return file.type.toLowerCase().startsWith(pattern.slice(0, -1));

      return file.type.toLowerCase() === pattern;
    });

/** The image files carried by a clipboard/drag payload, ignoring everything else it offers. */
const imageFilesOf = (data: DataTransfer | null | undefined, accept: string): File[] =>
  Array.from(data?.files ?? []).filter((file) => file.type.startsWith('image/') || matchesAccept(file, accept));

/**
 * Registers the opt-in `'image'` tool: pick (or paste, or drop) an image, upload it through the
 * consumer's handler, and embed it as `![alt](url)`. Add it to a component/route's providers and
 * include `'image'` in the editor's `tools`.
 *
 * The button inserts, and - with the caret on an image - opens the image popover instead, where the
 * alt text is edited and the image can be removed; clicking an image opens the same popover. Both
 * paste and drop of image files run through the same upload, whether or not `'image'` is in the
 * visible toolbar. Everything here (and the image DOM ops and popover it pulls in) tree-shakes away
 * for editors that don't provide the tool.
 *
 * @example
 * providers: [
 *   provideRichTextEditorImageTool({
 *     upload: (file) => this.api.uploadImage(file).pipe(map((res) => res.url)),
 *     maxSize: 5 * 1024 * 1024,
 *     onFailure: ({ reason }) => this.notifications.open({ status: 'error', title: `Upload failed: ${reason}` }),
 *   }),
 * ]
 */
export const provideRichTextEditorImageTool = (config: RichTextEditorImageToolConfig): Provider => ({
  provide: RICH_TEXT_EDITOR_TOOL,
  useFactory: (): RichTextEditorToolDefinition => {
    const controller = createImageToolController(config);

    return {
      token: 'image',
      // Only a fallback: the toolbar reads `image` from the label set, which is what a consumer localizes.
      label: DEFAULT_RICH_TEXT_EDITOR_LABELS.image,
      // The button is a control component so the image icon ships with the tool, not with every editor.
      control: RichTextEditorImageToolComponent,
      run: (editor) => controller.run(editor),
      isDisabled: (editor) => editor.disabled() || editor.readonly() || editor.codeBlockActive(),
      normalize: (root) => controller.normalize(root),
      paste: (editor, event) => controller.handlePaste(editor, event),
      drop: (editor, event) => controller.handleDrop(editor, event),
      click: (editor, event) => controller.handleClick(editor, event),
    };
  },
  multi: true,
});

const createImageToolController = (config: RichTextEditorImageToolConfig) => {
  mountRichTextEditorImageStyles();

  const document = inject(DOCUMENT);
  const injector = inject(Injector);
  const destroyRef = inject(DestroyRef);
  const renderer = injectRenderer();
  const overlayManager = injectOverlayManager();
  const ops = createImageOps(renderer);
  const accept = config.accept ?? 'image/*';

  let overlayRef: OverlayRef<RichTextEditorImageEditorComponent, unknown> | null = null;

  const fail = (failure: RichTextEditorImageFailure) => config.onFailure?.(failure);

  /** Opens the OS file dialog. Created per pick so nothing lingers in the DOM between uploads. */
  const pickFiles = (editor: RichTextEditorDirective) => {
    const input = renderer.createElement('input') as HTMLInputElement;

    renderer.setAttribute(input, 'type', 'file');
    renderer.setAttribute(input, 'accept', accept);
    renderer.setAttribute(input, 'multiple', 'true');
    renderer.setStyle(input, { display: 'none' });
    renderer.appendChild(document.body, input);

    fromEvent(input, 'change')
      .pipe(
        take(1),
        tap(() => {
          upload(editor, Array.from(input.files ?? []));
          input.remove();
        }),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe();

    // A cancelled dialog fires `cancel` in every browser that ships the event; where it doesn't, the
    // input is cleaned up on the next pick or when the editor goes away.
    fromEvent(input, 'cancel')
      .pipe(
        take(1),
        tap(() => input.remove()),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe();

    destroyRef.onDestroy(() => input.remove());

    input.click();
  };

  const upload = (editor: RichTextEditorDirective, files: File[]) => {
    for (const file of files) {
      if (!matchesAccept(file, accept)) {
        fail({ file, reason: 'unsupported-type' });
        continue;
      }

      if (config.maxSize !== undefined && file.size > config.maxSize) {
        fail({ file, reason: 'too-large' });
        continue;
      }

      uploadOne(editor, file);
    }
  };

  const uploadOne = (editor: RichTextEditorDirective, file: File) => {
    const dom = editor.editorDom;
    const labels = editor.resolvedLabels();
    const placeholder = ops.insertPlaceholder(dom, labels.imageUploading);

    if (!placeholder) return;

    // The placeholder itself serializes to nothing, but inserting it replaced the selection - commit
    // that edit so the value stays in step with the DOM even if the upload never finishes.
    editor.syncFromDom({ boundary: true });

    const run = startImageUpload({
      file,
      upload: config.upload,
      injector,
      onProgress: (percentage) => ops.setPlaceholderProgress(placeholder, percentage),
      onSuccess: (url) => {
        const image = ops.replacePlaceholderWithImage({ dom, placeholder, image: { src: url, alt: '' } });

        // Gone means the content was replaced while the upload ran (an undo, an external write) -
        // silently drop the result rather than putting an image back into a document that moved on.
        if (image) editor.syncFromDom({ boundary: true });
      },
      onError: (error, message) => {
        showFailure(placeholder, labels.imageUploadFailed);
        fail({ file, reason: 'upload-failed', error, message });
      },
    });

    destroyRef.onDestroy(() => run.cancel());
  };

  /** Leaves the placeholder in its failed state briefly, so the user sees which image didn't make it. */
  const showFailure = (placeholder: HTMLElement, label: string) => {
    renderer.setAttribute(placeholder, 'data-state', 'error');
    renderer.setAttribute(placeholder, 'aria-label', label);
    ops.setPlaceholderProgress(placeholder, null);

    timer(FAILURE_VISIBLE_MS)
      .pipe(
        take(1),
        tap(() => ops.removePlaceholder(placeholder)),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe();
  };

  /** The toolbar button: edit the image under the caret, or insert a new one. */
  const run = (editor: RichTextEditorDirective) => {
    if (editor.disabled() || editor.readonly()) return;

    editor.editorDom.restoreSelection();

    const active = ops.readActiveImage(editor.editorDom);

    if (active) {
      openEditor(editor, active.element);

      return;
    }

    pickFiles(editor);
  };

  const handlePaste = (editor: RichTextEditorDirective, event: ClipboardEvent) => {
    // A clipboard that also carries HTML is a *content* paste - text that happens to include images
    // (Word, a web page) puts both on the clipboard, and uploading the file would drop the text. Only
    // a bare file payload (a screenshot, an image copied from the file manager) is an upload.
    if (event.clipboardData?.types.includes('text/html')) return false;

    const files = imageFilesOf(event.clipboardData, accept);

    if (!files.length || editor.disabled() || editor.readonly() || editor.codeBlockActive()) return false;

    upload(editor, files);

    return true;
  };

  const handleDrop = (editor: RichTextEditorDirective, event: DragEvent) => {
    const files = imageFilesOf(event.dataTransfer, accept);

    if (!files.length || editor.disabled() || editor.readonly() || editor.codeBlockActive()) return false;

    // Drop lands where it was dropped, not where the caret was - the browser has already moved the
    // caret there by the time this runs, so the placeholder goes in at the drop point.
    upload(editor, files);

    return true;
  };

  /** A click on an image opens its popover - the discoverable way to reach the alt text. */
  const handleClick = (editor: RichTextEditorDirective, event: MouseEvent) => {
    const target = event.target;

    if (!(target instanceof HTMLImageElement) || editor.disabled() || editor.readonly()) return false;

    openEditor(editor, target);

    return true;
  };

  const openEditor = (editor: RichTextEditorDirective, image: HTMLImageElement) => {
    if (overlayRef) {
      close();

      return;
    }

    const overlayConfig: OverlayConfig = {
      mode: 'non-modal',
      autoFocus: 'input',
      restoreFocus: false,
      closeOnEscape: true,
      closeOnOutsidePointer: true,
      origin: image,
      bindings: [
        inputBinding('labels', () => editor.resolvedLabels()),
        inputBinding('alt', () => image.getAttribute('alt') ?? ''),
        inputBinding('src', () => image.getAttribute('src') ?? ''),
        outputBinding<string>('saveAlt', (alt) => applyAlt({ editor, image, alt })),
        outputBinding<void>('removeImage', () => removeImage(editor, image)),
        outputBinding<void>('dismiss', () => dismiss(editor)),
      ],
      // Same responsive shape as the link editor: a top sheet on phones (an anchored card would be
      // cramped against the keyboard), an anchored popover pointing at the image above `md`.
      strategies: () => {
        const topSheet = injectTopSheetStrategy();
        const anchoredDialog = injectAnchoredDialogStrategy();

        return [
          { strategy: topSheet.build({ containerClass: 'et-rte-image-editor-overlay', hasBackdrop: true }) },
          {
            breakpoint: 'md',
            strategy: anchoredDialog.build({
              containerClass: 'et-rte-image-editor-overlay',
              positionStrategy: () => {
                enableAnchoredOverlayPositionExtras();

                return anchoredOverlayPosition({
                  referenceElement: image,
                  placement: 'bottom',
                  fallbackPlacements: ['top'],
                  offset: 10,
                  arrowPadding: 16,
                  autoCloseIfReferenceHidden: true,
                });
              },
              applyTransformOrigin: false,
              minWidth: 'unset',
              hasBackdrop: false,
            }),
          },
        ];
      },
    };

    const ref = overlayManager.open<RichTextEditorImageEditorComponent>(
      RichTextEditorImageEditorComponent,
      overlayConfig,
    );

    overlayRef = ref;

    ref
      .afterClosedEvent()
      .pipe(
        take(1),
        tap((closeEvent) => {
          if (overlayRef === ref) overlayRef = null;

          // Escape means "back to the text"; an outside pointer was aimed somewhere else.
          if (closeEvent.source === 'escape') queueMicrotask(() => editor.activate());
        }),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe();
  };

  const applyAlt = ({
    editor,
    image,
    alt,
  }: {
    editor: RichTextEditorDirective;
    image: HTMLImageElement;
    alt: string;
  }) => {
    ops.applyAlt(image, alt);
    editor.syncFromDom({ boundary: true });
    close();
    queueMicrotask(() => editor.activate());
  };

  const removeImage = (editor: RichTextEditorDirective, image: HTMLImageElement) => {
    ops.removeImage(editor.editorDom, image);
    editor.syncFromDom({ boundary: true });
    close();
    queueMicrotask(() => editor.activate());
  };

  const dismiss = (editor: RichTextEditorDirective) => {
    close();
    queueMicrotask(() => editor.activate());
  };

  const close = () => {
    const ref = overlayRef;

    if (!ref) return;

    overlayRef = null;
    ref.close();
  };

  destroyRef.onDestroy(close);

  return { run, normalize: ops.normalizeImages, handlePaste, handleDrop, handleClick };
};
