# Open: 5. Drawing parts and pages

### 5.32 A page cannot reuse the canvas frame chrome - open

- **Pain:** `pages/system` "Many states": `elements/canvas-frames` exports only the fixed button frames, so the agent
  copied the frame head, frame box and zoom chip CSS into the sketch's `shared/`.
- **Fix option:** a sketch on `elements/canvas-frames` that exports frame head, frame box and zoom chip as named parts.
