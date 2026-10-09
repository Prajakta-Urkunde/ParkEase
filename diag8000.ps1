Get-CimInstance Win32_Process | Where-Object {
  ($_.Name -match 'python|uvicorn') -or ($_.CommandLine -match 'uvicorn|app\.main')
} | ForEach-Object {
  Write-Output ("pid={0} parent={1} name={2}" -f $_.ProcessId, $_.ParentProcessId, $_.Name)
  Write-Output ("  cmd={0}" -f $_.CommandLine)
}
Write-Output "---- port owner ----"
Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
  Write-Output ("port owned by pid={0}" -f $_.OwningProcess)
}
