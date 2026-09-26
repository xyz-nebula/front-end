# Frontend performance

Production bundle size is checked after `npm run build`:

```bash
npm run bundle:report
```

The budgets in `scripts/performance-budgets.json` fail CI when the compiled
application regresses. They intentionally measure raw and gzip sizes from the
actual `dist` output without requiring a new runtime dependency.

The production-preview smoke test uses the installed Chrome and a repeatable
mobile network/CPU profile. It records landing transfer and LCP, and rejects
accidental eager downloads of arena/result assets:

```bash
npm run performance:smoke
```

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

## Optimized measurements (2026-09-27)

| Metric | Optimized | Change from baseline |
| --- | ---: | ---: |
| Entire `dist` | 2,259,634 bytes (2,206.7 KiB) | -61.4% |
| Images | 1,628,287 bytes (1,590.1 KiB) | -68.2% |
| JavaScript | 463,509 bytes (452.6 KiB) | -15.5% |
| CSS | 167,130 bytes (163.2 KiB) | -9.8% |
| Largest JavaScript chunk | 308,115 bytes (300.9 KiB) | -43.7% |
| JavaScript gzip | 140.8 KiB | -12.0% |
| CSS gzip | 36.9 KiB | route chunks add a small compression overhead |

The repeatable landing smoke profile (390×844, 1.6 Mbps down, 150 ms RTT and
4× CPU slowdown) transfers 429,667 bytes in 10 requests. Three consecutive
optimized runs recorded LCP between 2,328 and 3,008 ms. Runtime and bundle
budgets are set to the measured maximum plus 10%.

The same profile reconstructed from baseline commit `1450a99` transferred
596,440 bytes and recorded a 3,648 ms LCP. The optimized landing therefore
reduced first-load transfer by 28.0% and the comparable LCP run by 17.5%.
