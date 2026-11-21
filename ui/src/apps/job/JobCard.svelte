<script lang="ts">
  import { useApp } from '../../lib/context.ts';
  import { fmtDistance, fmtDuration, fmtGameClock, fmtText, num } from '../../lib/format.ts';

  /** Split-view widget: where am I going and how long is left. */
  const { telemetry: t, units, view } = useApp();
  const v = t.slow;
  const remainingMin = $derived(num(v['job.remainingMinutes']));
</script>

<button class="card job" data-nav onclick={() => view.open('job')} aria-label="Current job">
  <div class="head">
    <span class="title">Delivery</span>
    <span class="cargo">{fmtText(v['job.cargo'])}</span>
  </div>
  <div class="dest">
    <span class="city">{fmtText(v['job.destinationCity'])}</span>
    <span class="company">{fmtText(v['job.destinationCompany'])}</span>
  </div>
  <div class="stats tabular">
    <div><b>{fmtDistance(v['nav.distanceM'], units())}</b><span>left</span></div>
    <div><b>{fmtDuration(v['nav.timeSec'])}</b><span>drive</span></div>
    <div class:late={remainingMin !== null && remainingMin < 0}>
      <b>{fmtGameClock(v['job.deadlineMinutes']).split(' ')[1] ?? '—'}</b><span>due</span>
    </div>
  </div>
</button>

<style>
  .job {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 0.75rem 0.95rem 0.85rem;
    text-align: left;
    background: linear-gradient(160deg, #2a241d, var(--card));
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.5rem;
  }
  .title {
    font-size: 0.95rem;
    font-weight: 700;
  }
  .cargo {
    color: var(--text-2);
    font-size: 0.8rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dest {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .city {
    font-size: 1.6rem;
    font-weight: 700;
    line-height: 1.15;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .company {
    color: var(--text-2);
    font-size: 0.85rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .stats {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .stats div {
    display: flex;
    flex-direction: column;
  }
  .stats b {
    font-size: 1rem;
    font-weight: 650;
  }
  .stats span {
    color: var(--text-3);
    font-size: 0.7rem;
  }
  .late b {
    color: var(--red);
  }
</style>
