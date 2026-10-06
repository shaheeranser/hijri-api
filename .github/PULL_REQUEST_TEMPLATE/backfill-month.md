<!--
Use this template when adding a confirmed month start for a month that has already
passed (backfill). The watcher opens its own pull request for the upcoming month;
this template is for everything before that.

Keep one month per pull request where you can. If you add several, repeat the block
below for each.
-->

## Confirmed month start

| Field | Value |
|---|---|
| Hijri 1st (key) | `1446-09-01` |
| Gregorian date it began | `2025-03-01` |
| Source | <https://example.com/news/ramadan-begins> |

Added to `data/hijri/overrides.json`:

```jsonc
"1446-09-01": {
  "date": "2025-03-01",
  "sources": ["https://example.com/news/ramadan-begins"]
}
```

## Before merging

- [ ] The date is the Gregorian day the month **began** (the 1st), not the evening the moon was sighted.
- [ ] At least one **public** source URL is included (news report, government notification, court order).
- [ ] The source refers to the **Central Ruet-e-Hilal Committee**, not a zonal committee or a regional (for example Peshawar) sighting.
- [ ] The Hijri month name matches the key.
- [ ] No existing entry begins on the same Gregorian date; two months cannot start on the same day.
- [ ] I ran `npm run generate`, and the regenerated calendar files are included.

## Notes

<!-- Optional. A delayed announcement, a 30-day month, a regional dispute, or why
     this is the best available source. If this is the most recent month on record,
     note that merging it makes it the watcher's starting point. -->

---

Merging this updates `data/hijri/overrides.json` and triggers regeneration and deployment.
