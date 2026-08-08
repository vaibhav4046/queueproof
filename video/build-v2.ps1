# QueueProof demo video v2 build.
# Composes: existing verified footage + ElevenLabs VO + burned captions, normalized to -14 LUFS.
# Requires ffmpeg + ffprobe on PATH. Run from repo root: powershell -File video\build-v2.ps1
#
# IMPORTANT before final render:
#   1. Verify caption timings against the actual VO: the SRT times are word-count estimates.
#      Play video\queueproof-demo-v2.mp4 and nudge any beat in video\captions.srt that drifts.
#   2. Watch the FULL rendered file. Do not ship from a spot check.
#   3. Connector icon overlays (Slack 3.6s / Linear 5.4s / GitHub 6.9s / Gmail 8.6s /
#      GitHub 30.4s / Linear 32.4s) are already present in the source footage's UI capture;
#      add drawbox/overlay passes only if a beat lacks its icon on screen.

$ErrorActionPreference = "Stop"

$footage = "D:\movies\queueproof-demo-final.mp4"
$voice   = Get-ChildItem "D:\movies\ElevenLabs_2026-08-07*Liam*.mp3" | Select-Object -First 1
$srt     = "video/captions.srt"
$out     = "video/queueproof-demo-v2.mp4"

if (-not (Test-Path $footage)) { Write-Host "Missing footage: $footage"; exit 1 }
if ($null -eq $voice) { Write-Host "Missing ElevenLabs VO mp3 in D:\movies"; exit 1 }
Write-Host "Footage: $footage"
Write-Host "Voice:   $($voice.FullName)"

# VO is 59.402s; footage is 60.67s. Cut video to VO length so the tagline lands on the end card.
$duration = "59.40"

# Burned captions: phone-readable, bottom-safe margin, subtle box. Arial fallback is fine on Windows.
$subStyle = "FontSize=15,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H66000000,BorderStyle=3,Outline=1,Shadow=0,MarginV=36,Alignment=2"

# Single-pass loudnorm to -14 LUFS / -1.5 dBTP (platform-safe). For broadcast-exact two-pass,
# run once with -af loudnorm=print_format=json, then feed measured_* values back in.
$af = "loudnorm=I=-14:TP=-1.5:LRA=11"

ffmpeg -y -i $footage -i $voice.FullName `
  -filter_complex "[0:v]subtitles=$($srt -replace '\\','/'):force_style='$subStyle'[v]" `
  -map "[v]" -map 1:a -af $af `
  -t $duration `
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p `
  -c:a aac -b:a 192k -movflags +faststart `
  $out
if ($LASTEXITCODE -ne 0) { Write-Host "ffmpeg render failed"; exit 1 }

Write-Host "== QC =="
ffprobe -v error -show_entries format=duration,size -show_entries stream=codec_name,width,height,r_frame_rate -of default=noprint_wrappers=1 $out
Write-Host "Target: 59.0-59.8s, h264+aac, 1080p-class. WATCH THE FULL FILE before shipping."
