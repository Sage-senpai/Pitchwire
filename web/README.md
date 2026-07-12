# Pitchwire — design surfaces

Everything here derives from the "signal room" tokens in `docs/05-design.md`:
`--ink #14110E`, `--paper #EDE6D6`, `--wire #C6532A` (the single accent),
`--brass #9A7B4F`, `--verdigris #3F5E54` (confirmed/correct only), `--faded #8A8375`.
No gradient anywhere; the amber does all the emphasis.

## Files

- **`assets/avatar.svg`** — the bot mark (512×512). Flat, two-colour, legible small.
  Telegram's `/setuserpic` needs a raster image, so export to PNG first:
  ```bash
  # with rsvg-convert, or open in any editor and export at 512×512
  rsvg-convert -w 512 -h 512 assets/avatar.svg -o assets/avatar.png
  ```
- **`assets/wordmark.svg`** — the teletype wordmark for the README / landing header.
- **`assets/wire-card.svg`** — the signature "wire card" (1200×630): dateline → signal →
  telemetry. The single most screenshot-able artifact — use it in the demo and as the
  social preview image.
- **`index.html`** — the one-page landing site for the submission link. Self-contained
  (inline CSS, system mono/sans, no external requests), mobile-responsive.

## Before submitting

1. Deploy `index.html` anywhere static (Railway, Netlify, GitHub Pages) — this is the
   judge-facing link.
2. Replace the demo `.video` block with your `<iframe>` embed (16:9), recorded during a
   live match.
3. Update the Telegram handle in the two `t.me/PitchwireBot` links to your real bot.
4. Set the bot profile in BotFather: name, description, about, commands, and the avatar
   PNG (see `docs/04-bot-setup.md`).
