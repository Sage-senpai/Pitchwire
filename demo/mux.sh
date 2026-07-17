#!/usr/bin/env bash
# Mux the 6 VO clips onto a screen recording at fixed offsets, no re-encode of video.
#
#   bash demo/mux.sh [raw_video] [output]
#
# Defaults: demo/raw.mp4 -> demo/pitchwire-demo.mp4
# Offsets (ms) come from the recording cue sheet. Edit OFFSETS if your timings drift.
set -euo pipefail

RAW="${1:-demo/raw.mp4}"
OUT="${2:-demo/pitchwire-demo.mp4}"
VO="demo/vo"

# ffmpeg from the Remotion bundle (a full ffmpeg 7.1 build).
FF="/c/Users/USER/works/elfgents/videos/remotion/node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe"
[ -x "$FF" ] || FF="ffmpeg" # fall back to PATH if the bundle moved

# clip -> start offset in ms (matches docs/submission/recording-cue-sheet.md)
declare -a CLIPS=(01-hook 02-what 03-live 04-game 05-tech 06-close)
declare -a OFFMS=(0       11000   21000   54000   74000   93000)

[ -f "$RAW" ] || { echo "Missing $RAW — drop your screen recording there first."; exit 1; }

# Build inputs + filter graph
inputs=(-i "$RAW")
filter=""
labels=""
idx=1
for i in "${!CLIPS[@]}"; do
  f="$VO/${CLIPS[$i]}.mp3"
  [ -f "$f" ] || { echo "Missing $f"; exit 1; }
  inputs+=(-i "$f")
  ms="${OFFMS[$i]}"
  filter+="[${idx}:a]adelay=${ms}|${ms}[a${idx}];"
  labels+="[a${idx}]"
  idx=$((idx+1))
done
filter+="${labels}amix=inputs=${#CLIPS[@]}:normalize=0[aout]"

echo "Muxing ${#CLIPS[@]} VO clips onto $RAW ..."
"$FF" -y -hide_banner -loglevel error \
  "${inputs[@]}" \
  -filter_complex "$filter" \
  -map 0:v -map "[aout]" \
  -c:v copy -c:a aac -b:a 192k \
  "$OUT"

echo "Done -> $OUT"
