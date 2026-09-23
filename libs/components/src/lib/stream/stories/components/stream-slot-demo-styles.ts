export const STREAM_SLOT_DEMO_STYLES = `
  et-pip-window {
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
