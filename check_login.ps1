$body = '{"username":"student","password":"student123"}'
$resp = Invoke-WebRequest -Uri "http://localhost:8080/api/auth/login" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
Write-Host "Status:" $resp.StatusCode
Write-Host "Content:" $resp.Content
$parsed = $resp.Content | ConvertFrom-Json
Write-Host "Token field:" $parsed.token
Write-Host "All fields:" ($parsed | Get-Member -MemberType NoteProperty).Name
