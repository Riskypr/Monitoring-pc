param(
  [Parameter(Mandatory = $false)] [string] $ServerUrl,
  [Parameter(Mandatory = $false)] [string] $AgentToken,
  [Parameter(Mandatory = $false)] [int] $IntervalSeconds = 60
)

$TaskName = "PCMonitorAgent"
$ScriptPath = Join-Path $PSScriptRoot "pc-monitor-agent.ps1"
$ConfigFile = Join-Path $PSScriptRoot "agent-config.json"

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "      Pemasangan PC Monitor Agent Background   " -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# 1. Pastikan file agent ada
if (-not (Test-Path $ScriptPath)) {
  Write-Error "File $ScriptPath tidak ditemukan!"
  exit 1
}

# 2. Cek konfigurasi yang ada atau minta input
if (-not $ServerUrl -or -not $AgentToken) {
  if (Test-Path $ConfigFile) {
    try {
      $existing = Get-Content $ConfigFile -Raw | ConvertFrom-Json
      if (-not $ServerUrl) { $ServerUrl = $existing.ServerUrl }
      if (-not $AgentToken) { $AgentToken = $existing.AgentToken }
      if ($existing.IntervalSeconds) { $IntervalSeconds = [int]$existing.IntervalSeconds }
    } catch {}
  }
}

if (-not $ServerUrl) {
  $ServerUrl = Read-Host "Masukkan URL Server (contoh: http://localhost:3000 atau domain monitoring)"
}
if (-not $AgentToken) {
  $AgentToken = Read-Host "Masukkan Token Agent PC"
}

if ([string]::IsNullOrWhiteSpace($ServerUrl) -or [string]::IsNullOrWhiteSpace($AgentToken)) {
  Write-Error "ServerUrl dan AgentToken wajib diisi!"
  exit 1
}

# 3. Simpan ke agent-config.json agar konfigurasi tersimpan permanen
$configObj = @{
  ServerUrl       = $ServerUrl.TrimEnd('/')
  AgentToken      = $AgentToken.Trim()
  IntervalSeconds = $IntervalSeconds
}
$configObj | ConvertTo-Json | Set-Content -Path $ConfigFile -Force -Encoding UTF8
Write-Host "[OK] Konfigurasi tersimpan di: $ConfigFile" -ForegroundColor Green

# 4. Hentikan proses lama jika sedang berjalan
try {
  $procs = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*pc-monitor-agent.ps1*" }
  foreach ($p in $procs) {
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
    Write-Host "[INFO] Menghentikan proses agent lama (PID: $($p.ProcessId))..." -ForegroundColor Yellow
  }
} catch {}

# 5. Pasang Auto-Start Background (Mendukung Administrator & Standar User)
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
$installedMode = ""

if ($isAdmin) {
  try {
    Write-Host "[INFO] Hak Administrator terdeteksi. Mendaftarkan ke Windows Task Scheduler..." -ForegroundColor Cyan

    # Hapus task lama jika ada
    try {
      Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
      Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    } catch {}

    $PowerShellExe = (Get-Process -Id $PID).Path
    if (-not $PowerShellExe) { $PowerShellExe = "powershell.exe" }

    $Arguments = "-WindowStyle Hidden -ExecutionPolicy Bypass -NoProfile -File `"$ScriptPath`""
    $Action = New-ScheduledTaskAction -Execute $PowerShellExe -Argument $Arguments -WorkingDirectory $PSScriptRoot
    $TriggerLogon = New-ScheduledTaskTrigger -AtLogOn

    $Settings = New-ScheduledTaskSettingsSet `
      -AllowStartIfOnBatteries `
      -DontStopIfGoingOnBatteries `
      -ExecutionTimeLimit ([TimeSpan]::Zero) `
      -RestartCount 3 `
      -RestartInterval (New-TimeSpan -Minutes 1) `
      -Priority 7

    $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest
    $null = Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $TriggerLogon -Settings $Settings -Principal $principal -Force -ErrorAction Stop
    Start-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    $installedMode = "Windows Task Scheduler (Admin)"
  } catch {
    Write-Host "[WARN] Gagal mendaftar ke Task Scheduler: $($_.Exception.Message)" -ForegroundColor Yellow
  }
}

# Jika bukan administrator atau gagal di Task Scheduler, otomatis gunakan Windows Startup Folder
if (-not $installedMode) {
  Write-Host "[INFO] Menggunakan mode Windows Startup (tidak memerlukan hak Administrator)..." -ForegroundColor Cyan
  $startupFolder = [Environment]::GetFolderPath('Startup')
  $vbsStartupPath = Join-Path $startupFolder "PCMonitorAgent.vbs"

  $vbsContent = "Set WshShell = CreateObject(""WScript.Shell"")`r`nWshShell.Run ""powershell.exe -WindowStyle Hidden -ExecutionPolicy Bypass -NoProfile -File """"$ScriptPath"""""", 0, False`r`nSet WshShell = Nothing`r`n"
  Set-Content -Path $vbsStartupPath -Value $vbsContent -Force -Encoding ASCII
  
  # Jalankan agent sekarang juga di background
  Start-Process wscript.exe -ArgumentList "`"$vbsStartupPath`""
  $installedMode = "Windows User Startup (Non-Admin)"
}

Write-Host "==============================================" -ForegroundColor Green
Write-Host "[BERHASIL] Agent telah terpasang dan aktif!" -ForegroundColor Green
Write-Host "  - Mode      : $installedMode" -ForegroundColor White
Write-Host "  - Status    : Berjalan di background (tanpa terminal terbuka)" -ForegroundColor White
Write-Host "  - Auto-start: Otomatis aktif setiap komputer dinyalakan/login" -ForegroundColor White
Write-Host "  - File Log  : $(Join-Path $PSScriptRoot 'agent.log')" -ForegroundColor White
Write-Host "==============================================" -ForegroundColor Green
