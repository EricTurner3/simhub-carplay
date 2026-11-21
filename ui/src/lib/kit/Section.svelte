<script lang="ts">
  import type { Snippet } from 'svelte';

  /** Titled grid of tiles. `min` is the minimum tile width. */
  let { title, min = '10rem', children }: { title?: string; min?: string; children: Snippet } = $props();
</script>

<section>
  {#if title}<h2>{title}</h2>{/if}
  <div class="grid" style:--min={min}>
    {@render children()}
  </div>
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }
  h2 {
    margin: 0 0.2rem;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-3);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--min), 1fr));
    gap: var(--gap);
  }
</style>
