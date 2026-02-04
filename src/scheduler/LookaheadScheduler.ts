import type { ScheduledEvent, SchedulerConfig } from './types';

/**
 * High-precision scheduler using lookahead strategy for accurate timing
 *
 * JavaScript timing is unreliable due to:
 * - Event loop delays
 * - Garbage collection pauses
 * - Background tab throttling (setTimeout min 1000ms)
 *
 * The lookahead strategy schedules events ahead of time, compensating
 * for these delays by checking frequently and executing callbacks
 * that fall within the lookahead window.
 */
export class LookaheadScheduler {
  private queue: ScheduledEvent[] = [];
  private config: SchedulerConfig;
  private intervalId: number | null = null;
  private lookaheadMs: number;

  // Bound handler for cleanup
  private boundHandleVisibilityChange: () => void;

  constructor(config?: Partial<SchedulerConfig>) {
    this.config = {
      lookahead: config?.lookahead ?? 100,
      interval: config?.interval ?? 25,
    };
    this.lookaheadMs = this.config.lookahead;
    this.boundHandleVisibilityChange = this.handleVisibilityChange.bind(this);
  }

  /**
   * Start the scheduler tick
   */
  start(): void {
    if (this.intervalId !== null) {
      console.warn('Scheduler already running');
      return;
    }

    this.intervalId = window.setInterval(() => this.tick(), this.config.interval);

    // Handle background tab throttling
    document.addEventListener('visibilitychange', this.boundHandleVisibilityChange);

    console.log(
      `Scheduler started: ${this.config.interval}ms interval, ${this.lookaheadMs}ms lookahead`
    );
  }

  /**
   * Stop the scheduler and clear all pending events
   */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.queue = [];
    document.removeEventListener('visibilitychange', this.boundHandleVisibilityChange);
    console.log('Scheduler stopped');
  }

  /**
   * Schedule an event for future execution
   * @param callback Function to execute
   * @param time Absolute time in milliseconds (from performance.now())
   */
  scheduleEvent(callback: () => void, time: number): void {
    const event: ScheduledEvent = { time, callback };

    // Insert into queue maintaining sorted order (earliest first)
    const insertIndex = this.queue.findIndex((e) => e.time > time);
    if (insertIndex === -1) {
      this.queue.push(event);
    } else {
      this.queue.splice(insertIndex, 0, event);
    }
  }

  /**
   * Clear all pending events without stopping the scheduler
   */
  clearEvents(): void {
    this.queue = [];
  }

  /**
   * Process scheduled events (called by interval timer)
   */
  private tick(): void {
    const currentTime = performance.now();
    const scheduleAhead = currentTime + this.lookaheadMs;

    // Process all events that should be executed now
    while (this.queue.length > 0 && this.queue[0].time <= scheduleAhead) {
      const event = this.queue.shift()!;
      try {
        event.callback();
      } catch (error) {
        console.error('Error executing scheduled event:', error);
      }
    }
  }

  /**
   * Adjust lookahead when tab visibility changes
   */
  private handleVisibilityChange(): void {
    if (document.hidden) {
      // Background tab: increase lookahead to compensate for throttling
      this.lookaheadMs = 500;
      console.log('Tab hidden: increased lookahead to 500ms');
    } else {
      // Foreground tab: use configured lookahead
      this.lookaheadMs = this.config.lookahead;
      console.log(`Tab visible: restored lookahead to ${this.lookaheadMs}ms`);
    }
  }

  /**
   * Get number of pending events
   */
  get pendingEvents(): number {
    return this.queue.length;
  }

  /**
   * Check if scheduler is running
   */
  get isRunning(): boolean {
    return this.intervalId !== null;
  }
}
