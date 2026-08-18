import { DestroyRef, Signal, computed, inject, isSignal, signal } from '@angular/core';
import { defineRootProvider, toInjectFn, toProvideFn, toToken } from '@ethlete/core';
import { CommandPaletteCommand } from './command-palette.types';

/**
 * Commands to register: a plain array for a fixed set, or a signal for one that changes - a command
 * whose `disabled` or `label` depends on state needs no re-registration when read from a signal.
 */
export type CommandPaletteSource = readonly CommandPaletteCommand[] | Signal<readonly CommandPaletteCommand[]>;

export type CommandPaletteRegistration = {
  /** Removes these commands from the palette. Calling it twice is harmless. */
  destroy: () => void;
};

type RegisteredSource = {
  key: symbol;
  commands: Signal<readonly CommandPaletteCommand[]>;
};

const toSourceSignal = (source: CommandPaletteSource): Signal<readonly CommandPaletteCommand[]> =>
  isSignal(source) ? source : signal(source).asReadonly();

const COMMAND_PALETTE_REGISTRY_DEF = /* @__PURE__ */ defineRootProvider(
  () => {
    const sources = signal<readonly RegisteredSource[]>([]);

    // A Map keyed by id both de-duplicates and decides the outcome: a repeated id keeps the position it
    // first appeared in and takes the value registered last.
    const commands = computed(() => {
      const byId = new Map<string, CommandPaletteCommand>();

      for (const source of sources()) {
        for (const command of source.commands()) {
          byId.set(command.id, command);
        }
      }

      return [...byId.values()] as readonly CommandPaletteCommand[];
    });

    const register = (source: CommandPaletteSource): CommandPaletteRegistration => {
      const registered: RegisteredSource = {
        key: Symbol('et-command-palette-source'),
        commands: toSourceSignal(source),
      };

      sources.update((current) => [...current, registered]);

      return {
        destroy: () => sources.update((current) => current.filter((entry) => entry.key !== registered.key)),
      };
    };

    return {
      /** Every registered command, de-duplicated by id. */
      commands,
      register,
      /** Removes every registration. */
      clear: () => sources.set([]),
    };
  },
  {
    name: 'Command Palette Registry',
  },
);

/**
 * The set of commands the palette offers. Registered from anywhere in the app, so a lazily loaded
 * feature can contribute its own; read by the palette when it opens.
 *
 * Provide it on a subtree to give that subtree its own set - otherwise there is one per application.
 * Prefer {@link registerCommands} over calling `register` here, unless the registration has to outlive
 * the component that made it.
 */
export const provideCommandPaletteRegistry = /* @__PURE__ */ toProvideFn(COMMAND_PALETTE_REGISTRY_DEF);
export const injectCommandPaletteRegistry = /* @__PURE__ */ toInjectFn(COMMAND_PALETTE_REGISTRY_DEF);
export const COMMAND_PALETTE_REGISTRY = /* @__PURE__ */ toToken(COMMAND_PALETTE_REGISTRY_DEF);

/**
 * Registers commands for as long as the injecting component or service lives. Call it in an injection
 * context; it removes the commands again on destroy, so a lazily loaded feature's commands leave the
 * palette with it.
 *
 * @example
 * registerCommands([
 *   { id: 'row.add', label: 'Add row', group: 'Rows', run: () => this.addRow() },
 * ]);
 *
 * @example
 * // A signal source keeps a command's own state current without re-registering it.
 * registerCommands(computed(() => [
 *   { id: 'row.delete', label: 'Delete row', disabled: !this.selectedRow(), run: () => this.deleteRow() },
 * ]));
 */
export const registerCommands = (source: CommandPaletteSource): CommandPaletteRegistration => {
  const registration = injectCommandPaletteRegistry().register(source);

  inject(DestroyRef).onDestroy(() => registration.destroy());

  return registration;
};
