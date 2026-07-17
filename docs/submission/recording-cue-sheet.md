# Recording cue sheet

Record to this and the VO lines up by construction. Total target length: ~1:50.
Each row is a VO clip. Keep the listed thing on screen for that whole window.

Mute all notifications. Bump Telegram font size. Clean chat. No original audio needed
(the VO becomes the soundtrack).

| Window | VO clip | Length | What to show on screen |
|---|---|---|---|
| 0:00 – 0:10 | 01-hook | 10s | Landing page hero ("The match and the market, read down one wire"), or a plain phone scoreboard. Sets up the problem. |
| 0:11 – 0:20 | 02-what | 10s | The bot: `/start` greeting, then tap "See what's live" / `/matches`. |
| **0:21 – 0:52** | **03-live** | **31s** | **The money shot.** The Telegram chat as read-outs arrive: a goal, then the **red card** read-out ("England reduced to ten men…"). Let the dateline + SEQ number be visible. Scroll slowly. |
| 0:54 – 1:13 | 04-game | 19s | The game settling in the chat: "Right. Corners went 6 → 7. Streak 3." Show a couple settle, streak climbing. |
| 1:14 – 1:32 | 05-tech | 18s | Proof it's live TxLINE: the Render logs (`SSE scores stream connected`, `liveData:true`) or the seq/ts telemetry on a card. |
| 1:33 – 1:45 | 06-close | 11s | Landing page CTA + the bot link `t.me/thePitchwire_bot`. |

## The 03-live window (0:21–0:52) is the one that wins or loses it

That is 31 seconds. You need the chat showing real read-outs landing. Two ways to fill it:

- **Live-arrival:** tell me "go", I re-fire the replay, you hit record as the messages land one by one. Most dynamic.
- **Static scroll:** the read-outs are already in your Telegram; scroll through them slowly for 31s.

## After recording

Drop your file at `demo/raw.mp4` (the `demo/` folder is gitignored, so it never commits).
Then either:

- If you followed the timings above, I run the mux as-is.
- If your timings drifted, just tell me the real start time of each clip and I plug those in.

I run `demo/mux.sh` → out comes `demo/pitchwire-demo.mp4` → you upload to YouTube (unlisted)
→ delete the `demo/` files.
