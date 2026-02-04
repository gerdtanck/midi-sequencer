import type { ScheduledEvent, SchedulerConfig } from './types';

/**
 * High-precision scheduler using lookahead strategy for accurate timing
 * Handles background tab throttling automatically
 */
export class LookaheadScheduler {
  private queue: ScheduledEvent[] = [];
  private config: SchedulerConfig;
  private intervalId: number | null = null;
  private currentTime: number = 0;
  private lookaheadMs: number;

  constructor(config?: Partial<SchedulerConfig>) {
    this.config = {
      lookahead: config?.lookahead ?? 100,
      interval: config?.interval ?? 25
    };
    this.lookaheadMs = this.config.lookahead;
  }

  /**
   * Start the scheduler tick
   */
  start(): void {
    if (this.intervalId !== null) {
      console.warn('Scheduler already running');
      return;
    }

    this.currentTime = performance.now();
    this.intervalId = window.setInterval(() => this.tick(), this.config.interval);

    // Handle background tab throttling
    document.addEventListener('visibilitychange', () => this.handleVisibilityChange());

    console.log(`Scheduler started: ${this.config.interval}ms interval, ${this.lookaheadMs}ms lookahead`);
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
    const insertIndex = this.queue.findIndex(e => e.time > time);
    if (insertIndex === -1) {
      this.queue.push(event);
    } else {
      this.queue.splice(insertIndex, 0, event);
    }
  }

  /**
   * Process scheduled events (called by interval timer)
   */
  private tick(): void {
    this.currentTime = performance.now();
    const scheduleAhead = this.currentTime + this.lookaheadMs;

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
}
