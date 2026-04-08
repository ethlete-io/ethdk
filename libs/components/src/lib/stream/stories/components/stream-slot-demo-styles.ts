export const STREAM_SLOT_DEMO_STYLES = `
  .et-stream-manager {
    position: fixed;
    top: -9999px;
    left: -9999px;
    width: 1px;
    height: 1px;
    overflow: hidden;
  }

  et-pip-window {
    bottom: 24px;
    right: 24px;
    z-index: 9999;
    width: 320px;
    border-radius: 6px;
    overflow: hidden;
  }

  et-pip-player {
    display: block;
    position: relative;
    overflow: hidden;
  }

  et-pip-player > *,
  et-pip-player iframe {
    width: 100% !important;
    height: 100% !important;
    display: block;
  }

  .et-stream-pip-chrome__close,
  .et-stream-pip-chrome__back {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    cursor: pointer;
    flex-shrink: 0;
  }

  .et-stream-pip-chrome__previews {
    background-color: #000;
  }

  .slot-demo {
    background: #111;
    border-radius: 6px;
    overflow: hidden;
  }

  .slot-demo-nav {
    display: flex;
    gap: 2px;
    background: #000;
    padding: 8px 8px 0;
  }

  .slot-demo-nav-btn {
    padding: 6px 16px;
    background: #222;
    color: #888;
    border: none;
    border-radius: 4px 4px 0 0;
    cursor: pointer;
    font-family: monospace;
    font-size: 12px;
  }

  .slot-demo-nav-btn--active {
    background: #1a1a1a;
    color: #fff;
  }

  .slot-demo-page {
    padding: 16px;
    min-height: 80px;
  }

  .slot-demo-page-title {
    margin: 0 0 12px;
    font-size: 14px;
    font-weight: bold;
    color: #fff;
  }

  .slot-demo-hint {
    color: #aaa;
    margin: 12px 0 0;
    line-height: 1.5;
  }

  .slot-demo-player-slot {
    display: block;
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    background: #000;
    margin-bottom: 12px;
  }

  .slot-demo-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .slot-demo-btn {
    padding: 7px 14px;
    background: #3b82f6;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-family: monospace;
    font-size: 12px;
  }

  .slot-demo-btn--secondary {
    background: #333;
  }
` as const;
