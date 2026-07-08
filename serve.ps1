# Light-weight PowerShell Web Server
# Serves local HTML, CSS, JS, and asset files on http://localhost:8000

$port = 8000
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

Write-Host "EduAI Local Web Server started on http://localhost:$port/" -ForegroundColor Green
Write-Host "Press Ctrl+C to terminate the server." -ForegroundColor Yellow

$baseDir = $PSScriptRoot

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $urlPath = $request.RawUrl.Split('?')[0]
        if ($urlPath -eq "/" -or $urlPath -eq "") {
            $urlPath = "/index.html"
        }
        
        $filePath = Join-Path $baseDir $urlPath
        
        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mimeType = switch ($ext) {
                ".html" { "text/html" }
                ".css"  { "text/css" }
                ".js"   { "application/javascript" }
                ".json" { "application/json" }
                ".png"  { "image/png" }
                ".jpg"  { "image/jpeg" }
                ".svg"  { "image/svg+xml" }
                ".webp" { "image/webp" }
                default { "application/octet-stream" }
            }
            
            $response.ContentType = $mimeType
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            Write-Host "Served (200): $urlPath" -ForegroundColor Gray
        } else {
            $response.StatusCode = 404
            $errorMessage = "File not found: $urlPath"
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($errorMessage)
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            Write-Host "Not Found (404): $urlPath" -ForegroundColor Red
        }
        
        $response.Close()
    }
} catch {
    Write-Host "Stopping Web Server..." -ForegroundColor Red
    $listener.Stop()
}
