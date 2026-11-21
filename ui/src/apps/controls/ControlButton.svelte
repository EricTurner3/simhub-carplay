<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { ControlInfo } from '@simhub-carplay/shared';
  import { useApp } from '../../lib/context.ts';
  import { isOn } from '../../lib/format.ts';
  import { CONFIRM_MS, GENERIC, LOOKS } from './catalog.ts';

  /**
   * Toggle or momentary control. A toggle sends one tap and then shows whatever
   * the game reports back; if the state doesn't change in time it says so,
   * which is usually a missing SimHub mapping.
   */
  let { control, disabled = false }: { control: ControlInfo; disabled?: boolean } = $props();
  const { telemetry: t } = useApp();

  const look = $derived(LOOKS[control.id] ?? GENERIC);
  const on = $derived(control.state ? isOn(t.slow[control.state] ?? null) : false);

  let pending = $state(false);
  let note = $state(''); // transient message under the label
  let held = $state(false);
  let before = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let noteTimer: ReturnType<typeof setTimeout> | undefined;

  function flash(text: string) {
    note = text;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => (note = ''), 1800);
  }

  // The game confirmed the change.
  $effect(() => {
    if (pending && on !== before) {
      pending = false;
      clearTimeout(timer);
    }
  });

  function tap() {
    if (disabled) return;
    if (!t.sendControl(control.id, 'tap')) return flash('Not connected');
    if (!control.state) return flash('Sent');
    before = on;
    pending = true;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (!pending) return;
      pending = false;
      flash('No response');
    }, CONFIRM_MS);
  }

  // Momentary controls (horn): held while the finger is down. Knob/keyboard "ok" = a tap.
  function down(e: PointerEvent) {
    if (control.kind !== 'momentary' || disabled) return;
    e.preventDefault();
    held = true;
    t.sendControl(control.id, 'press');
    window.addEventListener('pointerup', up, { once: true });
    window.addEventListener('pointercancel', up, { once: true });
  }
  function up() {
    if (!held) return;
    held = false;
    t.sendControl(control.id, 'release');
  }
  function click(e: MouseEvent) {
    if (control.kind === 'momentary' && e.detail !== 0) return; // pointer already handled it
    tap();
  }

  onDestroy(() => {
    up();
    clearTimeout(timer);
    clearTimeout(noteTimer);
  });

  const stateText = $derived(
    note ||
      (pending ? '…' : control.kind === 'momentary' ? (held ? 'Active' : 'Hold') : control.state ? (on ? 'On' : 'Off') : 'Tap'),
  );
</script>

<button
  class="ctl"
  class:on={on || held}
  class:pending
  class:miss={note === 'No response'}
  data-nav
  {disabled}
  style:--on={look.color}
  onpointerdown={down}
  onclick={click}
  aria-pressed={control.kind === 'toggle' ? on : undefined}
  aria-label={control.label ?? control.id}
>
  <span class="icon">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      {@html look.glyph}
    </svg>
  </span>
  <span class="label">{control.label ?? control.id}</span>
  <span class="state">{stateText}</span>
</button>

<style>
  .ctl {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.35rem;
    padding: 0.75rem 0.85rem;
    border-radius: 1rem;
    background: var(--card-2);
    text-align: left;
    transition: background 0.2s, transform 0.12s var(--ease-out);
    touch-action: none;
    min-height: 6.4rem;
  }
  .ctl:active {
    transform: scale(0.96);
  }
  .ctl:disabled {
    opacity: 0.4;
  }
  .icon {
    width: 2.4rem;
    height: 2.4rem;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: #3a3a41;
    color: var(--text);
    transition: background 0.2s, color 0.2s;
  }
  .icon svg {
    width: 1.4rem;
  }
  .on .icon {
    background: var(--on);
    color: #000;
  }
  .on {
    box-shadow: inset 0 0 0 2px var(--on);
  }
  .label {
    font-size: 0.85rem;
    font-weight: 650;
  }
  .state {
    font-size: 0.75rem;
    color: var(--text-2);
  }
  .on .state {
    color: var(--text);
  }
  .pending .icon {
    animation: pulse 0.8s ease-in-out infinite;
  }
  .miss .state {
    color: var(--amber);
  }
  @keyframes pulse {
    50% {
      opacity: 0.45;
    }
  }
</style>
