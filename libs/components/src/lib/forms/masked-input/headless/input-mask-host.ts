import { InjectionToken, Signal, WritableSignal } from '@angular/core';

/**
 * The contract a text control fulfills to host an `[etInputMask]`. `et-input` /
 * `input[etInput]` provide it out of the box; any other field directive opts in by
 * providing `INPUT_MASK_HOST` on itself
 * (`{ provide: INPUT_MASK_HOST, useExisting: MyFieldDirective }`).
 */
export type InputMaskHost = {
  /** The text model the mask writes — raw or masked per `maskValueMode`. */
  value: WritableSignal<string>;
  /**
   * Bulk-edit mixed state of the host, when it has one. While set, the mask leaves the
   * host's (empty) mixed display alone instead of repainting the hidden raw value, and the
   * first edit that produces raw content commits it and resolves the flag.
   */
  mixed?: WritableSignal<boolean>;
  /** Whether the field has focus — drives the guide display. */
  focused: Signal<boolean>;
  /** The native input element the mask rewrites. */
  nativeControl: Signal<HTMLInputElement | null>;
  /** Stops the host's own `(input)` model-sync — the mask owns value-sync. */
  suppressNativeSync(): void;
  /**
   * Restores the host's own `(input)` model-sync — called when an attached mask is
   * set to `null`. Optional: hosts whose mask never changes at runtime can omit it.
   */
  resumeNativeSync?(): void;
};

export const INPUT_MASK_HOST = new InjectionToken<InputMaskHost>('INPUT_MASK_HOST');
