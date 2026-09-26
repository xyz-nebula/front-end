# Frontend performance

Production bundle size is checked after `npm run build`:

```bash
npm run bundle:report
```

The budgets in `scripts/performance-budgets.json` fail CI when the compiled
application regresses. They intentionally measure raw and gzip sizes from the
actual `dist` output without requiring a new runtime dependency.

## Baseline (2026-09-27)

| Metric | Size |
| --- | ---: |
| Entire `dist` | 5,855,143 bytes (5,717.9 KiB) |
| Images | 5,120,893 bytes (5,000.9 KiB) |
| JavaScript | 548,219 bytes (535.4 KiB) |
| CSS | 185,323 bytes (181.0 KiB) |
| Largest JavaScript chunk | 546,777 bytes (533.9 KiB) |
| JavaScript gzip (Vite report) | 165.54 KiB |
| CSS gzip (Vite report) | 35.26 KiB |

The initial budgets are the baseline plus 10% and will be tightened to the
optimized production measurements after the performance work is complete.
