param()
$BASE_URL = "http://localhost:8080"
$FRONTEND_URL = "http://localhost:8000"
$PASS = 0
$FAIL = 0
$RESULTS = @()

function Invoke-Test {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET",
        [string]$Body = $null,
        [int]$ExpectedStatus = 200,
        [string]$Token = $null
    )
    try {
        $hdrs = @{}
        if ($Token) { $hdrs["Authorization"] = "Bearer $Token" }
        $params = @{
            Uri = $Url
            Method = $Method
            Headers = $hdrs
            UseBasicParsing = $true
            ErrorAction = "Stop"
        }
        if ($Body) {
            $params["Body"] = $Body
            $params["ContentType"] = "application/json"
        }
        $resp = Invoke-WebRequest @params
        $ok = ($resp.StatusCode -eq $ExpectedStatus)
        return [PSCustomObject]@{ Name=$Name; Status=$resp.StatusCode; Pass=$ok; Content=$resp.Content; Err="" }
    } catch {
        $sc = 0
        if ($_.Exception.Response) { $sc = [int]$_.Exception.Response.StatusCode }
        $ok = ($sc -eq $ExpectedStatus)
        return [PSCustomObject]@{ Name=$Name; Status=$sc; Pass=$ok; Content=""; Err=$_.Exception.Message }
    }
}

