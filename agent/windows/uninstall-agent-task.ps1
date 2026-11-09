$TaskName = "PCMonitorAgent"
$AgentDirectories = @($PSScriptRoot)

# Cari folder agent dari Task Scheduler atau proses yang sedang berjalan agar
# uninstaller tetap bisa menghapus konfigurasi meski diekstrak ke folder lain.
try {
  $scheduledTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  foreach ($action in $scheduledTask.Actions) {
    if ($action.WorkingDirectory) { $AgentDirectories += $action.WorkingDirectory }
  }
} catch {}

try {
  $agentProcesses = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*pc-monitor-agent.ps1*" }
  foreach ($process in $agentProcesses) {
    if ($process.CommandLine -match '(?i)-File\s+"([^"\r\n]*pc-monitor-agent\.ps1)"') {
      $AgentDirectories += [IO.Path]::GetDirectoryName($Matches[1])
    } elseif ($process.CommandLine -match '(?i)-File\s+(\S*pc-monitor-agent\.ps1)') {
      $AgentDirectories += [IO.Path]::GetDirectoryName($Matches[1])
    }
  }
} catch {}

# Fallback untuk mode Windows Startup ketika agent sedang tidak berjalan.
try {
  $startupFolder = [Environment]::GetFolderPath('Startup')
  $vbsStartupPath = Join-Path $startupFolder "PCMonitorAgent.vbs"
  if (Test-Path $vbsStartupPath) {
    $startupScript = Get-Content $vbsStartupPath -Raw
    if ($startupScript -match '(?i)([A-Z]:\\[^"\r\n]*pc-monitor-agent\.ps1)') {
      $AgentDirectories += [IO.Path]::GetDirectoryName($Matches[1])
    }
  }
} catch {}

$AgentDirectories = $AgentDirectories | Where-Object { $_ } | Select-Object -Unique

Write-Host "Menghentikan dan menghapus PC Monitor Agent..." -ForegroundColor Yellow

# 1. Hapus dari Scheduled Task jika ada
try {
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction Stop
  Write-Host "[BERHASIL] Scheduled Task '$TaskName' telah dihapus." -ForegroundColor Green
} catch {}

# 2. Hapus dari folder Startup jika ada
try {
  $startupFolder = [Environment]::GetFolderPath('Startup')
  $vbsStartupPath = Join-Path $startupFolder "PCMonitorAgent.vbs"
  if (Test-Path $vbsStartupPath) {
    Remove-Item -Path $vbsStartupPath -Force -ErrorAction SilentlyContinue
    Write-Host "[BERHASIL] File startup '$vbsStartupPath' telah dihapus." -ForegroundColor Green
  }
} catch {}

# 3. Hentikan proses agent yang sedang berjalan di background
try {
  $procs = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*pc-monitor-agent.ps1*" }
  foreach ($p in $procs) {
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    Write-Host "[BERHASIL] Proses background agent (PID: $($p.ProcessId)) dihentikan." -ForegroundColor Green
  }
} catch {}

# 4. Hapus file konfigurasi token/server agar bersih untuk instalasi baru
foreach ($agentDirectory in $AgentDirectories) {
  try {
    $ConfigFile = Join-Path $agentDirectory "agent-config.json"
    if (Test-Path $ConfigFile) {
      Remove-Item -Path $ConfigFile -Force -ErrorAction SilentlyContinue
      Write-Host "[BERHASIL] Konfigurasi token & server lama ($ConfigFile) telah dihapus." -ForegroundColor Green
    }
  } catch {}
}

Write-Host "PC Monitor Agent telah dinonaktifkan sepenuhnya." -ForegroundColor Cyan
