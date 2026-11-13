param(
  [Parameter(Mandatory = $false)] [string] $ServerUrl = '',
  [Parameter(Mandatory = $false)] [string] $AgentToken = '',
  [Parameter(Mandatory = $false)] [int] $IntervalSeconds = 0,
  [Parameter(Mandatory = $false)] [string] $LogFile = ''
)

$ErrorActionPreference = 'SilentlyContinue'
$cfg = @{}
$pending = $null

# 1. Prioritas konfigurasi: Argumen CLI > agent-config.json > Environment Variable
$ConfigFile = Join-Path $PSScriptRoot 'agent-config.json'
if (Test-Path $ConfigFile) {
  try {
    $cfg = Get-Content $ConfigFile -Raw | ConvertFrom-Json
    if (-not $ServerUrl -and $cfg.ServerUrl) { $ServerUrl = $cfg.ServerUrl }
    if (-not $AgentToken -and $cfg.AgentToken) { $AgentToken = $cfg.AgentToken }
    if ($IntervalSeconds -eq 0 -and $cfg.IntervalSeconds) { $IntervalSeconds = [int]$cfg.IntervalSeconds }
  } catch {}
}

if (-not $ServerUrl -and $env:PCMONITOR_SERVER_URL) { $ServerUrl = $env:PCMONITOR_SERVER_URL }
if (-not $AgentToken -and $env:PCMONITOR_AGENT_TOKEN) { $AgentToken = $env:PCMONITOR_AGENT_TOKEN }
if ($IntervalSeconds -eq 0) { $IntervalSeconds = 60 }

if ([string]::IsNullOrWhiteSpace($ServerUrl) -or [string]::IsNullOrWhiteSpace($AgentToken)) {
  Write-Error 'Konfigurasi tidak lengkap. Harap tentukan ServerUrl dan AgentToken via argumen, env var, atau agent-config.json.'
  exit 2
}

$ServerUrl = $ServerUrl.TrimEnd('/')
$HeartbeatUrl = "$ServerUrl/api/agent/heartbeat"
$ConnectivityUrl = "$ServerUrl/api/agent/network/connectivity"
$SpeedtestUrl = "$ServerUrl/api/agent/network/speedtest"
$CommandsUrl = "$ServerUrl/api/agent/commands"
if (-not $LogFile) {
  $LogFile = Join-Path $PSScriptRoot 'agent.log'
}
$NetworkQueueFile = Join-Path $PSScriptRoot 'network-queue.json'

function Write-AgentLog([string]$msg, [string]$level = 'INFO') {
  $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] [$level] $msg"
  Write-Output $line
  try {
    # Batasi ukuran file log agar tidak membesar tanpa batas (< 5 MB)
    if (Test-Path $LogFile) {
      $item = Get-Item $LogFile -ErrorAction SilentlyContinue
      if ($item -and $item.Length -gt 5MB) {
        Move-Item -Path $LogFile -Destination "$LogFile.old" -Force -ErrorAction SilentlyContinue
      }
    }
    Add-Content -Path $LogFile -Value $line -ErrorAction SilentlyContinue
  } catch {}
}

function Get-LocalIPv4 {
  try {
    $address = Get-NetIPAddress -AddressFamily IPv4 -AddressState Preferred -ErrorAction Stop |
      Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.InterfaceAlias -notmatch 'Loopback' } |
      Sort-Object -Property SkipAsSource, InterfaceMetric |
      Select-Object -First 1 -ExpandProperty IPAddress
    if ($address) { return $address }
  } catch {}

  try {
    $address = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
      Where-Object { $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and -not $_.IPAddressToString.StartsWith('127.') } |
      Select-Object -First 1 -ExpandProperty IPAddressToString
    return $address
  } catch {
    return $null
  }
}

function Get-MemoryMetrics {
  try {
    $os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
    if (-not $os) {
      $os = Get-WmiObject Win32_OperatingSystem -ErrorAction SilentlyContinue
    }
    if ($os) {
      $totalMB = [math]::Round($os.TotalVisibleMemorySize / 1024, 1)
      $freeMB  = [math]::Round($os.FreePhysicalMemory / 1024, 1)
      $usedMB  = [math]::Max(0, [math]::Round($totalMB - $freeMB, 1))

      $ramTotalGB  = [math]::Round($totalMB / 1024, 1)
      $ramUsedGB   = [math]::Round($usedMB / 1024, 1)
      $ramUsagePct = if ($totalMB -gt 0) { [math]::Round(($usedMB / $totalMB) * 100, 1) } else { $null }

      return @{
        ramUsagePct = $ramUsagePct
        ramUsedGB   = $ramUsedGB
        ramTotalGB  = $ramTotalGB
      }
    }
  } catch {}

  return @{ ramUsagePct = $null; ramUsedGB = $null; ramTotalGB = $null }
}

