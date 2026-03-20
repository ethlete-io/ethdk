/**
 * Global overlay panel styles — applied via ViewEncapsulation.None on the shared content component.
 * Targets the container element classes that strategies set (e.g. `et-overlay--dialog`).
 */
export const OVERLAY_PANEL_STYLES = `
  .et-overlay {
    background: #18181b;
    color: #f4f4f5;
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    font-size: 0.875rem;
  }

  .et-overlay--dialog,
  .et-overlay--anchored-dialog {
    border-radius: 12px;
    overflow: hidden;
  }

  .et-overlay--bottom-sheet  { border-radius: 16px 16px 0 0; overflow: hidden; }
  .et-overlay--top-sheet     { border-radius: 0 0 16px 16px; overflow: hidden; }
  .et-overlay--right-sheet   { border-radius: 16px 0 0 16px; overflow: hidden; }
  .et-overlay--left-sheet    { border-radius: 0 16px 16px 0; overflow: hidden; }
  .et-overlay--full-screen-dialog { border-radius: 0; overflow: hidden; }

  .et-overlay-drag-handle { --background-color: #52525b; }
`;

/**
 * Layout and button styles for story host components.
 * Scope all selectors inside `.et-sb-host` or similar to avoid leaking.
 */
export const STORY_HOST_STYLES = `
  .et-sb-host {
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    padding: 2rem;
  }

  .et-sb-heading {
    color: #f4f4f5;
    font-size: 1rem;
    font-weight: 600;
    margin: 0 0 0.25rem;
  }

  .et-sb-subheading {
    color: #a1a1aa;
    font-size: 0.8125rem;
    margin: 0 0 1.5rem;
  }

  .et-sb-card-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 0.75rem;
  }

  .et-sb-card {
    background: #27272a;
    border: 1px solid #3f3f46;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    padding: 1rem;
  }

  .et-sb-card-title {
    color: #f4f4f5;
    font-size: 0.875rem;
    font-weight: 600;
    margin: 0;
  }

  .et-sb-card-text {
    color: #a1a1aa;
    flex: 1;
    font-size: 0.8125rem;
    line-height: 1.4;
    margin: 0;
  }

  .et-sb-btn {
    align-self: flex-start;
    background: #3b82f6;
    border: none;
    border-radius: 5px;
    color: #fff;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.8125rem;
    font-weight: 500;
    margin-top: 0.25rem;
    padding: 6px 14px;
    transition: background 0.15s;
  }

  .et-sb-btn:hover  { background: #2563eb; }
  .et-sb-btn:active { background: #1d4ed8; }

  .et-sb-btn--danger       { background: #ef4444; }
  .et-sb-btn--danger:hover { background: #dc2626; }

  .et-sb-btn-row {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .et-sb-notice {
    background: rgba(59,130,246,0.1);
    border: 1px solid rgba(59,130,246,0.3);
    border-radius: 8px;
    color: #93c5fd;
    font-size: 0.875rem;
    line-height: 1.6;
    max-width: 560px;
    padding: 1rem 1.25rem;
  }

  .et-sb-notice p      { margin: 0 0 0.5rem; }
  .et-sb-notice p:last-child { margin-bottom: 0; }
  .et-sb-notice ul     { margin: 0.375rem 0; padding-left: 1.25rem; }
  .et-sb-notice li     { margin-bottom: 0.25rem; }

  .et-sb-notice code {
    background: rgba(59,130,246,0.15);
    border-radius: 3px;
    color: #bfdbfe;
    font-family: ui-monospace, 'Cascadia Code', monospace;
    font-size: 0.8125em;
    padding: 1px 4px;
  }

  .et-sb-notice em { font-style: italic; opacity: 0.8; }

  /* ---- Section header + API badge (used by handler story hosts) ---- */

  .et-sb-section-header {
    align-items: flex-start;
    display: flex;
    gap: 1rem;
    justify-content: space-between;
    margin-bottom: 1.5rem;
  }

  .et-sb-section-header > div { flex: 1; min-width: 0; }
  .et-sb-section-header .et-sb-heading  { margin-bottom: 0.25rem; }
  .et-sb-section-header .et-sb-subheading { margin-bottom: 0; }

  .et-sb-api-badge {
    background: rgba(255,255,255,0.04);
    border: 1px solid #3f3f46;
    border-radius: 5px;
    color: #71717a;
    flex-shrink: 0;
    font-family: ui-monospace, 'Cascadia Code', monospace;
    font-size: 0.6875rem;
    margin-top: 2px;
    padding: 3px 8px;
    white-space: nowrap;
  }

  .et-sb-subheading code,
  .et-sb-card-text code {
    background: rgba(255,255,255,0.07);
    border-radius: 3px;
    color: #e4e4e7;
    font-family: ui-monospace, 'Cascadia Code', monospace;
    font-size: 0.8125em;
    padding: 1px 4px;
  }
`;
