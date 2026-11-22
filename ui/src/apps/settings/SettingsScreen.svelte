<script lang="ts">
  import { ICON_SCALE_MAX, ICON_SCALE_MIN, type DashboardLayout, type UiConfig } from '@simhub-carplay/shared';
  import { useApp } from '../../lib/context.ts';
  import { BACKGROUNDS, customCss } from '../../lib/appearance.ts';
  import { perf, setLite } from '../../lib/perf.svelte.ts';

  const { view, telemetry, ui, cfg, units, updateSettings } = useApp();
  const p = $derived(telemetry.profile);
  const look = $derived(cfg.ui.appearance);
  const connected = $derived(telemetry.conn.ws === 'open');

  const UNIT_OPTIONS: { id: UiConfig['units']; label: string }[] = [
    { id: 'auto', label: 'Auto' },
    { id: 'mph', label: 'Imperial' },
    { id: 'kmh', label: 'Metric' },
  ];

  /** Color pickers preview while dragging and save once the picker closes. */
  function pickColor(key: 'from' | 'to', e: Event, save: boolean) {
    const value = (e.currentTarget as HTMLInputElement).value;
    if (save) updateSettings({ appearance: { background: 'custom', custom: { [key]: value } } });
    else look.custom[key] = value;
  }

  const LAYOUT_OPTIONS: { id: DashboardLayout; label: string; hint: string }[] = [
    { id: 'classic', label: 'Classic', hint: 'Two cards' },
    { id: 'gauges', label: 'Gauges', hint: 'Cards + gauge row' },
  ];

  const STEP = 0.1;
  const clampScale = (v: number) => Math.round(Math.min(ICON_SCALE_MAX, Math.max(ICON_SCALE_MIN, v)) * 10) / 10;
  const setScale = (v: number) => updateSettings({ appearance: { iconScale: clampScale(v) } });

  function rotate() {
    updateSettings({ appearance: { background: 'custom', custom: { angle: (look.custom.angle + 45) % 360 } } });
  }
</script>

