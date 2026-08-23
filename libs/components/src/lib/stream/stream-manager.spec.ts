import '../../test-helpers';
import { createStreamDriver } from './testing/stream-driver';

const PLAYER_ID = 'youtube-abc';
const OTHER_PLAYER_ID = 'youtube-xyz';

describe('StreamManager', () => {
  describe('resolveBestSlot', () => {
    it('returns null while no slot claims the player, leaving it parked in the container', () => {
      const driver = createStreamDriver();

      driver.addPlayer(PLAYER_ID);
      driver.addSlot(OTHER_PLAYER_ID);

      expect(driver.streamManager.resolveBestSlot(PLAYER_ID)).toBeNull();
      expect(driver.streamManager.hasSlotFor(PLAYER_ID)).toBe(false);
      expect(driver.isParked(PLAYER_ID)).toBe(true);
    });

    it('takes a priority slot registered after a plain one', () => {
      const driver = createStreamDriver();

      driver.addPlayer(PLAYER_ID);
      driver.addSlot(PLAYER_ID);
      const priority = driver.addSlot(PLAYER_ID, { priority: true });

      expect(driver.streamManager.resolveBestSlot(PLAYER_ID)?.element).toBe(priority);
      expect(driver.parentOf(PLAYER_ID)).toBe(priority);
    });

    it('keeps a priority slot when a plain one registers afterwards', () => {
      const driver = createStreamDriver();

      driver.addPlayer(PLAYER_ID);
      const priority = driver.addSlot(PLAYER_ID, { priority: true });
      driver.addSlot(PLAYER_ID);

      expect(driver.streamManager.resolveBestSlot(PLAYER_ID)?.element).toBe(priority);
      expect(driver.parentOf(PLAYER_ID)).toBe(priority);
    });

    it('takes the last of several priority slots', () => {
      const driver = createStreamDriver();

      driver.addPlayer(PLAYER_ID);
      driver.addSlot(PLAYER_ID, { priority: true });
      const last = driver.addSlot(PLAYER_ID, { priority: true });

      expect(driver.streamManager.resolveBestSlot(PLAYER_ID)?.element).toBe(last);
      expect(driver.parentOf(PLAYER_ID)).toBe(last);
    });

    it('takes the last of several plain slots', () => {
      const driver = createStreamDriver();

      driver.addPlayer(PLAYER_ID);
      driver.addSlot(PLAYER_ID);
      const last = driver.addSlot(PLAYER_ID);

      expect(driver.streamManager.resolveBestSlot(PLAYER_ID)?.element).toBe(last);
      expect(driver.parentOf(PLAYER_ID)).toBe(last);
    });

    it('ignores a priority slot bound to another player', () => {
      const driver = createStreamDriver();

      driver.addPlayer(PLAYER_ID);
      driver.addSlot(OTHER_PLAYER_ID, { priority: true });
      const own = driver.addSlot(PLAYER_ID);

      expect(driver.streamManager.resolveBestSlot(PLAYER_ID)?.element).toBe(own);
      expect(driver.parentOf(PLAYER_ID)).toBe(own);
    });
  });

  describe('unregisterSlot', () => {
    it('reassigns the player to the next slot that still claims it', () => {
      const driver = createStreamDriver();

      driver.addPlayer(PLAYER_ID);
      const active = driver.addSlot(PLAYER_ID, { priority: true });
      const fallback = driver.addSlot(PLAYER_ID);

      expect(driver.parentOf(PLAYER_ID)).toBe(active);

      driver.streamManager.unregisterSlot(active);

      expect(driver.parentOf(PLAYER_ID)).toBe(fallback);
      expect(driver.destroyedPlayers).toEqual([]);
    });

    it('destroys the player when its last slot goes away', () => {
      const driver = createStreamDriver();

      const playerEl = driver.addPlayer(PLAYER_ID);
      const slot = driver.addSlot(PLAYER_ID);

      driver.streamManager.unregisterSlot(slot);

      expect(driver.destroyedPlayers).toEqual([PLAYER_ID]);
      expect(driver.streamManager.getPlayerElement(PLAYER_ID)).toBeNull();
      expect(playerEl.isConnected).toBe(false);
    });

    it('keeps a player that is in pip when its slot goes away', () => {
      const driver = createStreamDriver();

      const playerEl = driver.addPlayer(PLAYER_ID);
      const slot = driver.addSlot(PLAYER_ID);

      driver.streamManager.setPlayerInPip(PLAYER_ID, true);
      driver.streamManager.unregisterSlot(slot);

      expect(driver.destroyedPlayers).toEqual([]);
      expect(driver.streamManager.getPlayerElement(PLAYER_ID)).toBe(playerEl);
      expect(driver.streamManager.hasSlotFor(PLAYER_ID)).toBe(false);
    });

    it('leaves the player alone when a slot it does not live in goes away', () => {
      const driver = createStreamDriver();

      driver.addPlayer(PLAYER_ID);
      const active = driver.addSlot(PLAYER_ID, { priority: true });
      const idle = driver.addSlot(PLAYER_ID);

      driver.streamManager.unregisterSlot(idle);

      expect(driver.parentOf(PLAYER_ID)).toBe(active);
      expect(driver.destroyedPlayers).toEqual([]);
    });

    it('ignores an element that was never registered as a slot', () => {
      const driver = createStreamDriver();

      driver.addPlayer(PLAYER_ID);
      const slot = driver.addSlot(PLAYER_ID);

      driver.streamManager.unregisterSlot(document.createElement('div'));

      expect(driver.parentOf(PLAYER_ID)).toBe(slot);
      expect(driver.destroyedPlayers).toEqual([]);
    });
  });

  describe('transferPlayer', () => {
    it('re-keys the player without moving its element', () => {
      const driver = createStreamDriver();

      const playerEl = driver.addPlayer(PLAYER_ID);
      const slot = driver.addSlot(PLAYER_ID);

      driver.streamManager.transferPlayer(PLAYER_ID, OTHER_PLAYER_ID);

      expect(driver.streamManager.getPlayerElement(OTHER_PLAYER_ID)).toBe(playerEl);
      expect(driver.streamManager.getPlayerElement(PLAYER_ID)).toBeNull();
      expect(driver.parentOf(OTHER_PLAYER_ID)).toBe(slot);
    });

    it('carries the pip flag across the re-key', () => {
      const driver = createStreamDriver();

      driver.addPlayer(PLAYER_ID);
      driver.addSlot(PLAYER_ID);
      driver.streamManager.setPlayerInPip(PLAYER_ID, true);

      driver.streamManager.transferPlayer(PLAYER_ID, OTHER_PLAYER_ID);

      expect(driver.streamManager.isPlayerInPip(OTHER_PLAYER_ID)).toBe(true);
    });

    it('keeps the entry when the id does not change', () => {
      const driver = createStreamDriver();

      const playerEl = driver.addPlayer(PLAYER_ID);

      driver.streamManager.transferPlayer(PLAYER_ID, PLAYER_ID);

      expect(driver.streamManager.getPlayerElement(PLAYER_ID)).toBe(playerEl);
    });

    it('registers nothing for an unknown player', () => {
      const driver = createStreamDriver();

      driver.streamManager.transferPlayer(PLAYER_ID, OTHER_PLAYER_ID);

      expect(driver.streamManager.getPlayerElement(OTHER_PLAYER_ID)).toBeNull();
    });
  });

  describe('reassignment guards', () => {
    it('does not pull a player out of pip for a better slot', () => {
      const driver = createStreamDriver();

      driver.addPlayer(PLAYER_ID);
      const slot = driver.addSlot(PLAYER_ID);

      driver.streamManager.setPlayerInPip(PLAYER_ID, true);
      driver.addSlot(PLAYER_ID, { priority: true });

      expect(driver.parentOf(PLAYER_ID)).toBe(slot);
    });

    it('holds a player whose exit animation is in flight until the latch clears', () => {
      const driver = createStreamDriver();

      driver.addPlayer(PLAYER_ID);
      const slot = driver.addSlot(PLAYER_ID);

      driver.streamManager.setPlayerAnimatingOut(PLAYER_ID, true);
      driver.addSlot(PLAYER_ID, { priority: true });

      expect(driver.parentOf(PLAYER_ID)).toBe(slot);

      driver.streamManager.setPlayerAnimatingOut(PLAYER_ID, false);
      const settled = driver.addSlot(PLAYER_ID, { priority: true });

      expect(driver.parentOf(PLAYER_ID)).toBe(settled);
    });
  });
});
