#!/usr/bin/env bash
# Build a ~30s vertical teaser for X (works muted): hook card, a slice of the real
# Telegram read-outs, an on-chain "verified" proof card, and a close. 1080x2340 H.264.
set -euo pipefail

FF="${FFMPEG:-ffmpeg}"
FP="${FFPROBE:-ffprobe}"
OUT="demo/pitchwire-x.mp4"
W=1080; H=2340; FPS=30
INK=0x14110E; PAPER=0xEDE6D6; WIRE=0xC6532A; BRASS=0x9A7B4F; VERD=0x3F5E54; FADED=0x8A8375
mkdir -p demo/.fonts demo/.build
cp -f /c/Windows/Fonts/consola.ttf demo/.fonts/mono.ttf
F='demo/.fonts/mono.ttf'
C() { echo "(w-text_w)/2"; }

# card <name> <dur> <chain>
card() {
  local name="$1" d="$2" chain="$3" fo; fo=$(awk "BEGIN{printf \"%.2f\",$d-0.4}")
  "$FF" -y -hide_banner -loglevel error \
    -f lavfi -i "color=c=${INK}:s=${W}x${H}:r=${FPS}:d=${d}" \
    -f lavfi -i "anullsrc=r=44100:cl=stereo" \
    -filter_complex "[0:v]${chain},fade=t=in:st=0:d=0.4,fade=t=out:st=${fo}:d=0.4[v]" \
    -map "[v]" -map 1:a -t "$d" -c:v libx264 -pix_fmt yuv420p -crf 20 -preset veryfast -c:a aac "demo/.build/$name.mp4"
}

# 1 — hook
card hook 4 "\
drawtext=fontfile=${F}:text='PITCHWIRE':fontcolor=${PAPER}:fontsize=100:x=$(C):y=980,\
drawbox=x=(iw-300)/2:y=1150:w=300:h=5:color=${WIRE}:t=fill,\
drawtext=fontfile=${F}:text='it reads the World Cup for you':fontcolor=${FADED}:fontsize=40:x=$(C):y=1210"

# 2 — real read-outs slice (keeps the VO; text on screen carries it muted)
"$FF" -y -hide_banner -loglevel error -ss 9 -t 18 -i demo/pitchwire-demo.mp4 \
  -vf "scale=${W}:${H}:flags=lanczos,fps=${FPS}" \
  -c:v libx264 -pix_fmt yuv420p -crf 20 -preset veryfast -c:a aac demo/.build/clip.mp4

# 3 — the on-chain proof card (the hook)
card proof 6 "\
drawtext=fontfile=${F}:text='then it proves the score':fontcolor=${FADED}:fontsize=40:x=$(C):y=860,\
drawtext=fontfile=${F}:text='ON-CHAIN':fontcolor=${PAPER}:fontsize=92:x=$(C):y=930,\
drawtext=fontfile=${F}:text='verified on Solana':fontcolor=${VERD}:fontsize=54:x=$(C):y=1080,\
drawtext=fontfile=${F}:text='Merkle proof vs the daily root':fontcolor=${FADED}:fontsize=36:x=$(C):y=1180,\
drawtext=fontfile=${F}:text='read-only. no custody.':fontcolor=${BRASS}:fontsize=36:x=$(C):y=1240"

# 4 — close
card close 4 "\
drawtext=fontfile=${F}:text='No bets. No custody.':fontcolor=${PAPER}:fontsize=58:x=$(C):y=980,\
drawtext=fontfile=${F}:text='Just the wire.':fontcolor=${WIRE}:fontsize=58:x=$(C):y=1055,\
drawbox=x=(iw-360)/2:y=1180:w=360:h=5:color=${BRASS}:t=fill,\
drawtext=fontfile=${F}:text='t.me/thePitchwire_bot':fontcolor=${PAPER}:fontsize=46:x=$(C):y=1240"

"$FF" -y -hide_banner -loglevel error \
  -i demo/.build/hook.mp4 -i demo/.build/clip.mp4 -i demo/.build/proof.mp4 -i demo/.build/close.mp4 \
  -filter_complex "[0:v][0:a][1:v][1:a][2:v][2:a][3:v][3:a]concat=n=4:v=1:a=1[v][a]" \
  -map "[v]" -map "[a]" -c:v libx264 -pix_fmt yuv420p -crf 21 -preset veryfast -c:a aac -b:a 160k -movflags +faststart "$OUT"

rm -rf demo/.build demo/.fonts
echo "Done -> $OUT"
