#!/usr/bin/env bash
# Immersive, NARRATED X ad for Pitchwire (no screen recording). The Chris VO
# drives the pacing; animated signal-room visuals reinforce; a continuous room
# tone sits underneath. Walks the UX flow: wire open, the problem, a signal
# arrives, the call, on-chain proof, close. 1080x1920 H.264.
set -euo pipefail

FF="${FFMPEG:-ffmpeg}"
FP="${FFPROBE:-ffprobe}"
W=1080; H=1920; FPS=30
INK=0x14110E; PAPER=0xEDE6D6; WIRE=0xC6532A; BRASS=0x9A7B4F; VERD=0x3F5E54; FADED=0x8A8375
VO=demo/vo-x
PAD=0.9   # 0.3s lead-in before the VO + 0.6s tail
mkdir -p demo/.fonts demo/.build
cp -f /c/Windows/Fonts/consola.ttf demo/.fonts/mono.ttf
F='demo/.fonts/mono.ttf'
OUT="demo/pitchwire-x.mp4"

dur() { "$FP" -v error -show_entries format=duration -of default=nk=1:nw=1 "$1"; }

# scene <name> <chain> : duration = its VO length + PAD; VO delayed 0.3s
scene() {
  local name="$1" chain="$2" vod d fo
  vod=$(dur "$VO/$name.mp3"); d=$(awk "BEGIN{printf \"%.2f\",$vod+$PAD}"); fo=$(awk "BEGIN{printf \"%.2f\",$d-0.4}")
  "$FF" -y -hide_banner -loglevel error \
    -f lavfi -i "color=c=${INK}:s=${W}x${H}:r=${FPS}:d=${d}" -i "$VO/$name.mp3" \
    -filter_complex "[0:v]${chain},fade=t=in:st=0:d=0.4,fade=t=out:st=${fo}:d=0.4[v];\
[1:a]adelay=300|300,apad[a]" \
    -map "[v]" -map "[a]" -t "$d" -c:v libx264 -pix_fmt yuv420p -crf 20 -preset veryfast -c:a aac "demo/.build/$name.mp4"
  echo "$d"
}

scene s1 "\
drawtext=fontfile=${F}:text='PITCHWIRE':fontcolor=${PAPER}:fontsize=104:x=(w-text_w)/2:y=800:alpha='(t-0.6)/0.6',\
drawbox=x=(iw-320)/2:y=985:w=320:h=6:color=${WIRE}:t=fill:enable='gt(t,1.3)',\
drawtext=fontfile=${F}:text='the World Cup, read down one wire':fontcolor=${FADED}:fontsize=40:x=(w-text_w)/2:y=1050:alpha='(t-1.7)/0.6'" >/dev/null

scene s2 "\
drawtext=fontfile=${F}:text='The odds just moved.':fontcolor=${PAPER}:fontsize=62:x=(w-text_w)/2:y=860:alpha='(t-0.4)/0.5',\
drawtext=fontfile=${F}:text='Nobody says why.':fontcolor=${FADED}:fontsize=54:x=(w-text_w)/2:y=970:alpha='(t-1.6)/0.5'" >/dev/null

scene s3 "\
drawtext=fontfile=${F}:text='ARLINGTON   78'\''   SEQ 4471':fontcolor=${FADED}:fontsize=40:x=(w-text_w)/2:y=720:alpha='(t-0.5)/0.5',\
drawbox=x=(iw-560)/2:y=800:w=560:h=4:color=${BRASS}:t=fill:enable='gt(t,1.0)',\
drawtext=fontfile=${F}:text='Red card, Morocco.':fontcolor=${PAPER}:fontsize=74:x='(w-text_w)/2+(2.4-t)*900*gt(2.4\,t)':y=900:alpha='(t-2.0)/0.5',\
drawtext=fontfile=${F}:text='The market swung to':fontcolor=${PAPER}:fontsize=58:x=(w-text_w)/2:y=1015:alpha='(t-3.4)/0.5',\
drawtext=fontfile=${F}:text='France.':fontcolor=${WIRE}:fontsize=74:x=(w-text_w)/2:y=1095:alpha='(t-3.9)/0.5'" >/dev/null

