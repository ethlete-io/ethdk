import { DOCUMENT } from '@angular/common';
import {
  createEnvironmentInjector,
  DestroyRef,
  EnvironmentInjector,
  Injector,
  runInInjectionContext,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NEVER, Observable, of, Subject } from 'rxjs';
import '../../../../test-helpers';
import { injectOverlayManager } from '../../../overlay/overlay-manager';
import { RichTextEditorDirective } from '../headless/rich-text-editor.directive';
import { injectRichTextEditorDom, provideRichTextEditorDom } from '../headless/internals/rich-text-editor-dom';
import { DEFAULT_RICH_TEXT_EDITOR_LABELS } from '../rich-text-editor-labels';
import { RICH_TEXT_EDITOR_TOOL, RichTextEditorToolDefinition } from '../rich-text-editor-tools';
import { provideRichTextEditorImageTool } from './rich-text-editor-image.provider';
import { RichTextEditorImageFailure, RichTextEditorImageUploadFn } from './rich-text-editor-image-upload';

const FILE = new File(['x'], 'photo.png', { type: 'image/png' });

describe('provideRichTextEditorImageTool in a shared scope', () => {
  let doc: Document;
  let scope: EnvironmentInjector;
  let liveDestroyCallbacks: number;

  const setupScope = (
    upload: RichTextEditorImageUploadFn,
    onFailure?: (failure: RichTextEditorImageFailure) => void,
  ) => {
    scope = createEnvironmentInjector(
      [provideRichTextEditorImageTool({ upload, onFailure })],
      TestBed.inject(EnvironmentInjector),
    );

    const destroyRef = scope.get(DestroyRef);
    const onDestroy = destroyRef.onDestroy.bind(destroyRef);

    liveDestroyCallbacks = 0;
    vi.spyOn(destroyRef, 'onDestroy').mockImplementation((callback) => {
      liveDestroyCallbacks++;
      const unregister = onDestroy(callback);

      return () => {
        liveDestroyCallbacks--;
        unregister();
      };
    });

    const tools = scope.get(RICH_TEXT_EDITOR_TOOL) as unknown as RichTextEditorToolDefinition[];

    return tools.find((tool) => tool.token === 'image') as RichTextEditorToolDefinition;
  };

  const createEditor = () => {
    const root = doc.createElement('div');
    root.contentEditable = 'true';
    root.innerHTML = '<p>Hello</p><p><img src="https://cdn/a.png" alt=""></p>';
    doc.body.appendChild(root);

    const injector = Injector.create({ providers: [provideRichTextEditorDom()], parent: TestBed.inject(Injector) });
    const dom = runInInjectionContext(injector, () => injectRichTextEditorDom());
    dom.root.set(root);

    const range = doc.createRange();
    range.setStart(root.firstChild?.firstChild as Node, 5);
    range.collapse(true);
    doc.getSelection()?.removeAllRanges();
    doc.getSelection()?.addRange(range);

    const editor = {
      editorDom: dom,
      resolvedLabels: () => DEFAULT_RICH_TEXT_EDITOR_LABELS,
      syncFromDom: vi.fn(),
      disabled: () => false,
      readonly: () => false,
      codeBlockActive: () => false,
      activate: vi.fn(),
    } as unknown as RichTextEditorDirective;

    return { editor, root };
  };

  const pasteImage = (tool: RichTextEditorToolDefinition, editor: RichTextEditorDirective) =>
    tool.paste?.(editor, { clipboardData: { types: ['Files'], files: [FILE] } } as unknown as ClipboardEvent);

  beforeEach(() => {
    TestBed.configureTestingModule({});
    doc = TestBed.inject(DOCUMENT);
  });

  afterEach(() => {
    scope.destroy();
    doc.body.innerHTML = '';
    doc.getSelection()?.removeAllRanges();
  });

  it('releases the scope destroy callback of an upload once it settles', () => {
    const uploads = new Subject<string>();
    const tool = setupScope(() => uploads);
    const { editor } = createEditor();
    const baseline = liveDestroyCallbacks;

    expect(pasteImage(tool, editor)).toBe(true);
    expect(liveDestroyCallbacks).toBe(baseline + 1);

    uploads.next('https://cdn/b.png');

    expect(liveDestroyCallbacks).toBe(baseline);
  });

  it('reports upload-failed and inserts nothing when the upload returns an unsafe url', () => {
    const onFailure = vi.fn();
    const tool = setupScope(() => of('javascript:alert(1)'), onFailure);
    const { editor, root } = createEditor();

    pasteImage(tool, editor);

    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure.mock.calls[0]?.[0]).toMatchObject({ file: FILE, reason: 'upload-failed' });
    expect(root.querySelectorAll('img')).toHaveLength(1);
    expect(root.querySelector('img[src^="javascript:"]')).toBeNull();
  });

  it('registers nothing for an upload that settles synchronously', () => {
    const tool = setupScope(() => of('https://cdn/b.png'));
    const { editor } = createEditor();
    const baseline = liveDestroyCallbacks;

    pasteImage(tool, editor);

    expect(liveDestroyCallbacks).toBe(baseline);
  });

  it('cancels an upload when its editor is destroyed, and inserts nothing', () => {
    const unsubscribed = vi.fn();
    const uploads = new Subject<string>();
    let signal: AbortSignal | undefined;
    const tool = setupScope((_file, context) => {
      signal = context.signal;

      return new Observable<string>((subscriber) => {
        const subscription = uploads.subscribe(subscriber);

        return () => {
          unsubscribed();
          subscription.unsubscribe();
        };
      });
    });
    const { editor, root } = createEditor();
    const baseline = liveDestroyCallbacks;

    pasteImage(tool, editor);
    tool.editorDestroyed?.(editor);

    expect(unsubscribed).toHaveBeenCalledOnce();
    expect(signal?.aborted).toBe(true);
    expect(liveDestroyCallbacks).toBe(baseline);

    uploads.next('https://cdn/b.png');

    expect(root.querySelector('img[src="https://cdn/b.png"]')).toBeNull();
  });

  it('aborts the signal of a promise upload when its editor is destroyed', async () => {
    let signal: AbortSignal | undefined;
    let resolve: (url: string) => void = () => undefined;
    const tool = setupScope((_file, context) => {
      signal = context.signal;

      return new Promise<string>((done) => (resolve = done));
    });
    const { editor, root } = createEditor();

    pasteImage(tool, editor);
    tool.editorDestroyed?.(editor);
    resolve('https://cdn/b.png');
    await Promise.resolve();

    expect(signal?.aborted).toBe(true);
    expect(root.querySelector('img[src="https://cdn/b.png"]')).toBeNull();
  });

  it('leaves the uploads of other editors running', () => {
    const uploads = new Subject<string>();
    const tool = setupScope(() => uploads);
    const first = createEditor();
    const second = createEditor();

    pasteImage(tool, first.editor);
    pasteImage(tool, second.editor);
    tool.editorDestroyed?.(first.editor);
    uploads.next('https://cdn/b.png');

    expect(first.root.querySelector('img[src="https://cdn/b.png"]')).toBeNull();
    expect(second.root.querySelector('img[src="https://cdn/b.png"]')).not.toBeNull();
  });

  it('keeps one image popover per editor', () => {
    const tool = setupScope(() => NEVER);
    const overlayManager = runInInjectionContext(scope, () => injectOverlayManager());
    const open = vi
      .spyOn(overlayManager, 'open')
      .mockImplementation(
        () => ({ afterClosedEvent: () => NEVER, close: vi.fn() }) as unknown as ReturnType<typeof overlayManager.open>,
      );
    const first = createEditor();
    const second = createEditor();

    const click = (root: HTMLElement) => ({ target: root.querySelector('img') }) as unknown as MouseEvent;

    tool.click?.(first.editor, click(first.root));
    tool.click?.(second.editor, click(second.root));

    expect(open).toHaveBeenCalledTimes(2);
  });

  it('moves the open popover to a second clicked image and closes it on the same one', () => {
    const tool = setupScope(() => NEVER);
    const overlayManager = runInInjectionContext(scope, () => injectOverlayManager());
    const refs: { close: ReturnType<typeof vi.fn> }[] = [];
    const open = vi.spyOn(overlayManager, 'open').mockImplementation(() => {
      const ref = { afterClosedEvent: () => NEVER, close: vi.fn() };

      refs.push(ref);

      return ref as unknown as ReturnType<typeof overlayManager.open>;
    });
    const { editor, root } = createEditor();

    root.insertAdjacentHTML('beforeend', '<p><img src="https://cdn/b.png" alt=""></p>');

    const [firstImage, secondImage] = Array.from(root.querySelectorAll('img'));
    const click = (target: HTMLImageElement | undefined) => ({ target }) as unknown as MouseEvent;

    tool.click?.(editor, click(firstImage));
    tool.click?.(editor, click(secondImage));

    expect(open).toHaveBeenCalledTimes(2);
    expect(refs[0]?.close).toHaveBeenCalledOnce();

    tool.click?.(editor, click(secondImage));

    expect(open).toHaveBeenCalledTimes(2);
    expect(refs[1]?.close).toHaveBeenCalledOnce();
  });
});
