# scripts/verify.ps1
param(
    [switch]$Full
)

$ErrorActionPreference = "Stop"
$sw = [System.Diagnostics.Stopwatch]::StartNew()

function Invoke-VerifyStep {
    param(
        [string]$Name,
        [scriptblock]$Action
    )
    Write-Host "`n>>> [VERIFY] $Name" -ForegroundColor Cyan
    try {
        & $Action
        if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) {
            throw "Step '$Name' failed with exit code $LASTEXITCODE"
        }
        Write-Host "    ✓ $Name passed" -ForegroundColor Green
    } catch {
        Write-Host "    ✗ $Name FAILED: $_" -ForegroundColor Red
        exit 1
    }
}

Write-Host "=== SUBSMARKET 3.0 VERIFICATION SUITE ===" -ForegroundColor Magenta

# 1. Backend Lint
Invoke-VerifyStep -Name "Backend Lint (ruff)" -Action {
    node scripts/run-python.mjs -m ruff check backend/src backend/alembic backend/tests
}

# 2. Backend Compilation
Invoke-VerifyStep -Name "Backend Compilation (compileall)" -Action {
    node scripts/run-python.mjs -m compileall -q backend/src backend/tests
}

# 3. Check Error Labels
Invoke-VerifyStep -Name "Check Error Labels" -Action {
    node scripts/check-error-labels.mjs
}

# 4. Frontend Typecheck & Build
Invoke-VerifyStep -Name "Frontend Build and Typecheck" -Action {
    npm --prefix frontend run build
}

# 5. Git Diff Formatting / Whitespace check
Invoke-VerifyStep -Name "Git Diff Hygiene" -Action {
    git diff --check
}

# 6. Optional Full Mode (Tests)
if ($Full) {
    Invoke-VerifyStep -Name "Backend Pytest" -Action {
        node scripts/run-python.mjs -m pytest backend/tests
    }
    Invoke-VerifyStep -Name "Cloudflare Scheduler Check" -Action {
        npm --prefix ops/cloudflare-jobs-scheduler run check
    }
}

$sw.Stop()
$elapsed = [Math]::Round($sw.Elapsed.TotalSeconds, 2)
Write-Host "`n=== ✓ ALL VERIFY CHECKS PASSED in ${elapsed}s ===" -ForegroundColor Green
exit 0
