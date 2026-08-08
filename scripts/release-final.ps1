# QueueProof final release gate — run from repo root.
# Runs tests, build, commit, push, then polls production until the new SHA is live.
# Stops at the first failure; never force-pushes.

$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "== 1/6 git status =="
git status --short
$dirty = (git status --short | Measure-Object -Line).Lines
Write-Host "Modified files: $dirty"

Write-Host "== 2/6 pnpm test =="
pnpm test
if ($LASTEXITCODE -ne 0) { Write-Host "TESTS FAILED — stopping. Fix before release."; exit 1 }

Write-Host "== 3/6 pnpm build =="
pnpm build
if ($LASTEXITCODE -ne 0) { Write-Host "BUILD FAILED — stopping."; exit 1 }

Write-Host "== 4/6 commit =="
git add -A
git commit -m @'
fix: auth view reconcile, friendly HydraDB errors, modal consistency, plugin inline MCP config

- reconcile authenticated view after sign-in (viewAuthenticatedRef effect)
- structured HydraDB error extraction + FRIENDLY_HYDRA_ERRORS map with errorCode
- normalize all modal close buttons (44x44 target, aria-labels, X size 16)
- suppress composer orange focus ring; focus-within card ring instead
- Claude plugin: inline queueproof-demo MCP server (was dangling gitignored .mcp.json ref)
- docs: plugin install path, final campaign status
'@
if ($LASTEXITCODE -ne 0) { Write-Host "COMMIT FAILED (nothing staged or hook rejected) — stopping."; exit 1 }

Write-Host "== 5/6 push =="
git push origin main
if ($LASTEXITCODE -ne 0) { Write-Host "PUSH FAILED — stopping. Do NOT force push."; exit 1 }

$sha = (git rev-parse HEAD).Trim()
Write-Host "Pushed $sha"

Write-Host "== 6/6 poll production for new SHA (up to 10 min) =="
$deadline = (Get-Date).AddMinutes(10)
$live = $false
while ((Get-Date) -lt $deadline) {
    try {
        $resp = Invoke-RestMethod -Uri "https://queueproof.vercel.app/api/health/live" -TimeoutSec 15
        $liveSha = $resp.sha
        if (-not $liveSha) { $liveSha = $resp.commit }
        if (-not $liveSha) { $liveSha = $resp.release }
        Write-Host ("live: " + ($resp | ConvertTo-Json -Compress -Depth 3))
        if ($liveSha -and $sha.StartsWith($liveSha.Substring(0, [Math]::Min(7, $liveSha.Length)))) { $live = $true; break }
        if ($liveSha -eq $sha) { $live = $true; break }
    } catch { Write-Host "health poll failed: $($_.Exception.Message)" }
    Start-Sleep -Seconds 30
}

if ($live) {
    Write-Host "RELEASE VERIFIED: production serves $sha"
    exit 0
} else {
    Write-Host "NOT VERIFIED: production has not reported $sha within 10 min. Check Vercel dashboard."
    exit 2
}
