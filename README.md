# WOE Party Organizer

Single-file HTML tool for organizing WoE (War of Emperium) parties and
post-WoE auctions. Used by a single Ragnarok Online guild.

## Pages

- **League** — 16 parties × 5 slots over main + sub maps, drag-drop,
  map markers, save/restore
- **Overrun** — 5 color groups (Red/Yellow/Green/Blue + พิเศษ) over 16 shared parties on a single map
- **Roster** — member table (name, job, CP, Discord) with per-row edits
- **Summary** — job counts vs. targets
- **Auction GL** — post-WoE loot split 70/30 (main/sub field); item counts
  are entered as final totals
- **Auction Overrun** — per-column drag-drop with auction page numbering
- **Leave** — scheduled-leave registration, auto-resets every Monday
  00:00 Asia/Bangkok

## Data source

All shared state lives in **Firebase Realtime Database** (project
`woe-party`, region `asia-southeast1`). The `app.html` is the only
client — sign-in is via Google for admins, anonymous for viewers.

- Admin allowlist: `ADMIN_EMAILS` near the top of the Firebase block in
  `app.html`. Editors must be on that list.
- Anonymous viewers see live state but can't write.
- `localStorage` (`roo_party_v2`) is a local cache for offline reloads.

## Deploy

Static — copy `app.html` and the `maps/` folder to any static host
(GitHub Pages, etc.). No build step.

## Documentation for contributors

- `CLAUDE.md` — coding conventions, key constants, page list
- `knowledge.md` — architecture, state shape, sync model, pitfalls
- `.claude/skills/woe-edit/SKILL.md` — editing playbook
- `.claude/agents/woe-coder.md` — focused coding subagent

## License

Private guild tool — not for redistribution.
