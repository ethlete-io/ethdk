import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import {
  CommandPaletteRegistration,
  injectCommandPaletteRegistry,
  provideCommandPaletteRegistry,
  registerCommands,
} from './command-palette-registry';
import { CommandPaletteCommand } from './command-palette.types';

const command = (id: string, label = id): CommandPaletteCommand => ({ id, label, run: () => undefined });

@Component({
  selector: 'et-test-command-contributor',
  template: '',
})
class ContributorComponent {
  public extra = signal<CommandPaletteCommand[]>([]);

  constructor() {
    registerCommands([command('own')]);
    registerCommands(this.extra);
  }
}

@Component({
  selector: 'et-test-registry-host',
  template: `
    @if (showContributor()) {
      <et-test-command-contributor />
    }
  `,
  imports: [ContributorComponent],
  providers: [provideCommandPaletteRegistry()],
})
class RegistryHostComponent {
  public showContributor = signal(true);
  public registry = injectCommandPaletteRegistry();
}

const create = () => {
  const fixture = TestBed.createComponent(RegistryHostComponent);
  fixture.detectChanges();

  return {
    fixture,
    host: fixture.componentInstance,
    ids: () => fixture.componentInstance.registry.commands().map((entry) => entry.id),
  };
};

describe('command palette registry', () => {
  it('collects the commands a child registered', () => {
    const { ids } = create();

    expect(ids()).toEqual(['own']);
  });

  it('removes them again when the child that registered them is destroyed', () => {
    const { fixture, host, ids } = create();

    host.showContributor.set(false);
    fixture.detectChanges();

    expect(ids()).toEqual([]);
  });

  it('follows a signal source without a second registration', () => {
    const { fixture, ids } = create();
    const contributor = fixture.debugElement.children[0]?.componentInstance as ContributorComponent;

    contributor.extra.set([command('later')]);
    fixture.detectChanges();

    expect(ids()).toEqual(['own', 'later']);
  });

  it('lets the last registration of an id win, in the position the id first took', () => {
    const { fixture, ids } = create();
    const contributor = fixture.debugElement.children[0]?.componentInstance as ContributorComponent;

    contributor.extra.set([command('second'), command('own', 'Replaced')]);
    fixture.detectChanges();

    expect(ids()).toEqual(['own', 'second']);
    expect(fixture.componentInstance.registry.commands()[0]?.label).toBe('Replaced');
  });

  it('drops only the registration that is destroyed', () => {
    TestBed.runInInjectionContext(() => {
      const registry = injectCommandPaletteRegistry();
      const first: CommandPaletteRegistration = registry.register([command('a')]);
      registry.register([command('b')]);

      first.destroy();

      expect(registry.commands().map((entry) => entry.id)).toEqual(['b']);
    });
  });

  it('ignores a second destroy of the same registration', () => {
    TestBed.runInInjectionContext(() => {
      const registry = injectCommandPaletteRegistry();
      const registration = registry.register([command('a')]);

      registration.destroy();
      registration.destroy();

      expect(registry.commands()).toEqual([]);
    });
  });

  it('clears every registration', () => {
    TestBed.runInInjectionContext(() => {
      const registry = injectCommandPaletteRegistry();
      registry.register([command('a')]);
      registry.register([command('b')]);

      registry.clear();

      expect(registry.commands()).toEqual([]);
    });
  });
});
