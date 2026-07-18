#!/usr/bin/env bash
# Immersive narrated X ad for Pitchwire. ONE continuous 35s shot: a living
# signal-room background (film grain, vignette, a pulse of light traveling down
# the wire), text that drifts and slides in/out with no black gaps, and the Chris
# VO carrying the story. 1080x1920 H.264.
set -euo pipefail

FF="${FFMPEG:-ffmpeg}"
FP="${FFPROBE:-ffprobe}"
W=1080; H=1920; FPS=30; T=35.2
INK=0x14110E; PAPER=0xEDE6D6; WIRE=0xC6532A; BRASS=0x9A7B4F; VERD=0x3F5E54; FADED=0x8A8375
VOX=demo/vo-x
mkdir -p demo/.fonts demo/.build
cp -f /c/Windows/Fonts/consola.ttf demo/.fonts/mono.ttf
F='demo/.fonts/mono.ttf'
OUT="demo/pitchwire-x.mp4"

# alpha window: fade in over 0.4 at $1, fade out over 0.4 ending at $2
aw(){ printf "min(1\\,max(0\\,(t-%s)/0.4))*min(1\\,max(0\\,(%s-t)/0.4))" "$1" "$2"; }
# drift-in y: starts %3 px below %2, rises to %2 by (%1+0.5)
dy(){ printf "%s+%s*min(1\\,max(0\\,(%s+0.5-t)/0.5))" "$2" "$3" "$1"; }
# slide-in x from the right, settling to centre by (%1+0.9)
sx(){ printf "(w-text_w)/2+max(0\\,(%s+0.9-t))*700" "$1"; }
dt(){ # text color size y alpha-expr [x-expr]
  local xexpr="${6:-(w-text_w)/2}"
  printf "drawtext=fontfile=%s:text='%s':fontcolor=%s:fontsize=%s:x=%s:y=%s:alpha='%s'" "$F" "$1" "$2" "$3" "$xexpr" "$4" "$5"
}

FIL="[0:v]noise=alls=6:allf=t+u,vignette=PI/5"
# living wire + travelling pulse (persistent)
FIL="$FIL,drawbox=x=80:y=300:w=920:h=3:color=${BRASS}@0.35:t=fill"
FIL="$FIL,drawbox=x='mod(t*300\\,1080)':y=294:w=80:h=14:color=${WIRE}:t=fill"
FIL="$FIL,drawtext=fontfile=${F}:text='LIVE':fontcolor=${WIRE}:fontsize=30:x=80:y=236:alpha='0.5+0.4*sin(t*4)'"

