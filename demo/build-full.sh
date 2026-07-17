#!/usr/bin/env bash
# Build the full ~1:48 demo: 4 signal-room title cards (ffmpeg drawtext) bookending
# the real Telegram clip, each carrying its VO. Portrait 1080x2340, H.264.
set -euo pipefail

FF="${FFMPEG:-ffmpeg}"                 # pass a full ffmpeg via FFMPEG=...
FP="${FFPROBE:-ffprobe}"
VO="demo/vo"
OUT="demo/pitchwire-full.mp4"
W=1080; H=2340; FPS=30
INK=0x14110E; PAPER=0xEDE6D6; WIRE=0xC6532A; BRASS=0x9A7B4F; VERD=0x3F5E54; FADED=0x8A8375
# ffmpeg/freetype can't open a Windows "C:/..." fontfile (the drive-letter colon
# breaks the filter parser and it silently falls back to a serif). So copy the
# mono font to a colon-free relative path and reference that.
mkdir -p demo/.fonts
cp -f /c/Windows/Fonts/consola.ttf demo/.fonts/mono.ttf
REG='demo/.fonts/mono.ttf'
BLD="$REG"

dur() { "$FP" -v error -show_entries format=duration -of default=nk=1:nw=1 "$1"; }
tmp() { mkdir -p demo/.build; echo "demo/.build/$1"; }

# render_card <name> <voclip.mp3> <drawtext-chain>
render_card() {
  local name="$1" vo="$2" chain="$3"
  local d fo out
  d=$(dur "$vo"); fo=$(awk "BEGIN{printf \"%.2f\", $d-0.4}")
  out=$(tmp "$name.mp4")
  "$FF" -y -hide_banner -loglevel error \
    -f lavfi -i "color=c=${INK}:s=${W}x${H}:r=${FPS}:d=${d}" -i "$vo" \
    -filter_complex "[0:v]${chain},fade=t=in:st=0:d=0.4,fade=t=out:st=${fo}:d=0.4[v]" \
    -map "[v]" -map 1:a -c:v libx264 -pix_fmt yuv420p -crf 20 -preset veryfast \
    -c:a aac -b:a 128k -shortest "$out"
  echo "$out"
}

C() { echo "(w-text_w)/2"; } # centered x

# 01 hook — the wordmark title card
c1=$(render_card 01-hook "$VO/01-hook.mp3" "\
drawtext=fontfile=${BLD}:text='PITCHWIRE':fontcolor=${PAPER}:fontsize=104:x=$(C):y=980,\
drawbox=x=(iw-300)/2:y=1150:w=300:h=5:color=${WIRE}:t=fill,\
drawtext=fontfile=${REG}:text='the live World Cup wire':fontcolor=${FADED}:fontsize=42:x=$(C):y=1210")

# 02 what
c2=$(render_card 02-what "$VO/02-what.mp3" "\
drawtext=fontfile=${BLD}:text='Reads the match.':fontcolor=${PAPER}:fontsize=76:x=$(C):y=960,\
drawtext=fontfile=${BLD}:text='Reads the market.':fontcolor=${WIRE}:fontsize=76:x=$(C):y=1075,\
drawtext=fontfile=${REG}:text='One clear line when it changes.':fontcolor=${FADED}:fontsize=40:x=$(C):y=1230")

# 05 tech
c5=$(render_card 05-tech "$VO/05-tech.mp3" "\
drawtext=fontfile=${REG}:text='LIVE TxLINE DATA':fontcolor=${BRASS}:fontsize=46:x=$(C):y=900,\
drawtext=fontfile=${BLD}:text='Server-sent events':fontcolor=${PAPER}:fontsize=66:x=$(C):y=990,\
drawtext=fontfile=${REG}:text='Solana devnet, guest auth':fontcolor=${FADED}:fontsize=40:x=$(C):y=1120,\
drawtext=fontfile=${REG}:text='seq and ts on every read':fontcolor=${VERD}:fontsize=46:x=$(C):y=1210")

# 06 close
c6=$(render_card 06-close "$VO/06-close.mp3" "\
drawtext=fontfile=${BLD}:text='Reads and explains.':fontcolor=${PAPER}:fontsize=68:x=$(C):y=940,\
drawtext=fontfile=${REG}:text='No funds. No bets.':fontcolor=${FADED}:fontsize=46:x=$(C):y=1060,\
drawbox=x=(iw-300)/2:y=1180:w=300:h=5:color=${WIRE}:t=fill,\
drawtext=fontfile=${BLD}:text='t.me/thePitchwire_bot':fontcolor=${WIRE}:fontsize=52:x=$(C):y=1240")

# telegram clip -> scale to canvas, keep its VO
live=$(tmp live.mp4)
echo "Scaling Telegram clip..."
"$FF" -y -hide_banner -loglevel error -i demo/pitchwire-demo.mp4 \
  -vf "scale=${W}:${H}:flags=lanczos,fps=${FPS}" \
  -c:v libx264 -pix_fmt yuv420p -crf 20 -preset veryfast -c:a aac -b:a 128k "$live"

# concat: hook, what, live(03+04), tech, close
echo "Concatenating..."
"$FF" -y -hide_banner -loglevel error \
  -i "$c1" -i "$c2" -i "$live" -i "$c5" -i "$c6" \
  -filter_complex "[0:v][0:a][1:v][1:a][2:v][2:a][3:v][3:a][4:v][4:a]concat=n=5:v=1:a=1[v][a]" \
  -map "[v]" -map "[a]" -c:v libx264 -pix_fmt yuv420p -crf 21 -preset veryfast \
  -c:a aac -b:a 160k -movflags +faststart "$OUT"

rm -rf demo/.build
echo "Done -> $OUT"