function Show-Result {
    param($r)
    if ($r.Pass) {
        Write-Host "  [PASS] $($r.Name)  (HTTP $($r.Status))" -ForegroundColor Green
        $script:PASS++
    } else {
        Write-Host "  [FAIL] $($r.Name)  (HTTP $($r.Status))" -ForegroundColor Red
        if ($r.Err) { Write-Host "         Error: $($r.Err)" -ForegroundColor DarkRed }
        $script:FAIL++
    }
    $script:RESULTS += $r
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   EduAI Project - Full Test Suite" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# ── FRONTEND TESTS ────────────────────────────────────────────────
Write-Host ""
Write-Host "-- 1. Frontend Tests --" -ForegroundColor Yellow
Show-Result (Invoke-Test "index.html loads" "$FRONTEND_URL/" -ExpectedStatus 200)
Show-Result (Invoke-Test "styles.css loads" "$FRONTEND_URL/styles.css" -ExpectedStatus 200)
Show-Result (Invoke-Test "dashboard.html loads" "$FRONTEND_URL/dashboard.html" -ExpectedStatus 200)
Show-Result (Invoke-Test "404 for missing file" "$FRONTEND_URL/doesnotexist.html" -ExpectedStatus 404)

# ── BACKEND HEALTH ────────────────────────────────────────────────
Write-Host ""
Write-Host "-- 2. Backend Health --" -ForegroundColor Yellow
Show-Result (Invoke-Test "H2 Console accessible" "$BASE_URL/h2-console" -ExpectedStatus 200)

# ── AUTH TESTS ────────────────────────────────────────────────────
Write-Host ""
Write-Host "-- 3. Authentication Tests --" -ForegroundColor Yellow

$loginBody = '{"username":"student","password":"student123"}'
$loginResult = Invoke-Test "Login with valid credentials" "$BASE_URL/api/auth/login" -Method "POST" -Body $loginBody -ExpectedStatus 200
Show-Result $loginResult

$TOKEN = $null
if ($loginResult.Pass -and $loginResult.Content) {
    try {
        $parsed = $loginResult.Content | ConvertFrom-Json
        $TOKEN = $parsed.token
        if ($TOKEN) {
            Write-Host "         JWT token acquired (${TOKEN.Length} chars)" -ForegroundColor Gray
        }
    } catch {
        Write-Host "         Could not parse token from response" -ForegroundColor DarkYellow
    }
}

$badBody = '{"username":"student","password":"WRONGPASSWORD"}'
$badResult = Invoke-Test "Login with wrong password (expect 401)" "$BASE_URL/api/auth/login" -Method "POST" -Body $badBody -ExpectedStatus 401
Show-Result $badResult

$rand = Get-Random -Maximum 9999
$regBody = "{`"username`":`"testuser$rand`",`"password`":`"Test@1234`",`"email`":`"test$rand@example.com`"}"
Show-Result (Invoke-Test "Register new user" "$BASE_URL/api/auth/register" -Method "POST" -Body $regBody -ExpectedStatus 200)

# ── PROTECTED ENDPOINT TESTS ──────────────────────────────────────
Write-Host ""
Write-Host "-- 4. Protected API Tests --" -ForegroundColor Yellow

if ($TOKEN) {
    # Notes
    Show-Result (Invoke-Test "GET /api/note/list" "$BASE_URL/api/note/list" -Token $TOKEN -ExpectedStatus 200)
    $noteBody = '{"title":"Test Note","content":"Created by automated test suite."}'
    $noteResult = Invoke-Test "POST /api/note/create" "$BASE_URL/api/note/create" -Method "POST" -Body $noteBody -Token $TOKEN -ExpectedStatus 200
    Show-Result $noteResult
    if ($noteResult.Pass -and $noteResult.Content) {
        $createdNote = $noteResult.Content | ConvertFrom-Json
        if ($createdNote.id) {
            Show-Result (Invoke-Test "DELETE /api/note/delete/$($createdNote.id)" "$BASE_URL/api/note/delete/$($createdNote.id)" -Method "DELETE" -Token $TOKEN -ExpectedStatus 200)
        }
    }

    # Chat
    Show-Result (Invoke-Test "GET /api/chat/list" "$BASE_URL/api/chat/list" -Token $TOKEN -ExpectedStatus 200)
    $chatCreateResult = Invoke-Test "POST /api/chat/create" "$BASE_URL/api/chat/create?title=TestSession" -Method "POST" -Token $TOKEN -ExpectedStatus 200
    Show-Result $chatCreateResult
    $chatId = $null
    if ($chatCreateResult.Pass -and $chatCreateResult.Content) {
        $createdChat = $chatCreateResult.Content | ConvertFrom-Json
        $chatId = $createdChat.id
    }
    if ($chatId) {
        Show-Result (Invoke-Test "POST /api/chat/message (send AI message)" "$BASE_URL/api/chat/message?chatId=$chatId" -Method "POST" -Body '"What is machine learning?"' -Token $TOKEN -ExpectedStatus 200)
    }

    # Quiz
    Show-Result (Invoke-Test "POST /api/quiz/generate" "$BASE_URL/api/quiz/generate?subject=Science&topic=Python&difficulty=easy&count=3&timeLimit=10" -Method "POST" -Token $TOKEN -ExpectedStatus 200)
    Show-Result (Invoke-Test "GET /api/quiz/results" "$BASE_URL/api/quiz/results" -Token $TOKEN -ExpectedStatus 200)

} else {
    Write-Host "  [SKIP] No token obtained - skipping protected endpoint tests" -ForegroundColor DarkYellow
}

# ── SECURITY TESTS ────────────────────────────────────────────────
Write-Host ""
Write-Host "-- 5. Security Tests --" -ForegroundColor Yellow

$noToken = Invoke-Test "No token returns 401/403" "$BASE_URL/api/note/list" -ExpectedStatus 401
if (-not $noToken.Pass) { $noToken = Invoke-Test "No token returns 403" "$BASE_URL/api/note/list" -ExpectedStatus 403 }
Show-Result $noToken

$badToken = Invoke-Test "Invalid token returns 401/403" "$BASE_URL/api/note/list" -Token "garbage.token.value" -ExpectedStatus 401
if (-not $badToken.Pass) { $badToken = Invoke-Test "Invalid token returns 403" "$BASE_URL/api/note/list" -Token "garbage.token.value" -ExpectedStatus 403 }
Show-Result $badToken

# ── SUMMARY ───────────────────────────────────────────────────────
$TOTAL = $PASS + $FAIL
$pct = if ($TOTAL -gt 0) { [Math]::Round(($PASS / $TOTAL) * 100) } else { 0 }
$colour = if ($pct -ge 90) { "Green" } elseif ($pct -ge 70) { "Yellow" } else { "Red" }

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "   TEST RESULTS SUMMARY" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Total Tests : $TOTAL" -ForegroundColor White
Write-Host "  PASSED      : $PASS" -ForegroundColor Green
Write-Host "  FAILED      : $FAIL" -ForegroundColor $(if ($FAIL -gt 0) {"Red"} else {"Green"})
Write-Host "  Pass Rate   : $pct%" -ForegroundColor $colour
Write-Host "============================================" -ForegroundColor Cyan

$failures = $RESULTS | Where-Object { -not $_.Pass }
if ($failures) {
    Write-Host ""
    Write-Host "-- Failed Tests Detail --" -ForegroundColor Red
    foreach ($f in $failures) {
        Write-Host "  [FAIL] $($f.Name)  HTTP $($f.Status)" -ForegroundColor Red
        if ($f.Err) { Write-Host "         $($f.Err)" -ForegroundColor DarkRed }
    }
}
Write-Host ""
