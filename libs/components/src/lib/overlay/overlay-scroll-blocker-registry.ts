const activeScrollBlockers = /* @__PURE__ */ new WeakSet<Document>();
const warnedDocuments = /* @__PURE__ */ new WeakSet<Document>();

export const markOverlayScrollBlockerActive = (document: Document) => {
  activeScrollBlockers.add(document);
};

export const warnIfOverlayScrollBlockerMissing = (document: Document) => {
  if (warnedDocuments.has(document) || activeScrollBlockers.has(document)) return;

  warnedDocuments.add(document);

  console.warn(
    '[Overlay] A modal overlay opened without the overlay scroll blocker, so the page behind it keeps scrolling. Add `provideOverlay()` to the application providers.',
  );
};
