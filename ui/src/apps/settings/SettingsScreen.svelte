<script lang="ts">
  import { useApp } from '../../lib/context.ts';

  const { view, telemetry, ui, cfg, units } = useApp();
  const p = $derived(telemetry.profile);
</script>

<div class="rows">
  <div class="row"><span>Bridge</span><b>{telemetry.conn.ws}</b></div>
  <div class="row"><span>Backend</span><b>{telemetry.conn.backend || '—'}</b></div>
  <div class="row"><span>Upstream</span><b>{telemetry.conn.upstream}{telemetry.conn.detail ? ` · ${telemetry.conn.detail}` : ''}</b></div>
  <div class="row"><span>Game</span><b>{p?.game ?? 'none'} → profile “{p?.id ?? '—'}” ({p?.channels.length ?? 0} channels)</b></div>
  <div class="row"><span>Units</span><b>{units() === 'mph' ? 'Imperial' : 'Metric'}{cfg.ui.units === 'auto' ? ' (auto)' : ''}</b></div>
  <div class="row"><span>Drive state</span><b>{view.drive} ({view.reason})</b></div>
  <div class="row"><span>Auto-switch</span><b>{cfg.ui.autoSwitch.enabled ? 'on' : 'off'}{view.manual ? ' · manual override' : ''}</b></div>
</div>
<button data-nav data-nav-default class="pill" onclick={() => (ui.debug = !ui.debug)}>
  {ui.debug ? 'Hide' : 'Show'} input &amp; telemetry debug
</button>

<style>
  .rows {
    display: flex;
    flex-direction: column;
    background: var(--card-2);
    border-radius: 0.9rem;
  }
  .row {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.6rem 1rem;
    border-bottom: 1px solid var(--line);
    font-size: 0.9rem;
  }
  .row:last-child {
    border-bottom: 0;
  }
  .row span {
    color: var(--text-2);
  }
  .row b {
    font-weight: 600;
    text-align: right;
  }
  .pill {
    align-self: flex-start;
    margin-top: var(--gap);
    padding: 0.6rem 1.1rem;
    border-radius: 999px;
    background: var(--accent);
    font-weight: 600;
    font-size: 0.9rem;
  }
</style>
