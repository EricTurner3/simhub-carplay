<script lang="ts">
  import { useApp } from '../../lib/context.ts';
  import { GENERIC, GROUPS, LOOKS } from './catalog.ts';
  import ControlButton from './ControlButton.svelte';
  import CycleSwitch from './CycleSwitch.svelte';

  const { telemetry: t } = useApp();

  const live = $derived(t.conn.ws === 'open' && t.conn.upstream === 'connected');
  const groups = $derived(
    GROUPS.map((name) => ({
      name,
      controls: (t.profile?.controls ?? []).filter((c) => (LOOKS[c.id] ?? GENERIC).group === name),
    })).filter((g) => g.controls.length > 0),
  );
</script>

<div class="screen">
  {#if !live}
    <p class="warn">Not connected to SimHub. Controls are unavailable.</p>
  {/if}

  {#each groups as group (group.name)}
    <section>
      <h2>{group.name}</h2>
      <div class="grid">
        {#each group.controls as control (control.id)}
          {#if control.kind === 'cycle'}
            <CycleSwitch {control} disabled={!live} />
          {:else}
            <ControlButton {control} disabled={!live} />
          {/if}
        {/each}
      </div>
    </section>
  {/each}
</div>

<style>
  .screen {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }
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
    grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
    gap: var(--gap);
  }
  .warn {
    margin: 0;
    padding: 0.6rem 0.9rem;
    border-radius: 0.8rem;
    background: rgba(255, 179, 64, 0.14);
    color: var(--amber);
    font-size: 0.85rem;
  }
</style>