scene s4 "\
drawtext=fontfile=${F}:text='Call the next stat.':fontcolor=${FADED}:fontsize=48:x=(w-text_w)/2:y=560:alpha='(t-0.3)/0.5',\
drawbox=x=130:y=760:w=380:h=150:color=${BRASS}:t=4:enable='gt(t,0.9)',\
drawbox=x=570:y=760:w=380:h=150:color=${BRASS}:t=4:enable='gt(t,0.9)',\
drawtext=fontfile=${F}:text='HIGHER':fontcolor=${WIRE}:fontsize=52:x='320-text_w/2':y=810:alpha='(t-1.1)/0.4',\
drawtext=fontfile=${F}:text='SAME / LOWER':fontcolor=${FADED}:fontsize=38:x='760-text_w/2':y=818:alpha='(t-1.1)/0.4',\
drawbox=x=130:y=760:w=380:h=150:color=${WIRE}:t=fill:enable='gt(t,3.0)',\
drawtext=fontfile=${F}:text='HIGHER':fontcolor=${INK}:fontsize=52:x='320-text_w/2':y=810:enable='gt(t,3.0)',\
drawtext=fontfile=${F}:text='Right. Corners 6 to 7.':fontcolor=${PAPER}:fontsize=52:x=(w-text_w)/2:y=1080:alpha='(t-3.8)/0.5',\
drawtext=fontfile=${F}:text='Streak 3.':fontcolor=${VERD}:fontsize=64:x=(w-text_w)/2:y=1170:alpha='(t-4.3)/0.5'" >/dev/null

scene s5 "\
drawtext=fontfile=${F}:text='Then prove it is real.':fontcolor=${FADED}:fontsize=48:x=(w-text_w)/2:y=640:alpha='(t-0.4)/0.5',\
drawtext=fontfile=${F}:text='ON-CHAIN':fontcolor=${PAPER}:fontsize=92:x=(w-text_w)/2:y=760:alpha='(t-1.4)/0.5',\
drawtext=fontfile=${F}:text='verified on Solana':fontcolor=${VERD}:fontsize=56:x=(w-text_w)/2:y=910:alpha='(t-3.0)/0.5',\
drawtext=fontfile=${F}:text='checked on-chain. read-only.':fontcolor=${BRASS}:fontsize=36:x=(w-text_w)/2:y=1015:alpha='(t-3.6)/0.5'" >/dev/null

scene s6 "\
drawtext=fontfile=${F}:text='No bets. No custody.':fontcolor=${PAPER}:fontsize=58:x=(w-text_w)/2:y=800:alpha='(t-0.4)/0.5',\
drawtext=fontfile=${F}:text='Just the wire.':fontcolor=${WIRE}:fontsize=66:x=(w-text_w)/2:y=890:alpha='(t-1.2)/0.5',\
drawbox=x=(iw-360)/2:y=1015:w=360:h=5:color=${BRASS}:t=fill:enable='gt(t,2.4)',\
drawtext=fontfile=${F}:text='t.me/thePitchwire_bot':fontcolor=${PAPER}:fontsize=48:x=(w-text_w)/2:y=1075:alpha='(t-2.7)/0.5'" >/dev/null

# concat (video + VO audio)
"$FF" -y -hide_banner -loglevel error \
  -i demo/.build/s1.mp4 -i demo/.build/s2.mp4 -i demo/.build/s3.mp4 \
  -i demo/.build/s4.mp4 -i demo/.build/s5.mp4 -i demo/.build/s6.mp4 \
  -filter_complex "[0:v][0:a][1:v][1:a][2:v][2:a][3:v][3:a][4:v][4:a][5:v][5:a]concat=n=6:v=1:a=1[v][a]" \
  -map "[v]" -map "[a]" -c:v libx264 -pix_fmt yuv420p -crf 21 -preset veryfast -c:a aac demo/.build/narrated.mp4

TOTAL=$(dur demo/.build/narrated.mp4)
# continuous room tone under the whole thing (no clicks at cuts)
"$FF" -y -hide_banner -loglevel error -i demo/.build/narrated.mp4 \
  -f lavfi -i "anoisesrc=color=brown:sample_rate=44100:duration=${TOTAL}" \
  -filter_complex "[1:a]lowpass=f=170,volume=0.05,afade=t=in:st=0:d=1,afade=t=out:st=$(awk "BEGIN{print $TOTAL-1}"):d=1[amb];[0:a][amb]amix=inputs=2:normalize=0:duration=first[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 160k -movflags +faststart "$OUT"

rm -rf demo/.build demo/.fonts
echo "Done -> $OUT (${TOTAL}s)"
