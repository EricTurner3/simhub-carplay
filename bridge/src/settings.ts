import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { ICON_SCALE_MAX, ICON_SCALE_MIN, type SettingsPatch, type UiConfig } from '@simhub-carplay/shared';

const UNITS: UiConfig['units'][] = ['auto', 'kmh', 'mph'];
const HEX = /^#[0-9a-f]{6}$/i;
const ID = /^[a-z0-9-]{1,32}$/;

/**
 * Applies Settings-app changes to the live `ui` config and writes them back to
 * config.json. Only units and appearance are editable; everything else in the
 * file is left exactly as the user wrote it.
 */
export class SettingsStore {
  constructor(
    private path: string,
    private ui: UiConfig,
  ) {}

  /** Validate and apply a patch. Returns an error message, or null on success. */
  apply(patch: SettingsPatch): string | null {
    const err = validate(patch);
    if (err) return err;

    if (patch.units) this.ui.units = patch.units;
    if (patch.appearance) {
      const { custom, ...rest } = patch.appearance;
      this.ui.appearance = { ...this.ui.appearance, ...rest, custom: { ...this.ui.appearance.custom, ...custom } };
    }
    this.save();
    return null;
  }

  private save(): void {
    // Re-read so hand edits made while the bridge runs survive (only our keys change).
    const file = JSON.parse(readFileSync(this.path, 'utf8'));
    file.ui ??= {};
    file.ui.units = this.ui.units;
    file.ui.appearance = this.ui.appearance;
    // Match the hand-written style: short arrays and small nested objects on one
    // line, a blank line between top-level sections.
    const text =
      JSON.stringify(file, null, 2)
        .replace(/\[\s*([^[\]{}]*?)\s*\]/g, (_, items: string) => `[${items.split(/,\s*/).join(', ')}]`)
        .replace(/(\n {6,}"[^"]+": )\{\s*([^[\]{}]*?)\s*\}/g, (all, key: string, body: string) => {
          const line = `${key}{ ${body.split(/,\s*/).join(', ')} }`;
          return line.length <= 80 ? line : all;
        })
        .replace(/\n  \},\n  "/g, '\n  },\n\n  "') + '\n';
    const tmp = `${this.path}.tmp`;
    writeFileSync(tmp, text);
    renameSync(tmp, this.path);
  }
}

function validate(patch: SettingsPatch): string | null {
  if (typeof patch !== 'object' || patch === null) return 'patch must be an object';
  if (patch.units !== undefined && !UNITS.includes(patch.units)) return `units must be one of ${UNITS.join(', ')}`;
  const a = patch.appearance;
  if (a === undefined) return null;
  if (typeof a !== 'object' || a === null) return 'appearance must be an object';
  if (a.background !== undefined && (typeof a.background !== 'string' || !ID.test(a.background))) return 'bad background id';
  if (a.glass !== undefined && typeof a.glass !== 'boolean') return 'glass must be a boolean';
  if (
    a.iconScale !== undefined &&
    (typeof a.iconScale !== 'number' || !(a.iconScale >= ICON_SCALE_MIN && a.iconScale <= ICON_SCALE_MAX))
  ) {
    return `iconScale must be ${ICON_SCALE_MIN}-${ICON_SCALE_MAX}`;
  }
  const c = a.custom;
  if (c !== undefined) {
    if (typeof c !== 'object' || c === null) return 'custom must be an object';
    if (c.angle !== undefined && (typeof c.angle !== 'number' || !Number.isFinite(c.angle) || c.angle < 0 || c.angle > 360)) {
      return 'custom.angle must be 0-360';
    }
    for (const k of ['from', 'to'] as const) {
      if (c[k] !== undefined && (typeof c[k] !== 'string' || !HEX.test(c[k]))) return `custom.${k} must be #rrggbb`;
    }
  }
  return null;
}
