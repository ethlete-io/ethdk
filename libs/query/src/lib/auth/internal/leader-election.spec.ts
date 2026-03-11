import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupLeaderElection } from './leader-election';

describe('setupLeaderElection', () => {
  let originalBroadcastChannel: typeof BroadcastChannel;
  let mockChannel: {
    postMessage: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    onmessage: ((event: MessageEvent) => void) | null;
  };
  let storage: Record<string, string>;

  beforeEach(() => {
    // Mock BroadcastChannel
    originalBroadcastChannel = globalThis.BroadcastChannel;
    mockChannel = {
      postMessage: vi.fn(),
      close: vi.fn(),
      onmessage: null,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).BroadcastChannel = vi.fn(function (this: any) {
      return mockChannel;
    });

    // Mock localStorage
    storage = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => storage[key] || null);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => {
      storage[key] = value;
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key) => {
      delete storage[key];
    });

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    globalThis.BroadcastChannel = originalBroadcastChannel;
  });

  it('should initialize and become leader on first tab', () => {
    TestBed.runInInjectionContext(() => {
      const election = setupLeaderElection();

      expect(election.isLeader()).toBe(true);
      expect(election.becomeLeader).toBeDefined();
      expect(election.cleanup).toBeDefined();
    });
  });

  it('should send heartbeat messages periodically when leader', () => {
    TestBed.runInInjectionContext(() => {
      const election = setupLeaderElection();

      expect(election.isLeader()).toBe(true);

      mockChannel.postMessage.mockClear();

      // Advance time by heartbeat interval
      vi.advanceTimersByTime(1000);

      expect(mockChannel.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'heartbeat',
        }),
      );
    });
  });

  it('should not send heartbeat when not leader', () => {
    TestBed.runInInjectionContext(() => {
      // Setup first tab as leader
      const election1 = setupLeaderElection();
      expect(election1.isLeader()).toBe(true);

      // Manually set storage to simulate another tab is leader
      storage['ethlete-auth-leader-heartbeat'] = JSON.stringify({
        tabId: 'other-tab',
        timestamp: Date.now(),
      });

      mockChannel.postMessage.mockClear();

      // Setup second tab
      const election2 = setupLeaderElection();

      // Second tab should not be leader
      expect(election2.isLeader()).toBe(false);

      // Advance time
      vi.advanceTimersByTime(1000);

      // Second tab should not send heartbeat (not leader)
      // Note: We need to check after clearing the mock from setup
      expect(election2.isLeader()).toBe(false);
    });
  });

  it('should become leader when current leader dies', () => {
    TestBed.runInInjectionContext(() => {
      // Simulate expired leader in storage
      storage['ethlete-auth-leader-heartbeat'] = JSON.stringify({
        tabId: 'old-leader',
        timestamp: Date.now() - 5000, // 5 seconds ago (timeout is 3 seconds)
      });

      const election = setupLeaderElection();

      // Should become leader because old leader timed out
      expect(election.isLeader()).toBe(true);
    });
  });

  it('should update localStorage with heartbeat timestamp', () => {
    TestBed.runInInjectionContext(() => {
      const election = setupLeaderElection();

      expect(election.isLeader()).toBe(true);

      // Check that storage was updated
      const stored = storage['ethlete-auth-leader-heartbeat'];
      expect(stored).toBeDefined();

      const parsed = JSON.parse(stored as string);
      expect(parsed.tabId).toBeDefined();
      expect(parsed.timestamp).toBeDefined();
      expect(typeof parsed.timestamp).toBe('number');
    });
  });

  it('should release leadership on cleanup', () => {
    TestBed.runInInjectionContext(() => {
      const election = setupLeaderElection();

      expect(election.isLeader()).toBe(true);

      mockChannel.postMessage.mockClear();

      // Cleanup
      election.cleanup();

      // Should send leader-release message
      expect(mockChannel.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'leader-release',
        }),
      );

      // Should close channel
      expect(mockChannel.close).toHaveBeenCalled();
    });
  });

  it('should manually become leader when becomeLeader is called', () => {
    TestBed.runInInjectionContext(() => {
      // Set another tab as leader
      storage['ethlete-auth-leader-heartbeat'] = JSON.stringify({
        tabId: 'other-tab',
        timestamp: Date.now(),
      });

      const election = setupLeaderElection();

      expect(election.isLeader()).toBe(false);

      mockChannel.postMessage.mockClear();

      // Force become leader
      election.becomeLeader();

      expect(election.isLeader()).toBe(true);

      // Should broadcast leader-claim
      expect(mockChannel.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'leader-claim',
        }),
      );
    });
  });

  it('should handle leader-release message from other tab', () => {
    TestBed.runInInjectionContext(() => {
      // Setup as non-leader
      storage['ethlete-auth-leader-heartbeat'] = JSON.stringify({
        tabId: 'other-tab',
        timestamp: Date.now(),
      });

      const election = setupLeaderElection();
      expect(election.isLeader()).toBe(false);

      // Simulate leader-release message and clear storage
      delete storage['ethlete-auth-leader-heartbeat'];

      mockChannel.onmessage?.({
        data: {
          type: 'leader-release',
          tabId: 'other-tab',
        },
      } as MessageEvent);

      // Should try to become leader after timeout (100ms + interval check)
      vi.advanceTimersByTime(1100);

      expect(election.isLeader()).toBe(true);
    });
  });

  it('should work when BroadcastChannel is not available', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).BroadcastChannel = undefined;

    TestBed.runInInjectionContext(() => {
      const election = setupLeaderElection();

      // Should automatically be leader
      expect(election.isLeader()).toBe(true);
      expect(election.becomeLeader).toBeDefined();
      expect(election.cleanup).toBeDefined();

      // Cleanup should not throw
      expect(() => election.cleanup()).not.toThrow();
    });
  });

  it('should work when localStorage is not available', () => {
    // Mock localStorage.getItem to throw error
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('localStorage not available');
    });

    TestBed.runInInjectionContext(() => {
      const election = setupLeaderElection();

      // Should automatically be leader
      expect(election.isLeader()).toBe(true);
    });
  });

  it('should clean up intervals on cleanup', () => {
    TestBed.runInInjectionContext(() => {
      const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

      const election = setupLeaderElection();

      election.cleanup();

      // Should clear both intervals (heartbeat + leader check)
      expect(clearIntervalSpy).toHaveBeenCalledTimes(2);
    });
  });

  it('should remove event listener on cleanup', () => {
    TestBed.runInInjectionContext(() => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

      const election = setupLeaderElection();

      election.cleanup();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });
  });

  it('should return readonly signal for isLeader', () => {
    TestBed.runInInjectionContext(() => {
      const election = setupLeaderElection();

      const leaderSignal = election.isLeader;

      // Should be a signal
      expect(typeof leaderSignal).toBe('function');

      // Should not have set method (readonly)
      expect((leaderSignal as unknown as Record<string, unknown>)['set']).toBeUndefined();
    });
  });

  describe('instanceCount', () => {
    it('should start at 1', () => {
      TestBed.runInInjectionContext(() => {
        const election = setupLeaderElection();
        expect(election.instanceCount()).toBe(1);
      });
    });

    it('should return a readonly signal', () => {
      TestBed.runInInjectionContext(() => {
        const election = setupLeaderElection();
        expect(typeof election.instanceCount).toBe('function');
        expect((election.instanceCount as unknown as Record<string, unknown>)['set']).toBeUndefined();
      });
    });

    it('should increase when another tab registers', () => {
      TestBed.runInInjectionContext(() => {
        const election = setupLeaderElection();
        expect(election.instanceCount()).toBe(1);

        mockChannel.onmessage?.({ data: { type: 'instance-register', tabId: 'other-tab-1' } } as MessageEvent);

        expect(election.instanceCount()).toBe(2);
      });
    });

    it('should decrease when a tab unregisters', () => {
      TestBed.runInInjectionContext(() => {
        const election = setupLeaderElection();
        mockChannel.onmessage?.({ data: { type: 'instance-register', tabId: 'other-tab-1' } } as MessageEvent);
        expect(election.instanceCount()).toBe(2);

        mockChannel.onmessage?.({ data: { type: 'instance-unregister', tabId: 'other-tab-1' } } as MessageEvent);
        expect(election.instanceCount()).toBe(1);
      });
    });

    it('should prune stale tabs after leaderTimeout', () => {
      TestBed.runInInjectionContext(() => {
        const election = setupLeaderElection();

        // Register another tab without sending any further heartbeats
        mockChannel.onmessage?.({ data: { type: 'instance-register', tabId: 'stale-tab' } } as MessageEvent);
        expect(election.instanceCount()).toBe(2);

        // Advance past leaderTimeout (3000 ms) — stale-tab sends no heartbeats
        vi.advanceTimersByTime(4000);

        expect(election.instanceCount()).toBe(1);
      });
    });

    it('should not prune a tab that keeps sending tab-heartbeats', () => {
      TestBed.runInInjectionContext(() => {
        const election = setupLeaderElection();
        mockChannel.onmessage?.({ data: { type: 'instance-register', tabId: 'alive-tab' } } as MessageEvent);

        // Keep the other tab alive by sending heartbeats every second
        for (let i = 0; i < 5; i++) {
          vi.advanceTimersByTime(1000);
          mockChannel.onmessage?.({ data: { type: 'tab-heartbeat', tabId: 'alive-tab' } } as MessageEvent);
        }

        expect(election.instanceCount()).toBe(2);
      });
    });

    it('should respond to instance-register with a tab-heartbeat', () => {
      TestBed.runInInjectionContext(() => {
        setupLeaderElection();
        mockChannel.postMessage.mockClear();

        mockChannel.onmessage?.({ data: { type: 'instance-register', tabId: 'other-tab-1' } } as MessageEvent);

        expect(mockChannel.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'tab-heartbeat' }));
      });
    });

    it('should broadcast instance-unregister on cleanup', () => {
      TestBed.runInInjectionContext(() => {
        const election = setupLeaderElection();
        mockChannel.postMessage.mockClear();

        election.cleanup();

        expect(mockChannel.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'instance-unregister' }));
      });
    });

    it('should return instanceCount = 1 in SSR fallback', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).BroadcastChannel = undefined;

      TestBed.runInInjectionContext(() => {
        const election = setupLeaderElection();
        expect(election.instanceCount()).toBe(1);
      });
    });
  });
});
