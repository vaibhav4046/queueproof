# QueueProof demo video v2 build — the ACTUAL shipped pipeline.
# Two stages:
#   1. Patch the footage: the raw screen capture has a blank white segment at
#      [5.0s, 10.0s) where the Linear/GitHub/Gmail narration beats land, and no
#      connector icons anywhere in 3-10s. This stage splices in a 6.9s icon scene
#      (black background, Slack/Linear/GitHub/Gmail brand icons popping in sync
#      with the narration) over [3.1s, 10.0s) -> video/footage-patched.mp4.
#   2. Final render: patched footage + Mark ElevenLabs VO + burned captions-v2.srt,
#      peak-limited to approximately -15 LUFS / -1.3 dBTP measured.
#
# Inputs this script expects:
#   - video\queueproof-demo-final.mp4            raw 60.67s UI capture (tracked in repo)
#   - video\vo-mark-tight.wav                    processed Mark VO, 59.460s (gitignored;
#                                                derived from the ElevenLabs Mark mp3:
#                                                silence-trimmed + tightened to 59.46s)
#   - video\captions-v2.srt                      24 beats, whisper-aligned to the Mark VO
#   - video\icon-{slack,linear,github,gmail}.png 240x240 transparent brand icons
#                                                (rasterized from react-icons/si paths --
#                                                same icon set the product UI uses)
#   - video\patch-filter.txt                     filter_complex graph for stage 1
#
# QC gates (all must pass before shipping):
#   - duration 59.0-59.8s; measured loudness near -15 LUFS, true peak <= -1.0 dBTP
#   - frame checks at 3.4/5.6/7.3/8.8 (icon beats) AND 16/29/47/53.56/58.5 (UI beats)
#   - whisper transcript of the muxed audio matches the locked script
#   - WATCH THE FULL FILE. Do not ship from a spot check.

$ErrorActionPreference = "Stop"

$footage = "video/queueproof-demo-final.mp4"
$voice   = "video/vo-mark-tight.wav"
$srt     = "video/captions-v2.srt"
$patched = "video/footage-patched.mp4"
$out     = "video/queueproof-demo-v2.mp4"

if (-not (Test-Path $footage)) { Write-Host "Missing footage: $footage"; exit 1 }
if (-not (Test-Path $voice))   { Write-Host "Missing processed VO: $voice (see header)"; exit 1 }
if (-not (Test-Path $srt))     { Write-Host "Missing captions: $srt"; exit 1 }

# ---- Stage 1: splice the icon scene over the blank segment -------------------
# Icon pops at segment-relative 0.12/2.06/3.56/5.18s = timeline 3.22/5.16/6.66/8.28s,
# each aligned to its caption beat start in captions-v2.srt.
ffmpeg -y -i $footage `
  -loop 1 -t 6.9 -i video/icon-slack.png `
  -loop 1 -t 6.9 -i video/icon-linear.png `
  -loop 1 -t 6.9 -i video/icon-github.png `
  -loop 1 -t 6.9 -i video/icon-gmail.png `
  -f lavfi -i "color=c=black:s=1920x1080:r=30:d=6.9" `
  -filter_complex_script video/patch-filter.txt `
  -map "[v]" -an -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p `
  $patched
if ($LASTEXITCODE -ne 0) { Write-Host "stage 1 (icon patch) failed"; exit 1 }

# ---- Stage 2: captions + VO + limiter ---------------------------------------
# Burned captions: phone-readable, bottom-safe margin, subtle box.
$subStyle = "FontSize=15,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H66000000,BorderStyle=3,Outline=1,Shadow=0,MarginV=36,Alignment=2"

# Audio: +2.9 dB gain into a true-peak limiter at -1.5 dBFS ceiling (0.841 linear).
# level=0 is load-bearing: without it alimiter re-normalizes output back up to the
# ceiling, which defeats the headroom. Measured result: -15.0 LUFS / -1.3 dBTP.
$af = "volume=2.9dB,alimiter=limit=0.841:level=0:attack=3:release=80"

# VO is 59.460s; cut at 59.47 so the tagline lands on the end card.
ffmpeg -y -i $patched -i $voice `
  -filter_complex "[0:v]subtitles=$($srt -replace '\\','/'):force_style='$subStyle'[v]" `
  -map "[v]" -map 1:a -af $af `
  -t 59.47 `
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p `
  -c:a aac -b:a 192k -movflags +faststart `
  $out
if ($LASTEXITCODE -ne 0) { Write-Host "stage 2 (final render) failed"; exit 1 }

Write-Host "== QC =="
ffprobe -v error -show_entries format=duration,size -show_entries stream=codec_name,width,height,r_frame_rate -of default=noprint_wrappers=1 $out
ffmpeg -i $out -af "loudnorm=print_format=summary" -f null NUL 2>&1 | Select-String "Input Integrated|Input True Peak"
Write-Host "Target: 59.0-59.8s, h264+aac, 1080p30, ~-15 LUFS. WATCH THE FULL FILE before shipping."