<div class="screen">
  {#if !connected}
    <p class="warn">Not connected to the bridge. Changes won't be saved.</p>
  {/if}

  <section>
    <h2>Units</h2>
    <div class="segmented" role="radiogroup" aria-label="Units">
      {#each UNIT_OPTIONS as opt (opt.id)}
        <button
          data-nav
          data-nav-default={opt.id === cfg.ui.units ? true : undefined}
          role="radio"
          aria-checked={cfg.ui.units === opt.id}
          class:on={cfg.ui.units === opt.id}
          onclick={() => updateSettings({ units: opt.id })}
        >
          {opt.label}
          {#if opt.id === 'auto'}<small>{units() === 'mph' ? 'Imperial' : 'Metric'}</small>{/if}
        </button>
      {/each}
    </div>
  </section>

  <section>
    <h2>Dashboard</h2>
    <div class="segmented two" role="radiogroup" aria-label="Dashboard layout">
      {#each LAYOUT_OPTIONS as opt (opt.id)}
        <button
          data-nav
          role="radio"
          aria-checked={look.dashboard === opt.id}
          class:on={look.dashboard === opt.id}
          onclick={() => updateSettings({ appearance: { dashboard: opt.id } })}
        >
          {opt.label}
          <small>{opt.hint}</small>
        </button>
      {/each}
    </div>
  </section>

  <section>
    <h2>App icon size</h2>
    <div class="scale">
      <button data-nav class="step" aria-label="Smaller icons" disabled={look.iconScale <= ICON_SCALE_MIN} onclick={() => setScale(look.iconScale - STEP)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" /></svg>
      </button>
      <!-- Slider for touch (previews while dragging, saves on release); knob users get the buttons. -->
      <input
        type="range"
        min={ICON_SCALE_MIN}
        max={ICON_SCALE_MAX}
        step={STEP}
        value={look.iconScale}
        aria-label="App icon size"
        oninput={(e) => (look.iconScale = clampScale(e.currentTarget.valueAsNumber))}
        onchange={(e) => setScale(e.currentTarget.valueAsNumber)}
      />
      <button data-nav class="step" aria-label="Bigger icons" disabled={look.iconScale >= ICON_SCALE_MAX} onclick={() => setScale(look.iconScale + STEP)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12M12 6v12" /></svg>
      </button>
      <button data-nav class="value tabular" aria-label="Reset icon size" onclick={() => setScale(1)}>
        {Math.round(look.iconScale * 100)}%
      </button>
    </div>
  </section>

  <section>
    <h2>Background</h2>
    <div class="swatches">
      {#each BACKGROUNDS as bg (bg.id)}
        <button
          data-nav
          class="swatch"
          class:on={look.background === bg.id}
          style:background={bg.css}
          aria-pressed={look.background === bg.id}
          onclick={() => updateSettings({ appearance: { background: bg.id } })}
        >
          <span>{bg.name}</span>
        </button>
      {/each}
      <button
        data-nav
        class="swatch"
        class:on={look.background === 'custom'}
        style:background={customCss(look.custom)}
        aria-pressed={look.background === 'custom'}
        onclick={() => updateSettings({ appearance: { background: 'custom' } })}
      >
        <span>Custom</span>
      </button>
    </div>

    {#if look.background === 'custom'}
      <div class="custom">
        <label class="color" data-nav>
          <input
            type="color"
            value={look.custom.from}
            oninput={(e) => pickColor('from', e, false)}
            onchange={(e) => pickColor('from', e, true)}
          />
          <span>Start color</span>
        </label>
        <label class="color" data-nav>
          <input
            type="color"
            value={look.custom.to}
            oninput={(e) => pickColor('to', e, false)}
            onchange={(e) => pickColor('to', e, true)}
          />
          <span>End color</span>
        </label>
        <button data-nav class="chip" onclick={rotate} aria-label={`Direction ${look.custom.angle} degrees, rotate`}>
          <svg viewBox="0 0 24 24" style:transform={`rotate(${look.custom.angle}deg)`} aria-hidden="true">
            <path d="M12 20V4M6 10l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span>Direction</span>
        </button>
      </div>
    {/if}

    <button
      data-nav
      class="toggle"
      role="switch"
      aria-checked={look.glass}
      onclick={() => updateSettings({ appearance: { glass: !look.glass } })}
    >
      <span class="label">Frosted glass cards<small>Turn off if the screen stutters</small></span>
      <span class="switch" class:on={look.glass}></span>
    </button>

    <button data-nav class="toggle" role="switch" aria-checked={perf.lite} onclick={() => setLite(!perf.lite)}>
      <span class="label">Lite mode<small>This screen only: no blur or animations, 30fps, for older tablets</small></span>
      <span class="switch" class:on={perf.lite}></span>
    </button>
  </section>

  <section>
    <h2>Status</h2>
    <div class="rows">
      <div class="row"><span>Bridge</span><b>{telemetry.conn.ws}</b></div>
      <div class="row"><span>Backend</span><b>{telemetry.conn.backend || '—'}</b></div>
      <div class="row"><span>Upstream</span><b>{telemetry.conn.upstream}{telemetry.conn.detail ? ` · ${telemetry.conn.detail}` : ''}</b></div>
      <div class="row"><span>Game</span><b>{p?.game ?? 'none'} → profile “{p?.id ?? '—'}” ({p?.channels.length ?? 0} channels)</b></div>
      <div class="row"><span>Drive state</span><b>{view.drive} ({view.reason})</b></div>
      <div class="row"><span>Auto-switch</span><b>{cfg.ui.autoSwitch.enabled ? 'on' : 'off'}{view.manual ? ' · manual override' : ''}</b></div>
    </div>
    <div class="actions">
      <!-- Picks up a rebuilt UI after the bridge restarts; works even while it's down
           (the page shows "Waiting for bridge" and retries). -->
      <button data-nav class="pill" onclick={() => location.reload()}>Reload screen</button>
      <button data-nav class="pill secondary" onclick={() => (ui.debug = !ui.debug)}>
        {ui.debug ? 'Hide' : 'Show'} input &amp; telemetry debug
      </button>
    </div>
  </section>
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
  .warn {
    margin: 0;
    color: var(--amber);
    font-size: 0.85rem;
  }

  .segmented {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.3rem;
    padding: 0.3rem;
    border-radius: 0.9rem;
    background: var(--card-2);
  }
  .segmented.two {
    grid-template-columns: repeat(2, 1fr);
  }
  .segmented button {
    padding: 0.6rem 0.4rem;
    border-radius: 0.65rem;
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--text-2);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.1rem;
    transition: background 0.2s, color 0.2s;
  }
  .segmented button.on {
    background: var(--accent);
    color: #fff;
  }
  .segmented small {
    font-size: 0.68rem;
    font-weight: 500;
    opacity: 0.75;
  }

  .scale {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.45rem 0.55rem;
    border-radius: 0.9rem;
    background: var(--card-2);
  }
  .step {
    flex: none;
    width: 2.4rem;
    height: 2.4rem;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: rgba(255, 255, 255, 0.1);
  }
  .step:disabled {
    opacity: 0.35;
  }
  .step svg {
    width: 1.2rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.4;
    stroke-linecap: round;
  }
  .scale input {
    flex: 1;
    min-width: 0;
    accent-color: var(--accent);
    height: 2.4rem;
  }
  .scale .value {
    flex: none;
    min-width: 3.6rem;
    font-weight: 700;
    font-size: 0.9rem;
    text-align: center;
  }

  .swatches {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
    gap: var(--gap);
  }
  .swatch {
    height: 4.2rem;
    border-radius: 0.8rem;
    position: relative;
    box-shadow: inset 0 0 0 1px var(--line);
    display: flex;
    align-items: flex-end;
    padding: 0.45rem 0.6rem;
    font-size: 0.8rem;
    font-weight: 600;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
  }
  .swatch.on {
    box-shadow: inset 0 0 0 0.16rem var(--accent);
  }
  .swatch.on::after {
    content: '';
    position: absolute;
    top: 0.45rem;
    right: 0.45rem;
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 0 0.15rem #fff;
  }

  .custom {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
    gap: var(--gap);
  }
  .color,
  .chip {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.55rem 0.75rem;
    border-radius: 0.8rem;
    background: var(--card-2);
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
  }
  .color input {
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: 0;
    border-radius: 0.45rem;
    background: none;
    cursor: pointer;
  }
  .color input::-webkit-color-swatch-wrapper {
    padding: 0;
  }
  .color input::-webkit-color-swatch {
    border: 1px solid var(--line);
    border-radius: 0.45rem;
  }
  .chip svg {
    width: 2rem;
    height: 2rem;
    padding: 0.3rem;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    transition: transform 0.3s var(--ease-out);
  }

  .toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.65rem 1rem;
    border-radius: 0.9rem;
    background: var(--card-2);
    text-align: left;
  }
  .toggle .label {
    display: flex;
    flex-direction: column;
    font-weight: 600;
    font-size: 0.9rem;
  }
  .toggle small {
    font-weight: 400;
    font-size: 0.72rem;
    color: var(--text-2);
  }
  .switch {
    flex: none;
    width: 2.8rem;
    height: 1.65rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.16);
    position: relative;
    transition: background 0.2s;
  }
  .switch::after {
    content: '';
    position: absolute;
    top: 0.15rem;
    left: 0.15rem;
    width: 1.35rem;
    height: 1.35rem;
    border-radius: 50%;
    background: #fff;
    transition: transform 0.2s var(--ease-out);
  }
  .switch.on {
    background: var(--green);
  }
  .switch.on::after {
    transform: translateX(1.15rem);
  }

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
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap);
  }
  .pill {
    padding: 0.6rem 1.1rem;
    border-radius: 999px;
    background: var(--accent);
    font-weight: 600;
    font-size: 0.9rem;
  }
  .pill.secondary {
    background: var(--card-2);
  }
</style>