# S1
FIL="$FIL,$(dt 'PITCHWIRE'   $PAPER 104 "$(dy 0.5 820 26)" "$(aw 0.5 4.2)")"
FIL="$FIL,$(dt 'the World Cup, read down one wire' $FADED 40 1010 "$(aw 1.7 4.2)")"
# S2
FIL="$FIL,$(dt 'The odds just moved.' $PAPER 62 "$(dy 4.7 870 24)" "$(aw 4.7 8.2)")"
FIL="$FIL,$(dt 'Nobody says why.'     $FADED 54 980 "$(aw 5.7 8.2)")"
# S3 — the signal
FIL="$FIL,$(dt 'ARLINGTON   78   SEQ 4471' $FADED 40 760 "$(aw 8.8 15.4)")"
FIL="$FIL,drawbox=x=(iw-560)/2:y=832:w=560:h=4:color=${BRASS}:t=fill:enable='between(t\\,9.2\\,15.4)'"
FIL="$FIL,$(dt 'Red card, Morocco.' $PAPER 74 920 "$(aw 9.6 15.4)" "$(sx 9.6)")"
FIL="$FIL,$(dt 'The market swung to' $PAPER 58 1035 "$(aw 11.0 15.4)")"
FIL="$FIL,$(dt 'France.' $WIRE 74 "$(dy 11.5 1115 22)" "$(aw 11.5 15.4)")"
# S4 — the call
FIL="$FIL,$(dt 'Call the next stat.' $FADED 48 560 "$(aw 16.3 22.4)")"
FIL="$FIL,drawbox=x=130:y=760:w=380:h=150:color=${BRASS}:t=4:enable='between(t\\,16.8\\,22.4)'"
FIL="$FIL,drawbox=x=570:y=760:w=380:h=150:color=${BRASS}:t=4:enable='between(t\\,16.8\\,22.4)'"
FIL="$FIL,$(dt 'HIGHER' $WIRE 52 810 "$(aw 17.0 22.4)" '320-text_w/2')"
FIL="$FIL,$(dt 'SAME / LOWER' $FADED 38 818 "$(aw 17.0 22.4)" '760-text_w/2')"
FIL="$FIL,drawbox=x=130:y=760:w=380:h=150:color=${WIRE}:t=fill:enable='between(t\\,19.0\\,22.4)'"
FIL="$FIL,drawtext=fontfile=${F}:text='HIGHER':fontcolor=${INK}:fontsize=52:x='320-text_w/2':y=810:enable='between(t\\,19.0\\,22.4)'"
FIL="$FIL,$(dt 'Right. Corners 6 to 7.' $PAPER 52 1080 "$(aw 19.6 22.4)")"
FIL="$FIL,$(dt 'Streak 3.' $VERD 64 "$(dy 20.2 1170 20)" "$(aw 20.2 22.4)")"
# S5 — prove it
FIL="$FIL,$(dt 'Then prove it is real.' $FADED 48 640 "$(aw 23.3 29.5)")"
FIL="$FIL,$(dt 'ON-CHAIN' $PAPER 92 "$(dy 24.3 770 24)" "$(aw 24.3 29.5)")"
FIL="$FIL,$(dt 'verified on Solana' $VERD 56 920 "$(aw 26.0 29.5)")"
FIL="$FIL,$(dt 'checked on-chain. read-only.' $BRASS 36 1025 "$(aw 26.7 29.5)")"
# S6 — close
FIL="$FIL,$(dt 'No bets. No custody.' $PAPER 58 810 "$(aw 30.3 34.8)")"
FIL="$FIL,$(dt 'Just the wire.' $WIRE 66 "$(dy 31.1 900 20)" "$(aw 31.1 34.8)")"
FIL="$FIL,drawbox=x=(iw-360)/2:y=1015:w=360:h=5:color=${BRASS}:t=fill:enable='between(t\\,32.0\\,34.8)'"
FIL="$FIL,$(dt 't.me/thePitchwire_bot' $PAPER 48 1075 "$(aw 32.3 34.8)")"
FIL="$FIL,fade=t=in:st=0:d=0.5,fade=t=out:st=34.5:d=0.6[v]"

echo "Rendering video (this takes a minute)…"
"$FF" -y -hide_banner -loglevel error -f lavfi -i "color=c=${INK}:s=${W}x${H}:r=${FPS}:d=${T}" \
  -filter_complex "$FIL" -map "[v]" -c:v libx264 -pix_fmt yuv420p -crf 20 -preset medium demo/.build/video.mp4

echo "Mixing audio…"
"$FF" -y -hide_banner -loglevel error \
  -i "$VOX/s1.mp3" -i "$VOX/s2.mp3" -i "$VOX/s3.mp3" -i "$VOX/s4.mp3" -i "$VOX/s5.mp3" -i "$VOX/s6.mp3" \
  -f lavfi -i "anoisesrc=color=brown:sample_rate=44100:duration=${T}" \
  -filter_complex "\
[0:a]adelay=600|600[a1];[1:a]adelay=4800|4800[a2];[2:a]adelay=8900|8900[a3];\
[3:a]adelay=16400|16400[a4];[4:a]adelay=23400|23400[a5];[5:a]adelay=30400|30400[a6];\
[6:a]lowpass=f=170,volume=0.05,afade=t=in:st=0:d=1,afade=t=out:st=$(awk "BEGIN{print $T-1}"):d=1[amb];\
[a1][a2][a3][a4][a5][a6][amb]amix=inputs=7:normalize=0:duration=longest[a]" \
  -map "[a]" -ac 2 demo/.build/audio.m4a

"$FF" -y -hide_banner -loglevel error -i demo/.build/video.mp4 -i demo/.build/audio.m4a \
  -map 0:v -map 1:a -c:v copy -c:a aac -b:a 160k -shortest -movflags +faststart "$OUT"

rm -rf demo/.build demo/.fonts
echo "Done -> $OUT"
