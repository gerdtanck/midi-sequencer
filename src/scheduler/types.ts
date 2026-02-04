/**
 * Event scheduled for future execution
 */
export interface ScheduledEvent {
  time: number;
  callback: () => void;
}

/**
 * Configuration for the lookahead scheduler
 */
export interface SchedulerConfig {
  /** How far ahead to schedule events (ms) */
  lookahead: number;
  /** How often to check the schedule (ms) */
  interval: number;
}
