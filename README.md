# WOE Party Organizer

Single-file HTML tool for organizing WoE (War of Emperium) parties and post-WoE auctions.

## Features

- **League** — 16 parties × 5 slots, drag-drop, map markers, save/restore
- **Overrun** — 4 big parties × 4 sub-parties on a single map
- **Members** — Job-count summary, target tracking
- **Auction GL** — Post-WoE loot split 70/30 (main/sub field) with bonus rate
- **Auction Overrun** — Per-column drag-drop with auction page numbering

## Data Source

Loads member list from a Google Sheet (set in Settings).
The sheet must be shared as **Anyone with link – Viewer**.

## State

All state is per-browser via `localStorage` — every visitor has their own
assignments. The deployed copy is read-only; this tool is single-user per
device.

## License

Private guild tool — not for redistribution.
