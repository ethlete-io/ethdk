- positions not migrated to strategies in \_transformingFullscreenDialogToDialog

```ts
  readonly _dialogService = inject(OverlayService);

  _transformingFullscreenDialogToDialog(extraConfig: OverlayBreakpointConfig = {}): OverlayBreakpointConfigEntry[] {
    return [
      {
        config: this._dialogService.positions.DEFAULTS.bottomSheet,
      },
      {
        breakpoint: 'sm',
        config: this._dialogService.positions.mergeConfigs(
          this._dialogService.positions.DEFAULTS.dialog,
          OVERLAY_CONFIG,
          extraConfig,
        ),
      },
    ];
  }

  showConfirmDialog(data: ConfirmDialogData) {
    return this._dialogService.open<ConfirmDialogComponent, ConfirmDialogData, ConfirmDialogResult>(
      ConfirmDialogComponent,
      {
        positions: this._transformingFullscreenDialogToDialog({}),
        data: data,
      },
    );
  }
```
