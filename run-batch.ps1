param(
    [Parameter(Mandatory=$true)]
    [string]$WorkDir,

    [Parameter(Mandatory=$false)]
    [int]$TotalEpisodes = 0,

    [Parameter(Mandatory=$true)]
    [int]$NewEpisodes,

    [Parameter(Mandatory=$false)]
    [string]$StoryInput
)

# Change to work directory
if (-not (Test-Path $WorkDir)) {
    Write-Host "Error: WorkDir '$WorkDir' does not exist." -ForegroundColor Red
    exit 1
}
Set-Location $WorkDir

function Get-EpisodeCount {
    $dirs = Get-ChildItem -Path "story/episodes" -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^ep\d+$' }
    return ($dirs | Measure-Object).Count
}

function Build-Prompt {
    param([bool]$IsFirstRound)

    $parts = @()
    $arcExists = Test-Path "story/arc.md"

    # total episodes only when no arc and TotalEpisodes is specified
    if (-not $arcExists -and $TotalEpisodes -gt 0) {
        $parts += "$TotalEpisodes"
    }

    # story input only on first round
    if ($IsFirstRound -and $StoryInput) {
        $parts += $StoryInput
    }

    $args_str = ($parts -join " ").Trim()

    if ($args_str) {
        return "Read SKILL.md and follow its workflow. Arguments: $args_str. Use full-auto mode."
    } else {
        return "Read SKILL.md and follow its workflow. No arguments. Use full-auto mode."
    }
}

# --- Main ---

$startCount = Get-EpisodeCount
$generated = 0

Write-Host "=== ShortVideoDirector Batch Run ===" -ForegroundColor Cyan
Write-Host "Work directory: $WorkDir"
if ($TotalEpisodes -gt 0) {
    Write-Host "Total episodes target: $TotalEpisodes"
} else {
    Write-Host "Total episodes target: (none)"
}
Write-Host "New episodes to generate: $NewEpisodes"
Write-Host "Starting episode count: $startCount"
if ($StoryInput) { Write-Host "Story input: $StoryInput" }
Write-Host "Close terminal to stop."
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

while ($true) {
    $currentCount = Get-EpisodeCount

    # Exit condition 1: new episodes target reached
    $generated = $currentCount - $startCount
    if ($generated -ge $NewEpisodes) {
        Write-Host ""
        Write-Host "=== Done: generated $generated new episodes (target: $NewEpisodes) ===" -ForegroundColor Green
        break
    }

    # Exit condition 2: total episodes target reached (only when specified)
    if ($TotalEpisodes -gt 0 -and $currentCount -ge $TotalEpisodes) {
        Write-Host ""
        Write-Host "=== Done: reached $currentCount total episodes (target: $TotalEpisodes) ===" -ForegroundColor Green
        break
    }

    $isFirstRound = ($generated -eq 0)
    $prompt = Build-Prompt -IsFirstRound $isFirstRound
    $nextEp = $currentCount + 1

    Write-Host "--- Round $($generated + 1)/$NewEpisodes | Generating EP$('{0:D2}' -f $nextEp) ---" -ForegroundColor Yellow
    Write-Host ""

    claude -p $prompt --output-format stream-json --verbose --include-partial-messages --allowedTools "Read,Write,Edit,Glob,Bash(*),Agent" | jq -j '.event.delta.text? // empty'

    Write-Host ""

    # Auto commit and push after each episode
    $epLabel = "EP$('{0:D2}' -f $nextEp)"
    Write-Host "--- Pushing $epLabel to GitHub ---" -ForegroundColor Cyan
    git add -A
    git commit -m "$($epLabel): auto-generated"
    git push
    Write-Host ""
}

$finalCount = Get-EpisodeCount
Write-Host "Final episode count: $finalCount (started at $startCount, generated $($finalCount - $startCount))" -ForegroundColor Cyan
