#!/usr/bin/env bash
# An immersive, animated X ad for Pitchwire (no screen recording). Walks the UX
# flow in the signal-room aesthetic: wire open, the problem, a signal arrives,
# the call, on-chain proof, close. Timed reveals + slide-ins + ambient bed.
# 1080x1920, H.264. Works muted; atmospheric when unmuted.
set -euo pipefail

FF="${FFMPEG:-ffmpeg}"
W=1080; H=1920; FPS=30
INK=0x14110E; PAPER=0xEDE6D6; WIRE=0xC6532A; BRASS=0x9A7B4F; VERD=0x3F5E54; FADED=0x8A8375
mkdir -p demo/.fonts demo/.build
cp -f /c/Windows/Fonts/consola.ttf demo/.fonts/mono.ttf
F='demo/.fonts/mono.ttf'
OUT="demo/pitchwire-x.mp4"

# scene <name> <dur> <filter-chain>  -> video-only mp4 with fade in/out
scene() {
  local name="$1" d="$2" chain="$3" fo; fo=$(awk "BEGIN{printf \"%.2f\",$d-0.4}")
  "$FF" -y -hide_banner -loglevel error -f lavfi -i "color=c=${INK}:s=${W}x${H}:r=${FPS}:d=${d}" \
    -filter_complex "[0:v]${chain},fade=t=in:st=0:d=0.4,fade=t=out:st=${fo}:d=0.4[v]" \
    -map "[v]" -c:v libx264 -pix_fmt yuv420p -crf 20 -preset veryfast "demo/.build/$name.mp4"
}

# 1 — wire open
scene s1 4.5 "\
drawtext=fontfile=${F}:text='PITCHWIRE':fontcolor=${PAPER}:fontsize=104:x=(w-text_w)/2:y=800:alpha='(t-0.6)/0.6',\
drawbox=x=(iw-320)/2:y=985:w=320:h=6:color=${WIRE}:t=fill:enable='gt(t,1.3)',\
drawtext=fontfile=${F}:text='the World Cup, read down one wire':fontcolor=${FADED}:fontsize=40:x=(w-text_w)/2:y=1050:alpha='(t-1.7)/0.6'"

# 2 — the problem
scene s2 3.6 "\
drawtext=fontfile=${F}:text='The odds just moved.':fontcolor=${PAPER}:fontsize=62:x=(w-text_w)/2:y=860:alpha='(t-0.4)/0.5',\
drawtext=fontfile=${F}:text='Nobody says why.':fontcolor=${FADED}:fontsize=54:x=(w-text_w)/2:y=970:alpha='(t-1.5)/0.5'"

# 3 — a signal arrives (the hero)
scene s3 6 "\
drawtext=fontfile=${F}:text='ARLINGTON   78'\''   SEQ 4471':fontcolor=${FADED}:fontsize=40:x=(w-text_w)/2:y=720:alpha='(t-0.3)/0.5',\
drawbox=x=(iw-560)/2:y=800:w=560:h=4:color=${BRASS}:t=fill:enable='gt(t,0.7)',\
drawtext=fontfile=${F}:text='Red card, Morocco.':fontcolor=${PAPER}:fontsize=74:x='(w-text_w)/2+(1.5-t)*900*gt(1.5\,t)':y=900:alpha='(t-1.1)/0.5',\
drawtext=fontfile=${F}:text='The market swung to':fontcolor=${PAPER}:fontsize=58:x=(w-text_w)/2:y=1015:alpha='(t-2.0)/0.5',\
drawtext=fontfile=${F}:text='France.':fontcolor=${WIRE}:fontsize=74:x=(w-text_w)/2:y=1095:alpha='(t-2.4)/0.5',\
drawtext=fontfile=${F}:text='one line. as it happens.':fontcolor=${FADED}:fontsize=36:x=(w-text_w)/2:y=1280:alpha='(t-3.4)/0.6'"

