$r = Invoke-WebRequest "http://localhost:8000/app.js" -UseBasicParsing
Write-Host "Status:" $r.StatusCode
Write-Host "Size:" $r.Content.Length "bytes"
Write-Host "First 120 chars:" $r.Content.Substring(0, 120)
