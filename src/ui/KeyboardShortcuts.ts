import type { PlaybackEngine } from '@/core/PlaybackEngine';
import type { MidiManager } from '@/midi/MidiManager';
import type { NoteGrid } from './grid/NoteGrid';

/**
 * KeyboardShortcuts - Handles global keyboard shortcuts for the sequencer
 *
 * Shortcuts:
 * - Space: Toggle play/stop
 * - Escape: Stop playback
 * - P: Panic (all notes off)
 * - Ctrl+Z: Undo
 * - Ctrl+Y / Ctrl+Shift+Z: Redo
 */
export class KeyboardShortcuts {
  private playbackEngine: PlaybackEngine;
  private midiManager: MidiManager;
  private noteGrid: NoteGrid | null = null;
  private boundOnKeyDown: (e: KeyboardEvent) => void;

  // Callback to update UI when playback state changes
  private onPlaybackStateChange?: (isPlaying: boolean) => void;

  constructor(playbackEngine: PlaybackEngine, midiManager: MidiManager) {
    this.playbackEngine = playbackEngine;
    this.midiManager = midiManager;

    this.boundOnKeyDown = this.onKeyDown.bind(this);
    window.addEventListener('keydown', this.boundOnKeyDown);
  }

  /**
   * Set the note grid for undo/redo support
   */
  setNoteGrid(noteGrid: NoteGrid): void {
    this.noteGrid = noteGrid;
  }

  /**
   * Set callback for playback state changes (to update UI)
   */
  setPlaybackStateCallback(callback: (isPlaying: boolean) => void): void {
    this.onPlaybackStateChange = callback;
  }

  /**
   * Handle keydown events
   */
  private onKeyDown(event: KeyboardEvent): void {
    // Ignore if typing in an input field
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
      return;
    }

    // Handle Ctrl/Cmd+key shortcuts
    if (event.ctrlKey || event.metaKey) {
      switch (event.code) {
        case 'KeyZ':
          event.preventDefault();
          if (event.shiftKey) {
            // Ctrl+Shift+Z = Redo
            this.redo();
          } else {
            // Ctrl+Z = Undo
            this.undo();
          }
          return;

        case 'KeyY':
          // Ctrl+Y = Redo
          event.preventDefault();
          this.redo();
          return;
      }
    }

    // Handle non-modifier shortcuts
    switch (event.code) {
      case 'Space':
        event.preventDefault();
        this.togglePlayback();
        break;

      case 'Escape':
        event.preventDefault();
        this.stop();
        break;

      case 'KeyP':
        // P for Panic (only without modifiers)
        if (!event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          this.panic();
        }
        break;
    }
  }

  /**
   * Toggle play/stop
   */
  private togglePlayback(): void {
    if (this.playbackEngine.isPlaying) {
      this.playbackEngine.stop();
      this.onPlaybackStateChange?.(false);
    } else {
      this.playbackEngine.start();
      this.onPlaybackStateChange?.(true);
    }
  }

  /**
   * Stop playback
   */
  private stop(): void {
    if (this.playbackEngine.isPlaying) {
      this.playbackEngine.stop();
      this.onPlaybackStateChange?.(false);
    }
  }

  /**
   * Panic - stop all notes
   */
  private panic(): void {
    this.playbackEngine.stop();
    this.midiManager.panic();
    this.onPlaybackStateChange?.(false);
    console.log('Panic triggered via keyboard');
  }

  /**
   * Undo last action
   */
  private undo(): void {
    if (this.noteGrid?.undo()) {
      console.log('Undo');
    }
  }

  /**
   * Redo last undone action
   */
  private redo(): void {
    if (this.noteGrid?.redo()) {
      console.log('Redo');
    }
  }

  /**
   * Clean up event listeners
   */
  dispose(): void {
    window.removeEventListener('keydown', this.boundOnKeyDown);
  }
}
