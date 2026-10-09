$conns = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if (-not $conns) { Write-Output "no-listener"; exit }

$pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($p in $pids) {
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$p" -ErrorAction SilentlyContinue
  if ($proc) {
    Write-Output "killing $($proc.ProcessId) [$($proc.Name)] parent=$($proc.ParentProcessId)"
    Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
    # also kill children (uvicorn reloader spawns a worker)
    Get-CimInstance Win32_Process -Filter "ParentProcessId=$p" -ErrorAction SilentlyContinue | ForEach-Object {
      Write-Output "  killing child $($_.ProcessId) [$($_.Name)]"
      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
  }
}
Start-Sleep -Seconds 1
$still = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($still) { Write-Output "STILL-LISTENING" } else { Write-Output "port-8000-free" }
