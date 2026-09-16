import {
  retryDelay,
  syncOnce,
  type PlannerRemote,
  type StateStore,
  type SyncOutcome,
} from './syncEngine';

type Timers = {
  setTimeout: (callback: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

const realTimers: Timers = {
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * Decides when to sync: one run at a time, requests during a run coalesce into one follow-up, and
 * failures back off. Screens never wait on it; the planner always renders local state.
 */
export class PlannerSyncController {
  private timer: unknown = null;
  private dueAt = Infinity;
  private running = false;
  private rerun = false;
  private failures = 0;
  private disposed = false;

  constructor(
    private readonly store: StateStore,
    private readonly remote: PlannerRemote,
    private readonly onOutcome: (outcome: SyncOutcome) => void = () => {},
    private readonly timers: Timers = realTimers,
    private readonly now: () => number = Date.now
  ) {}

  /** Syncs after `delayMs`, or sooner if a sync is already due sooner. */
  request(delayMs = 0): void {
    if (this.disposed) return;
    if (this.running) {
      this.rerun = true;
      return;
    }
    this.schedule(delayMs);
  }

  dispose(): void {
    this.disposed = true;
    this.cancel();
  }

  private cancel(): void {
    if (this.timer !== null) this.timers.clearTimeout(this.timer);
    this.timer = null;
    this.dueAt = Infinity;
  }

  private schedule(delayMs: number): void {
    const dueAt = this.now() + delayMs;
    if (this.timer !== null && dueAt >= this.dueAt) return;
    this.cancel();
    this.dueAt = dueAt;
    this.timer = this.timers.setTimeout(() => {
      this.timer = null;
      this.dueAt = Infinity;
      void this.run();
    }, delayMs);
  }

  private async run(): Promise<void> {
    if (this.disposed) return;
    this.running = true;
    this.rerun = false;
    const outcome = await syncOnce(this.store, this.remote, (kind, id) =>
      console.warn(`Planner sync: the server rejected ${kind} ${id}; it stays on this device only.`)
    );
    this.running = false;
    if (this.disposed) return;
    this.onOutcome(outcome);

    const rerun = this.rerun;
    this.rerun = false;
    if (outcome.status === 'retry') {
      // Edits made meanwhile ride along with the backed-off retry instead of hammering a
      // backend that just failed.
      this.failures += 1;
      this.schedule(retryDelay(this.failures));
    } else {
      this.failures = 0;
      if (rerun) this.schedule(0);
    }
  }
}
