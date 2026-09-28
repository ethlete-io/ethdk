import { DOCUMENT } from '@angular/common';
import {
  createEnvironmentInjector,
  DestroyRef,
  EnvironmentInjector,
  Injector,
  runInInjectionContext,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NEVER, of, Subject } from 'rxjs';
import '../../../../test-helpers';
import { injectOverlayManager } from '../../../overlay/overlay-manager';
import { RichTextEditorDirective } from '../headless/rich-text-editor.directive';
import { injectRichTextEditorDom, provideRichTextEditorDom } from '../headless/internals/rich-text-editor-dom';
import { DEFAULT_RICH_TEXT_EDITOR_LABELS } from '../rich-text-editor-labels';
import { RICH_TEXT_EDITOR_TOOL, RichTextEditorToolDefinition } from '../rich-text-editor-tools';
import { provideRichTextEditorImageTool } from './rich-text-editor-image.provider';
import { RichTextEditorImageUploadFn } from './rich-text-editor-image-upload';

const FILE = new File(['x'], 'photo.png', { type: 'image/png' });

describe('provideRichTextEditorImageTool in a shared scope', () => {
  let doc: Document;
  let scope: EnvironmentInjector;
  let liveDestroyCallbacks: number;

  const setupScope = (upload: RichTextEditorImageUploadFn) => {
    scope = createEnvironmentInjector(
      [provideRichTextEditorImageTool({ upload })],
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

  it('registers nothing for an upload that settles synchronously', () => {
    const tool = setupScope(() => of('https://cdn/b.png'));
    const { editor } = createEditor();
    const baseline = liveDestroyCallbacks;

    pasteImage(tool, editor);

    expect(liveDestroyCallbacks).toBe(baseline);
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
});
