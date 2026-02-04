/**
 * Command interface for undo/redo operations
 *
 * Each command encapsulates a reversible action on the sequence.
 * Commands should be immutable after creation - all state needed
 * for execute/undo must be captured at construction time.
 */
export interface Command {
  /**
   * Execute the command (do the action)
   */
  execute(): void;

  /**
   * Undo the command (reverse the action)
   */
  undo(): void;

  /**
   * Human-readable description for UI display
   * @example "Add note C4", "Move 3 notes", "Resize note"
   */
  readonly description: string;
}

/**
 * Listener for command history changes
 */
export type CommandHistoryListener = () => void;

/**
 * CommandHistory - Manages undo/redo stacks
 *
 * Implements a standard undo/redo pattern:
 * - Execute pushes to undo stack and clears redo stack
 * - Undo pops from undo stack and pushes to redo stack
 * - Redo pops from redo stack and pushes to undo stack
 */
export class CommandHistory {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxHistory: number;
  private listeners: Set<CommandHistoryListener> = new Set();

  constructor(maxHistory: number = 100) {
    this.maxHistory = maxHistory;
  }

  /**
   * Execute a command and add it to history
   */
  execute(command: Command): void {
    command.execute();
    this.undoStack.push(command);

    // Clear redo stack on new action
    this.redoStack = [];

    // Trim history if too long
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }

    this.notifyListeners();
  }

  /**
   * Undo the last command
   * @returns The undone command, or null if nothing to undo
   */
  undo(): Command | null {
    const command = this.undoStack.pop();
    if (!command) return null;

    command.undo();
    this.redoStack.push(command);

    this.notifyListeners();
    return command;
  }

  /**
   * Redo the last undone command
   * @returns The redone command, or null if nothing to redo
   */
  redo(): Command | null {
    const command = this.redoStack.pop();
    if (!command) return null;

    command.execute();
    this.undoStack.push(command);

    this.notifyListeners();
    return command;
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Get description of the command that would be undone
   */
  getUndoDescription(): string | null {
    const command = this.undoStack[this.undoStack.length - 1];
    return command?.description ?? null;
  }

  /**
   * Get description of the command that would be redone
   */
  getRedoDescription(): string | null {
    const command = this.redoStack[this.redoStack.length - 1];
    return command?.description ?? null;
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notifyListeners();
  }

  /**
   * Get the number of commands in undo stack
   */
  getUndoCount(): number {
    return this.undoStack.length;
  }

  /**
   * Get the number of commands in redo stack
   */
  getRedoCount(): number {
    return this.redoStack.length;
  }

  /**
   * Subscribe to history changes
   */
  onChange(listener: CommandHistoryListener): void {
    this.listeners.add(listener);
  }

  /**
   * Unsubscribe from history changes
   */
  offChange(listener: CommandHistoryListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }
}
