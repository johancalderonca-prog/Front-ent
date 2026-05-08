$prefix = "http://localhost:3000/"
$root = (Get-Location).Path
$null = Add-Type -AssemblyName System.Net.Http
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Output "Serving $root at $prefix. Press Ctrl+C in the terminal to stop."

$backendBase = "http://localhost:9090"

function Send-ProxyRequest {
    param(
        [System.Net.HttpListenerRequest] $Request,
        [System.Net.HttpListenerResponse] $Response
    )

    $backendUrl = $backendBase + $Request.Url.AbsolutePath + $Request.Url.Query
    $body = $null

    if ($Request.HasEntityBody) {
        $reader = New-Object System.IO.StreamReader($Request.InputStream, $Request.ContentEncoding)
        $body = $reader.ReadToEnd()
        $reader.Close()
    }

    $headers = @{}
    if ($Request.AcceptTypes) {
        $headers["Accept"] = ($Request.AcceptTypes -join ", ")
    }

    try {
        $invokeParams = @{
            Uri = $backendUrl
            Method = $Request.HttpMethod
            Headers = $headers
            UseBasicParsing = $true
            ErrorAction = 'Stop'
        }

        if ($body) {
            $invokeParams["Body"] = $body
            $invokeParams["ContentType"] = if ($Request.ContentType) { $Request.ContentType } else { "application/json" }
        }

        $proxyResponse = Invoke-WebRequest @invokeParams
        $Response.StatusCode = [int]$proxyResponse.StatusCode
        $Response.ContentType = if ($proxyResponse.Headers["Content-Type"]) { $proxyResponse.Headers["Content-Type"] } else { "application/json; charset=utf-8" }

        $bytes = [System.Text.Encoding]::UTF8.GetBytes($proxyResponse.Content)
        $Response.ContentLength64 = $bytes.Length
        $Response.OutputStream.Write($bytes, 0, $bytes.Length)
        $Response.Close()
        return
    } catch {
        $errorResponse = $_.Exception.Response
        if ($errorResponse) {
            $Response.StatusCode = [int]$errorResponse.StatusCode
            $stream = $errorResponse.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $errorBody = $reader.ReadToEnd()
            $reader.Close()

            if (-not $errorBody) {
                $errorBody = "{}"
            }

            $Response.ContentType = "application/json; charset=utf-8"
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($errorBody)
            $Response.ContentLength64 = $bytes.Length
            $Response.OutputStream.Write($bytes, 0, $bytes.Length)
            $Response.Close()
            return
        }

        throw
    }
}

while ($listener.IsListening) {
    $context = $listener.GetContext()
    try {
        $req = $context.Request
        $res = $context.Response
        $absolutePath = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)
        $urlPath = $absolutePath.TrimStart('/')

        if ($absolutePath -match '^/(health|api(/|$))') {
            Send-ProxyRequest -Request $req -Response $res
            continue
        }

        if ($urlPath -eq "") { $urlPath = "index.html" }
        $filePath = Join-Path $root $urlPath
        if (-not (Test-Path $filePath)) {
            $res.StatusCode = 404
            $buffer = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
            $res.ContentLength64 = $buffer.Length
            $res.OutputStream.Write($buffer, 0, $buffer.Length)
            $res.Close()
            continue
        }
        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
        switch ($ext) {
            ".html" { $mime = "text/html" }
            ".htm"  { $mime = "text/html" }
            ".css"  { $mime = "text/css" }
            ".js"   { $mime = "application/javascript" }
            ".png"  { $mime = "image/png" }
            ".jpg"  { $mime = "image/jpeg" }
            ".jpeg" { $mime = "image/jpeg" }
            ".gif"  { $mime = "image/gif" }
            ".svg"  { $mime = "image/svg+xml" }
            ".json" { $mime = "application/json" }
            default  { $mime = "application/octet-stream" }
        }
        $res.ContentType = $mime
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
        $res.Close()
    } catch {
        try {
            $context.Response.StatusCode = 500
            $err = [System.Text.Encoding]::UTF8.GetBytes("500 Internal Server Error")
            $context.Response.ContentLength64 = $err.Length
            $context.Response.OutputStream.Write($err, 0, $err.Length)
            $context.Response.Close()
        } catch { }
    }
}
$listener.Stop()
$listener.Close()
