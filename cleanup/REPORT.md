# Cleanup Report — 2026-06-25

## Summary
- **Branch:** `cleanup/remove-junk-files`
- **Estimated space recovered:** ~16.6 MB
- **Files moved to backup:** 15 files (dev logs, mockups, assets, renders)
- **Duplicate SVGs removed:** 25 files (bank logos with numbered suffixes)
- **tsconfig.tsbuildinfo:** Removed from git index (already gitignored)

## What was moved to `cleanup/backups/`
| File | Reason |
|------|--------|
| `dev-server.log` | Dev artifact, 0 bytes |
| `dev-server-err.log` | Dev artifact, 0 bytes |
| `public/Mockup 3D/Mockup 3D Dashboard.png` | Unreferenced mockup |
| `public/Mockup 3D/Mockup 3D Transaccion.png` | Unreferenced mockup |
| `public/landing/mockup-dashboard-3d.png` | Unreferenced landing mockup |
| `public/landing/mockup-metas-3d.png` | Unreferenced landing mockup |
| `public/landing/mockup-transaccion-3d.png` | Unreferenced landing mockup |
| `docs/Referencia diseño.png` | Unreferenced design reference |
| `assets/icon.png` | Capacitor asset (Capacitor removed) |
| `assets/splash.png` | Capacitor asset (Capacitor removed) |
| `compositions/renders/*.mp4` (2) | HyperFrames render outputs |
| `landing-redesign.html` | Standalone experimental HTML |

## What was deleted directly
- 25 duplicate bank logo SVGs with numbered suffixes (2.svg, 3.svg, 4.svg...).
  Canonical copies preserved in `public/bank-logos/collection-data/`.

## What remains untouched
- `scripts/*.mjs`, `scripts/*.sql`
- `.agents/skills/`
- `compositions/index.html` and `compositions/assets/app-shots/*.png`
- `docs/*.md` (documentation)
- `next.user-config.mjs`

## Git history note
Large files in `Videos/` and `.next 2/` remain in git history (~23 MB).
Consider `git filter-repo` in the future if repo bloat becomes an issue.
