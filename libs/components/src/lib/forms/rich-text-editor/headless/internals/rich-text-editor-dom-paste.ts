import { RichTextEditorDomCore } from './rich-text-editor-dom-core';

export const createRichTextEditorPaste = (core: RichTextEditorDomCore) => {
  const { doc, renderer, root, getSelection } = core;

  const insertNormalizedHtml = (html: string) => {
    const editable = getSelection();
    const el = root();

    if (!editable || !el) return;

    const template = renderer.createElement('template') as HTMLTemplateElement;
    template.innerHTML = html;

    const only = template.content.childNodes.length === 1 ? template.content.firstChild : null;

    if (only instanceof HTMLElement && only.tagName === 'P') {
      only.replaceWith(...only.childNodes);
    }

    const nodes = Array.from(template.content.childNodes);

    if (nodes.length === 0) return;

    const { range } = editable;
    range.deleteContents();

    const isBlock = (node: Node) =>
      node instanceof HTMLElement && !node.matches('a, strong, em, del, u, code, span, br, img');

    if (nodes.some(isBlock)) {
      let anchor: Node | null = range.startContainer;

      while (anchor && anchor !== el && anchor.parentNode !== el) anchor = anchor.parentNode;

      let ref: Node | null = anchor && anchor !== el ? anchor.nextSibling : null;

      nodes.forEach((node) => {
        renderer.insertBefore(el, node, ref);
        ref = node.nextSibling;
      });

      const last = nodes[nodes.length - 1];

      if (last) {
        const caret = doc.createRange();
        caret.selectNodeContents(last);
        caret.collapse(false);
        const selection = doc.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(caret);
      }
    } else {
      nodes.forEach((node) => {
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);
      });

      const selection = doc.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }

    el.normalize();
  };

  return { insertNormalizedHtml };
};

export type RichTextEditorDomPaste = ReturnType<typeof createRichTextEditorPaste>;
