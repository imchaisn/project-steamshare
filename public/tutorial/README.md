# /tutorial screenshots

Drop real Steam-client / Windows screenshots here using the exact filenames
below. The `/tutorial` page auto-detects each file at runtime (no code
change, no rebuild needed in dev — a redeploy picks it up in prod) and
swaps the placeholder box for the real image the instant it exists.

| Filename | Step | Caption | Status |
|---|---|---|---|
| `steam-download-install.png` | 1 | Steam's official download page / installer | ✅ placed |
| `steam-open-add-account.png` | 2 | Steam login screen — click + to add an account | ✅ placed |
| `steam-login-screen.png` | 2 | Enter the provided username and password | ✅ placed |
| `gameshare-code.png` | 2 | gameshare.space — enter Order ID + username, click Get Code | ✅ placed |
| `steam-guard-code-entry.png` | 2 | Enter the Steam Guard code from the lookup page | ✅ placed |
| `library-find-game.png` | 3 | Find the game in your Steam Library | ✅ placed |
| `library-install-progress.png` | 3 | Confirm install location and start the download | ✅ placed |
| `steam-settings-cloud-tab.png` | 4 | Steam Settings → Cloud | ⬜ pending |
| `cloud-toggle-off.png` | 4 | Turn off the Enable Steam Cloud toggle | ✅ placed |
| `cloud-status-disappeared.png` | 4 | ✅ Cloud Status is gone — safe to play | ✅ placed |
| `cloud-status-still-exists.png` | 4 | ❌ Cloud Status still showing — repeat steps 1–2 | ✅ placed |
| `this-device-confirm.png` | 5 | Confirm launching on This device | ✅ placed |
| `steam-menu-open.png` | 6 | 1. Click the Steam menu (top-left) | ✅ placed |
| `steam-menu-go-offline.png` | 6 | 2. Then click Go Offline… | ✅ placed |
| `offline-indicator-confirmed.png` | 6 | ✅ Offline Mode confirmed — safe to launch | ⚠️ placed, flagged — shows Counter-Strike 2 / a different account, not gscal1/DAVE THE DIVER like every other shot. Works (shows the offline banner) but breaks continuity and has no highlight box. Confirm intentional or swap. |
| `offline-indicator-still-online.png` | 6 | ❌ Still online — repeat step, don't launch yet | ⚠️ placed, same flag as above |
| `play-game.png` | 6 (closing) | Final note — "you're ready to play" | ✅ placed |

17 images total (down from 21 — 2026-09-03: `install-device-dropdown`,
`steam-play-button`, `alt-f4-exit-confirm` dropped to text-only per
Chaison's request; `library-locked-error` also dropped, with a remark on
the page that a screenshot per Troubleshooting scenario is coming later).
Same filenames are the `filename` prop passed to each `<TutorialImage>` in
`app/tutorial/page.tsx`. **16/17 placed** — only `steam-settings-cloud-tab.png`
still missing. 2 of the 16 (the offline-indicator pair) are flagged above,
not confirmed clean.
