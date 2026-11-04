$TaskName = "PCMonitorAgent"

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

Write-Host "PC Monitor Agent telah dinonaktifkan sepenuhnya." -ForegroundColor Cyan
