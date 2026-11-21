<script lang="ts">
  let { app }: { app: { colors: [string, string]; glyph: string } } = $props();
</script>

<div class="tile" style:--a={app.colors[0]} style:--b={app.colors[1]}>
  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {@html app.glyph}
  </svg>
</div>

<style>
  .tile {
    width: 100%;
    aspect-ratio: 1;
    border-radius: 23%;
    background: linear-gradient(180deg, var(--a), var(--b));
    display: grid;
    place-items: center;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
  }
  svg {
    width: 58%;
    height: 58%;
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.25));
  }
</style>