# 4 — the call (game)
scene s4 6.5 "\
drawtext=fontfile=${F}:text='Then call the next stat.':fontcolor=${FADED}:fontsize=48:x=(w-text_w)/2:y=560:alpha='(t-0.2)/0.5',\
drawbox=x=130:y=760:w=380:h=150:color=${BRASS}:t=4:enable='gt(t,0.7)',\
drawbox=x=570:y=760:w=380:h=150:color=${BRASS}:t=4:enable='gt(t,0.7)',\
drawtext=fontfile=${F}:text='HIGHER':fontcolor=${WIRE}:fontsize=52:x='320-text_w/2':y=810:alpha='(t-0.9)/0.4',\
drawtext=fontfile=${F}:text='SAME / LOWER':fontcolor=${FADED}:fontsize=38:x='760-text_w/2':y=818:alpha='(t-0.9)/0.4',\
drawbox=x=130:y=760:w=380:h=150:color=${WIRE}:t=fill:enable='gt(t,2.6)',\
drawtext=fontfile=${F}:text='HIGHER':fontcolor=${INK}:fontsize=52:x='320-text_w/2':y=810:enable='gt(t,2.6)',\
drawtext=fontfile=${F}:text='Right. Corners 6 to 7.':fontcolor=${PAPER}:fontsize=52:x=(w-text_w)/2:y=1080:alpha='(t-3.6)/0.5',\
drawtext=fontfile=${F}:text='Streak 3.':fontcolor=${VERD}:fontsize=64:x=(w-text_w)/2:y=1170:alpha='(t-4.2)/0.5',\
drawtext=fontfile=${F}:text='locked to the feed. no clock to race.':fontcolor=${FADED}:fontsize=34:x=(w-text_w)/2:y=1330:alpha='(t-4.9)/0.6'"

# 5 — prove it on-chain
scene s5 5.5 "\
drawtext=fontfile=${F}:text='Then prove it is real.':fontcolor=${FADED}:fontsize=48:x=(w-text_w)/2:y=640:alpha='(t-0.3)/0.5',\
drawtext=fontfile=${F}:text='ON-CHAIN':fontcolor=${PAPER}:fontsize=92:x=(w-text_w)/2:y=760:alpha='(t-1.0)/0.5',\
drawtext=fontfile=${F}:text='verified on Solana':fontcolor=${VERD}:fontsize=56:x=(w-text_w)/2:y=910:alpha='(t-1.8)/0.5',\
drawtext=fontfile=${F}:text='Merkle proof vs the daily root':fontcolor=${FADED}:fontsize=36:x=(w-text_w)/2:y=1010:alpha='(t-2.4)/0.5',\
drawtext=fontfile=${F}:text='read-only. no custody.':fontcolor=${BRASS}:fontsize=36:x=(w-text_w)/2:y=1070:alpha='(t-2.8)/0.5'"

# 6 — close
scene s6 4.6 "\
drawtext=fontfile=${F}:text='No bets. No custody.':fontcolor=${PAPER}:fontsize=58:x=(w-text_w)/2:y=800:alpha='(t-0.3)/0.5',\
drawtext=fontfile=${F}:text='Just the wire.':fontcolor=${WIRE}:fontsize=66:x=(w-text_w)/2:y=890:alpha='(t-0.9)/0.5',\
drawbox=x=(iw-360)/2:y=1015:w=360:h=5:color=${BRASS}:t=fill:enable='gt(t,1.5)',\
drawtext=fontfile=${F}:text='t.me/thePitchwire_bot':fontcolor=${PAPER}:fontsize=48:x=(w-text_w)/2:y=1075:alpha='(t-1.8)/0.5'"

# concat video
"$FF" -y -hide_banner -loglevel error \
  -i demo/.build/s1.mp4 -i demo/.build/s2.mp4 -i demo/.build/s3.mp4 \
  -i demo/.build/s4.mp4 -i demo/.build/s5.mp4 -i demo/.build/s6.mp4 \
  -filter_complex "[0:v][1:v][2:v][3:v][4:v][5:v]concat=n=6:v=1:a=0[v]" -map "[v]" \
  -c:v libx264 -pix_fmt yuv420p -crf 21 -preset veryfast demo/.build/silent.mp4

# add a low ambient room-tone bed (soft, atmospheric)
DUR=$(awk "BEGIN{print 4.5+3.6+6+6.5+5.5+4.6}")
"$FF" -y -hide_banner -loglevel error -i demo/.build/silent.mp4 \
  -f lavfi -i "anoisesrc=color=brown:sample_rate=44100:duration=${DUR}" \
  -filter_complex "[1:a]lowpass=f=170,volume=0.09,afade=t=in:st=0:d=1,afade=t=out:st=$(awk "BEGIN{print $DUR-1}"):d=1[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 160k -movflags +faststart "$OUT"

rm -rf demo/.build demo/.fonts
echo "Done -> $OUT ($(awk "BEGIN{printf \"%.0f\",$DUR}")s)"
