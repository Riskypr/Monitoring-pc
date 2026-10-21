param(
  [Parameter(Mandatory = $false)] [string] $ServerUrl = $env:PCMONITOR_SERVER_URL,
  [Parameter(Mandatory = $false)] [string] $AgentToken = $env:PCMONITOR_AGENT_TOKEN,
  [Parameter(Mandatory = $false)] [int] $IntervalSeconds = 60
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($ServerUrl) -or [string]::IsNullOrWhiteSpace($AgentToken)) {
  Write-Error 'Atur PCMONITOR_SERVER_URL dan PCMONITOR_AGENT_TOKEN sebelum menjalankan agent.'
  exit 2
}

$ServerUrl = $ServerUrl.TrimEnd('/')
$HeartbeatUrl = "$ServerUrl/api/agent/heartbeat"

function Get-LocalIPv4 {
  try {
    $address = Get-NetIPAddress -AddressFamily IPv4 -AddressState Preferred -ErrorAction Stop |
      Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' -and $_.InterfaceAlias -notmatch 'Loopback' } |
      Sort-Object -Property SkipAsSource, InterfaceMetric |
      Select-Object -First 1 -ExpandProperty IPAddress
    return $address
  } catch {
    try {
      $address = [System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
        Where-Object { $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and -not $_.IPAddressToString.StartsWith('127.') } |
        Select-Object -First 1 -ExpandProperty IPAddressToString
      return $address
    } catch { return $null }
  }
}

while ($true) {
  $payload = @{ localIp = (Get-LocalIPv4) } | ConvertTo-Json -Compress
  try {
    $null = Invoke-RestMethod -Method Post -Uri $HeartbeatUrl -Headers @{ Authorization = "Bearer $AgentToken" } `
      -ContentType 'application/json' -Body $payload -TimeoutSec 15
    Write-Output "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Heartbeat terkirim."
  } catch {
    $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 'network' }
    Write-Warning "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Heartbeat gagal ($status). Akan dicoba pada interval berikutnya."
  }
  Start-Sleep -Seconds ([Math]::Max(15, $IntervalSeconds))
}
