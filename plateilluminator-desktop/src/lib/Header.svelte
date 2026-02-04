<script>
  import { history } from '../store.js';

  function undo() {
    console.log("Undo logic to be implemented");
  }
</script>

<header class="app-header">
  <div class="app-title">
    <i class="fas fa-lightbulb"></i>
    LED Configurator
  </div>
  <div class="header-actions">
    <button on:click={undo} class="icon-btn" title="Undo (Ctrl+Z)"
      style="font-size: 1rem; background: var(--bg-input); padding: 8px; border-radius: 8px;">
      <i class="fas fa-undo"></i> Undo
    </button>
  </div>
</header>
