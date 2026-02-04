/**
 * Main entry point for the Note Grid application
 *
 * Initializes the grid and sets up UI controls
 */

// Global reference to the grid instance
let noteGrid = null;

/**
 * Initializes the application when the DOM is ready
 */
function initApp() {
  // Get the container element
  const container = document.getElementById('note-grid-container');
  if (!container) {
    console.error('Note grid container not found');
    return;
  }

  // Create the note grid
  noteGrid = new NoteGrid(container);

  // Set up UI controls
  setupControls();

  console.log('Note Grid initialized successfully');
  console.log(`Grid size: ${noteGrid.getBarCount()} bars x ${noteGrid.getOctaveCount()} octaves`);
}

/**
 * Sets up the UI controls for bar and octave count
 */
function setupControls() {
  const barInput = document.getElementById('bar-count');
  const octaveInput = document.getElementById('octave-count');

  if (barInput) {
    // Set initial value
    barInput.value = noteGrid.getBarCount();

    // Handle input changes
    barInput.addEventListener('input', (event) => {
      const value = parseInt(event.target.value, 10);
      if (!isNaN(value)) {
        noteGrid.setBarCount(value);
        // Update input to show clamped value
        event.target.value = noteGrid.getBarCount();
      }
    });

    // Handle blur to ensure valid value
    barInput.addEventListener('blur', (event) => {
      event.target.value = noteGrid.getBarCount();
    });
  }

  if (octaveInput) {
    // Set initial value
    octaveInput.value = noteGrid.getOctaveCount();

    // Handle input changes
    octaveInput.addEventListener('input', (event) => {
      const value = parseInt(event.target.value, 10);
      if (!isNaN(value)) {
        noteGrid.setOctaveCount(value);
        // Update input to show clamped value
        event.target.value = noteGrid.getOctaveCount();
      }
    });

    // Handle blur to ensure valid value
    octaveInput.addEventListener('blur', (event) => {
      event.target.value = noteGrid.getOctaveCount();
    });
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
