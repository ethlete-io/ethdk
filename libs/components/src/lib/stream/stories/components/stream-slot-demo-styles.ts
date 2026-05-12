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

  .et-stream-pip-chrome__previews {
    background-color: #000;
  }
` as const;
