param(
  [Parameter(Mandatory = $false)] [string] $ServerUrl = '',
  [Parameter(Mandatory = $false)] [string] $AgentToken = '',
  [Parameter(Mandatory = $false)] [int] $IntervalSeconds = 0,
  [Parameter(Mandatory = $false)] [string] $LogFile = ''
)

$ErrorActionPreference = 'SilentlyContinue'
$cfg = @{}

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
if (-not $LogFile) {
  $LogFile = Join-Path $PSScriptRoot 'agent.log'
}

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

Write-AgentLog "PC Monitor Agent dimulai. Server: $HeartbeatUrl | Interval: ${IntervalSeconds}s"

while ($true) {
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

  Start-Sleep -Seconds ([Math]::Max(15, $IntervalSeconds))
}