function Get-DiskMetrics {
  try {
    $sysRoot = [System.IO.Path]::GetPathRoot($env:SystemRoot)
    $disk = [System.IO.DriveInfo]::GetDrives() | Where-Object { $_.IsReady -and $_.Name -eq $sysRoot } | Select-Object -First 1
    if (-not $disk) {
      $disk = [System.IO.DriveInfo]::GetDrives() | Where-Object { $_.IsReady -and $_.DriveType -eq 'Fixed' } | Select-Object -First 1
    }

    if ($disk) {
      $totalGB = [math]::Round($disk.TotalSize / 1GB, 1)
      $freeGB  = [math]::Round($disk.AvailableFreeSpace / 1GB, 1)
      $usedGB  = [math]::Max(0, [math]::Round(($disk.TotalSize - $disk.AvailableFreeSpace) / 1GB, 1))
      $usagePct = if ($disk.TotalSize -gt 0) { [math]::Round(($usedGB / $totalGB) * 100, 1) } else { $null }

      return @{
        diskUsagePct = $usagePct
        diskFreeGB   = $freeGB
        diskTotalGB  = $totalGB
      }
    }
  } catch {}

  return @{ diskUsagePct = $null; diskFreeGB = $null; diskTotalGB = $null }
}

function Get-NetworkLatencyMs {
  try {
    $p = New-Object System.Net.NetworkInformation.Ping
    $r = $p.Send('8.8.8.8', 1500)
    if ($r.Status -eq [System.Net.NetworkInformation.IPStatus]::Success) {
      return [int]$r.RoundtripTime
    }
  } catch {}
  return $null
}

function Test-TcpEndpoint([string]$HostName, [int]$Port = 443) {
  $client = $null
  try {
    $timer = [Diagnostics.Stopwatch]::StartNew()
    $client = New-Object System.Net.Sockets.TcpClient
    $task = $client.ConnectAsync($HostName, $Port)
    if (-not $task.Wait(4000) -or -not $client.Connected) { return @{ ok = $false; latency = $null } }
    $timer.Stop()
    return @{ ok = $true; latency = [math]::Round($timer.Elapsed.TotalMilliseconds, 1) }
  } catch { return @{ ok = $false; latency = $null } }
  finally { if ($client) { $client.Dispose() } }
}

function Send-NetworkResult($result) {
  try { Invoke-RestMethod -Method Post -Uri $SpeedtestUrl -Headers @{ Authorization = "Bearer $AgentToken" } -ContentType 'application/json' -Body ($result | ConvertTo-Json -Depth 8 -Compress) -TimeoutSec 20 -ErrorAction Stop | Out-Null }
  catch {
    Write-AgentLog "Hasil speed test gagal dikirim; disimpan di antrean lokal: $($_.Exception.Message)" 'WARN'
    try {
      $queue = @(); if (Test-Path $NetworkQueueFile) { $queue = @(Get-Content $NetworkQueueFile -Raw | ConvertFrom-Json -ErrorAction Stop) }
      $queue += $result
      if ($queue.Count -gt 100) { $queue = @($queue | Select-Object -Last 100) }
      $queue | ConvertTo-Json -Depth 8 | Set-Content -Path $NetworkQueueFile -Encoding UTF8
    } catch { Write-AgentLog 'Antrean hasil jaringan lokal tidak dapat disimpan.' 'WARN' }
  }
}

function Flush-NetworkQueue {
  if (-not (Test-Path $NetworkQueueFile)) { return }
  try {
    $queue = @(Get-Content $NetworkQueueFile -Raw | ConvertFrom-Json -ErrorAction Stop)
    while ($queue.Count -gt 0) {
      try { Invoke-RestMethod -Method Post -Uri $SpeedtestUrl -Headers @{ Authorization = "Bearer $AgentToken" } -ContentType 'application/json' -Body ($queue[0] | ConvertTo-Json -Depth 8 -Compress) -TimeoutSec 15 -ErrorAction Stop | Out-Null; $queue = @($queue | Select-Object -Skip 1) }
      catch { break }
    }
    if ($queue.Count) { $queue | ConvertTo-Json -Depth 8 | Set-Content -Path $NetworkQueueFile -Encoding UTF8 }
    else { Remove-Item $NetworkQueueFile -Force -ErrorAction SilentlyContinue }
  } catch { Write-AgentLog 'Antrean hasil jaringan lokal tidak dapat dibaca.' 'WARN' }
}

