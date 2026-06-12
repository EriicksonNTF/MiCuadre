import { parse, converter, formatRgb } from 'culori';

const toRgb = converter('rgb');

const pairs = {
  light: {
    'background--foreground':      ['oklch(0.975 0.012 92)', 'oklch(0.16 0.018 248)'],
    'card--card-foreground':       ['oklch(0.998 0.002 100)', 'oklch(0.16 0.018 248)'],
    'muted--muted-foreground':     ['oklch(0.935 0.016 98)', 'oklch(0.49 0.028 248)'],
    'surface--surface-raised':     ['oklch(0.988 0.008 95)', 'oklch(1 0.002 100)'],
    'popover--popover-foreground': ['oklch(0.998 0.002 100)', 'oklch(0.16 0.018 248)'],
    'primary--primary-foreground': ['oklch(0.24 0.035 245)', 'oklch(0.99 0 0)'],
    'destructive--destructive-foreground': ['oklch(0.55 0.22 25)', 'oklch(0.99 0 0)'],
    'gold--gold-foreground':       ['oklch(0.72 0.16 78)', 'oklch(0.22 0.028 248)'],
    'sidebar--sidebar-foreground': ['oklch(0.99 0.004 100)', 'oklch(0.16 0.018 248)'],
  },
  dark: {
    'background--foreground':      ['oklch(0.135 0.018 250)', 'oklch(0.965 0.006 100)'],
    'card--card-foreground':       ['oklch(0.18 0.022 250)', 'oklch(0.985 0 0)'],
    'muted--muted-foreground':     ['oklch(0.235 0.024 250)', 'oklch(0.72 0.025 245)'],
    'surface--surface-raised':     ['oklch(0.145 0.018 250)', 'oklch(0.19 0.023 250)'],
    'popover--popover-foreground': ['oklch(0.19 0.022 250)', 'oklch(0.985 0 0)'],
    'primary--primary-foreground': ['oklch(0.93 0.012 100)', 'oklch(0.18 0.024 250)'],
    'destructive--destructive-foreground': ['oklch(0.396 0.141 25.723)', 'oklch(0.965 0.006 100)'],
    'gold--gold-foreground':       ['oklch(0.76 0.14 78)', 'oklch(0.15 0.018 250)'],
    'sidebar--sidebar-foreground': ['oklch(0.19 0.022 250)', 'oklch(0.985 0 0)'],
  }
};

function luminance(c) {
  const srgb = toRgb(c);
  const [r, g, b] = [srgb.r, srgb.g, srgb.b].map(v => {
    v = Math.max(0, Math.min(1, v));
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(l1, l2) {
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

let allPass = true;
for (const [mode, modePairs] of Object.entries(pairs)) {
  console.log(`\n=== ${mode.toUpperCase()} ===`);
  for (const [name, [c1, c2]] of Object.entries(modePairs)) {
    const col1 = parse(c1);
    const col2 = parse(c2);
    const l1 = luminance(col1);
    const l2 = luminance(col2);
    const cr = contrast(l1, l2);
    const passAAA = cr >= 7;
    const passAA  = cr >= 4.5;
    const passLarge = cr >= 3;
    const status = passAAA ? '✅ AAA' : passAA ? '✅ AA' : passLarge ? '⚠️ AA-large' : '❌ FAIL';
    if (!passAA) allPass = false;
    console.log(`  ${name}: ${cr.toFixed(2)}:1  ${status}`);
  }
}

console.log(`\n\n${allPass ? '✅ All pairs pass AA (4.5:1)' : '❌ Some pairs fail AA'}`);
