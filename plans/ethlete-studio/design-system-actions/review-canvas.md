# Open: 2. Review on the canvas

## 2. Review on the canvas

### 2.2 A new sketch adds controls that already exist - unverified (L2562)

- **Pain:** the sketch added a zoom toolbar. The accepted `canvas-frames` chip already does this.
- **Now:** the sketch reuses the chip.
- **Fix done:** the shared canvas element (2.1). No check for repeated markup.
- **Check (2026-10-29):** works, but the chip is drawn twice: app `− | 100 % | + | Fit`, drawing
  `Fit | 24%`. Tom still decides which chip both use.
- ADR 0136: [Sketches and the app use the app zoom chip](../../../apps/ethlete-studio/docs/adr/0136-sketches-and-the-app-use-the-app-zoom-chip.md)