function Invoke-OoklaSpeedtest([string]$CommandId = '') {
  $started = [DateTime]::UtcNow
  $base = @{ status = 'failed'; errorMessage = $null; startedAt = $started.ToString('o'); completedAt = $null; requestId = [guid]::NewGuid().ToString() }
  if ($CommandId) { $base.commandId = $CommandId }
  try {
    $cli = Get-Command speedtest.exe -ErrorAction SilentlyContinue
    if (-not $cli) { $cli = Get-Command speedtest -ErrorAction SilentlyContinue }
    if (-not $cli) { throw 'Ookla Speedtest CLI tidak terpasang atau tidak ada di PATH.' }
    $stdoutFile = [System.IO.Path]::GetTempFileName(); $stderrFile = [System.IO.Path]::GetTempFileName()
    $process = Start-Process -FilePath $cli.Source -ArgumentList @('--accept-license', '--accept-gdpr', '-f', 'json') -PassThru -NoNewWindow -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile
    if (-not $process.WaitForExit(180000)) { $process.Kill(); throw 'Speed test timeout setelah 180 detik.' }
    $raw = Get-Content $stdoutFile -Raw
    $cliError = Get-Content $stderrFile -Raw
    Remove-Item $stdoutFile, $stderrFile -Force -ErrorAction SilentlyContinue
    if ($process.ExitCode -ne 0) { throw (($cliError.Trim() -split "`r?`n" | Select-Object -First 1)) }
    $json = $raw | ConvertFrom-Json -ErrorAction Stop
    $download = if ($null -ne $json.download.bandwidth) { [math]::Round(([double]$json.download.bandwidth * 8 / 1000000), 3) } else { $null }
    $upload = if ($null -ne $json.upload.bandwidth) { [math]::Round(([double]$json.upload.bandwidth * 8 / 1000000), 3) } else { $null }
    if ($null -eq $download -or $null -eq $upload) { throw 'Field bandwidth tidak ditemukan pada output Ookla.' }
    $base.status = 'success'; $base.downloadMbps = $download; $base.uploadMbps = $upload
    $base.latencyMs = if ($null -ne $json.ping.latency) { [double]$json.ping.latency } else { $null }
    $base.jitterMs = if ($null -ne $json.ping.jitter) { [double]$json.ping.jitter } else { $null }
    $base.packetLossPercent = if ($null -ne $json.packetLoss) { [double]$json.packetLoss } else { $null }
    $base.serverId = if ($json.server.id) { [string]$json.server.id } else { $null }
    $base.serverName = if ($json.server.name) { [string]$json.server.name } else { $null }
    $base.publicIp = if ($json.interface.externalIp) { [string]$json.interface.externalIp } else { $null }
    $base.ooklaVersion = [string]$json.version
  } catch { $base.errorMessage = $_.Exception.Message; Write-AgentLog "Speed test gagal: $($base.errorMessage)" 'WARN' }
  $base.completedAt = [DateTime]::UtcNow.ToString('o')
  Send-NetworkResult $base
  return $base
}

$autoSpeedtestEnabled = $true
$speedTestIntervalMinutes = 30
$nextAutomaticTest = [DateTime]::UtcNow.AddMinutes($speedTestIntervalMinutes + (Get-Random -Minimum 0 -Maximum 181) / 60.0)

Write-AgentLog "PC Monitor Agent dimulai. Server: $HeartbeatUrl | Interval: ${IntervalSeconds}s"

