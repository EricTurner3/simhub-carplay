/**
 * Presentation for known control ids (the profile decides which exist and how
 * they're wired). Unknown ids still work: they get a generic icon in "Other".
 */
export interface ControlLook {
  glyph: string;
  /** Fill colour when on. */
  color: string;
  group: string;
}

export const GROUPS = ['Lights', 'Signals', 'Driving', 'Truck', 'Other'];

export const LOOKS: Record<string, ControlLook> = {
  lights: {
    group: 'Lights',
    color: '#30d158',
    glyph: '<path d="M11 6C6.5 6 4 8.7 4 12s2.5 6 7 6c1.4 0 2-1.6 2-6s-.6-6-2-6z"/><path d="M16 9l4 1.2M16 12.5l4 1.2M16 16l4 1.2"/>',
  },
  highBeam: {
    group: 'Lights',
    color: '#0a84ff',
    glyph: '<path d="M11 6C6.5 6 4 8.7 4 12s2.5 6 7 6c1.4 0 2-1.6 2-6s-.6-6-2-6z"/><path d="M16 8h4.5M16 12h4.5M16 16h4.5"/>',
  },
  hazards: {
    group: 'Lights',
    color: '#ff453a',
    glyph: '<path d="M12 3.5 21 19.5H3z"/><path d="M12 9.5l3.6 6.5H8.4z"/>',
  },
  beacon: {
    group: 'Lights',
    color: '#ff9f0a',
    glyph: '<path d="M6.5 19h11M8 19v-5a4 4 0 0 1 8 0v5"/><path d="M12 3v2.5M4.5 6.5l1.8 1.8M19.5 6.5l-1.8 1.8"/>',
  },
  blinkerLeft: {
    group: 'Signals',
    color: '#30d158',
    glyph: '<path d="M11 5 4 12l7 7v-4h9V9h-9z"/>',
  },
  blinkerRight: {
    group: 'Signals',
    color: '#30d158',
    glyph: '<path d="M13 5l7 7-7 7v-4H4V9h9z"/>',
  },
  parkingBrake: {
    group: 'Driving',
    color: '#ff453a',
    glyph: '<circle cx="12" cy="12" r="6"/><path d="M10.5 15.5v-7h2.2a2 2 0 0 1 0 4h-2.2"/><path d="M4.2 7a9.5 9.5 0 0 0 0 10M19.8 7a9.5 9.5 0 0 1 0 10"/>',
  },
  cruise: {
    group: 'Driving',
    color: '#30d158',
    glyph: '<path d="M4.5 17a7.5 7.5 0 1 1 15 0"/><path d="M12 17l3.8-4.8"/><circle cx="12" cy="17" r="1"/>',
  },
  diffLock: {
    group: 'Driving',
    color: '#ff9f0a',
    glyph: '<rect x="6.5" y="6.5" width="11" height="11" rx="2.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/>',
  },
  liftAxle: {
    group: 'Driving',
    color: '#64d2ff',
    glyph: '<circle cx="7" cy="17" r="2.5"/><circle cx="17" cy="17" r="2.5"/><path d="M3 12h10M17 12.5V5M14.5 7.5 17 5l2.5 2.5"/>',
  },
  electric: {
    group: 'Truck',
    color: '#ffd60a',
    glyph: '<circle cx="8" cy="12" r="3.5"/><path d="M11.5 12H20.5M17.5 12v3M20.5 12v2.5"/>',
  },
  engine: {
    group: 'Truck',
    color: '#30d158',
    glyph: '<path d="M12 3.5v7.5"/><path d="M7.2 6.5a7.5 7.5 0 1 0 9.6 0"/>',
  },
  wipers: {
    group: 'Truck',
    color: '#64d2ff',
    glyph: '<path d="M3.5 18.5a10 10 0 0 1 17 0"/><path d="M12 18.5 7 8.5"/>',
  },
  horn: {
    group: 'Truck',
    color: '#bf5af2',
    glyph: '<path d="M4 10v4h3l6 4.5v-13L7 10z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/>',
  },
};

export const GENERIC: ControlLook = {
  group: 'Other',
  color: '#0a84ff',
  glyph: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/>',
};

/** How long to wait for the game to report the new state before calling it a miss. */
export const CONFIRM_MS = 1500;
