<script>
  import Header from "./lib/Header.svelte";
  import LedGrid from "./lib/LedGrid.svelte";
  import StepEditor from "./lib/StepEditor.svelte";
  import BlockManager from "./lib/BlockManager.svelte";
  import Timeline from "./lib/Timeline.svelte";
  import Footer from "./lib/Footer.svelte";
  import { onMount } from "svelte";

  onMount(() => {
    // Initial setup if needed
  });
</script>

<div class="app-container">
  <Header />

  <div class="main-grid">
    <aside class="panel">
      <LedGrid />
    </aside>

    <main class="panel editor-container" style="position: relative;">
      <StepEditor />
      <BlockManager />
    </main>
  </div>

  <Timeline />

  <Footer />
</div>

<style>
  /* App-specific local styles (global styles are in app.css) */
</style>