while ($true) {
  Flush-NetworkQueue
  $mem = Get-MemoryMetrics
  $disk = Get-DiskMetrics
  $latency = Get-NetworkLatencyMs
  $localIp = Get-LocalIPv4

  $payloadData = @{
    localIp      = $localIp
    ramUsagePct  = $mem.ramUsagePct
    ramUsedGB    = $mem.ramUsedGB
    ramTotalGB   = $mem.ramTotalGB
    diskUsagePct = $disk.diskUsagePct
    diskFreeGB   = $disk.diskFreeGB
    diskTotalGB  = $disk.diskTotalGB
    latencyMs    = $latency
  }

  $payload = $payloadData | ConvertTo-Json -Compress

  try {
    $null = Invoke-RestMethod -Method Post -Uri $HeartbeatUrl `
      -Headers @{ Authorization = "Bearer $AgentToken" } `
      -ContentType 'application/json; charset=utf-8' `
      -Body $payload -TimeoutSec 15 -ErrorAction Stop

    $metricsSummary = "RAM: $($mem.ramUsagePct)% | Disk Free: $($disk.diskFreeGB)GB | Ping: $($latency)ms"
    Write-AgentLog "Heartbeat terkirim ($metricsSummary)" 'INFO'
  } catch {
    $statusCode = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 'NetworkError' }
    $reason = if ($_.Exception.Message) { " ($($_.Exception.Message))" } else { "" }
    Write-AgentLog "Heartbeat gagal: $statusCode$reason. Target: $HeartbeatUrl" 'WARN'
  }

  # Two independent public endpoints; a single failure does not mean internet down.
  $checks = @((Test-TcpEndpoint 'www.microsoft.com'), (Test-TcpEndpoint 'www.cloudflare.com'))
  $internetReachable = [bool](($checks | Where-Object { $_.ok }).Count -gt 0)
  $latencies = @($checks | Where-Object { $_.ok } | ForEach-Object { $_.latency })
  $checkPayload = @{ gatewayReachable = $null; internetReachable = $internetReachable; apiReachable = $false; latencyMs = if ($latencies.Count) { [math]::Round(($latencies | Measure-Object -Average).Average, 1) } else { $null }; packetLossPercent = [math]::Round((2 - $latencies.Count) / 2 * 100, 1); checkedAt = [DateTime]::UtcNow.ToString('o') }
  try {
    $apiProbe = Invoke-WebRequest -Uri "$ServerUrl/api/health" -Method Get -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    $checkPayload.apiReachable = ($apiProbe.StatusCode -ge 200 -and $apiProbe.StatusCode -lt 500)
  } catch {}
  try { Invoke-RestMethod -Method Post -Uri $ConnectivityUrl -Headers @{ Authorization = "Bearer $AgentToken" } -ContentType 'application/json' -Body ($checkPayload | ConvertTo-Json -Compress) -TimeoutSec 15 -ErrorAction Stop | Out-Null }
  catch { Write-AgentLog "Connectivity check gagal dikirim." 'WARN' }

  try {
    $pending = Invoke-RestMethod -Method Get -Uri $CommandsUrl -Headers @{ Authorization = "Bearer $AgentToken" } -TimeoutSec 10 -ErrorAction Stop
    if ($pending.settings) {
      $speedTestIntervalMinutes = [math]::Max(15, [int]$pending.settings.speedTestIntervalMinutes)
      $autoSpeedtestEnabled = [bool]$pending.settings.speedTestEnabled
    }
    if ($pending.command) {
      $command = $pending.command
      if ([DateTime]::Parse($command.expiresAt).ToUniversalTime() -gt [DateTime]::UtcNow) {
        if ($command.commandType -eq 'RUN_SPEEDTEST') { Invoke-OoklaSpeedtest ([string]$command.id) | Out-Null }
        elseif ($command.commandType -eq 'UPDATE_SETTINGS') {
          if ($command.payload.speedTestIntervalMinutes) { $speedTestIntervalMinutes = [math]::Max(15, [int]$command.payload.speedTestIntervalMinutes) }
          if ($null -ne $command.payload.speedTestEnabled) { $autoSpeedtestEnabled = [bool]$command.payload.speedTestEnabled }
          $nextAutomaticTest = [DateTime]::UtcNow.AddMinutes($speedTestIntervalMinutes)
          $null = Invoke-RestMethod -Method Post -Uri "$ServerUrl/api/agent/commands/$($command.id)/result" -Headers @{ Authorization = "Bearer $AgentToken" } -ContentType 'application/json' -Body (@{ status = 'completed'; result = @{ acknowledged = $true } } | ConvertTo-Json -Compress) -TimeoutSec 10 -ErrorAction Stop
        }
      }
    }
  } catch {}
  if ($autoSpeedtestEnabled -and [DateTime]::UtcNow -ge $nextAutomaticTest) {
    Invoke-OoklaSpeedtest
    $nextAutomaticTest = [DateTime]::UtcNow.AddMinutes($speedTestIntervalMinutes + (Get-Random -Minimum 0 -Maximum 181) / 60.0)
  }

  Start-Sleep -Seconds ([Math]::Max(15, $IntervalSeconds))
}
