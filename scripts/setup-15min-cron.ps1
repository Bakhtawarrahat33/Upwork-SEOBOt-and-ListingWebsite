# Setup Windows Task Scheduler for Listing Database Sync
# Runs every 15 minutes

$TaskName = "Sync Listing Database"
$TaskPath = "\"
$NodePath = "node"
$ScriptName = "scripts\sync-to-listing-db.mjs"
$ProjectPath = "D:\One-Week-work-with-CEO"

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Setting up Task Scheduler Cron" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if task already exists
$ExistingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if ($ExistingTask) {
    Write-Host "⚠️  Task '$TaskName' already exists." -ForegroundColor Yellow
    Write-Host "Removing old task..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Start-Sleep -Seconds 2
}

# Create trigger for every 15 minutes (once trigger with repetition)
$StartTime = (Get-Date).AddMinutes(1).ToString("HH:mm")
$Trigger = New-ScheduledTaskTrigger -Once -At $StartTime -RepetitionInterval (New-TimeSpan -Minutes 15) -RepetitionDuration (New-TimeSpan -Days 365)

# Create action
$Action = New-ScheduledTaskAction -Execute $NodePath -Argument $ScriptName -WorkingDirectory $ProjectPath

# Create task settings
$Settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable

# Create task
$Task = New-ScheduledTask -Action $Action -Trigger $Trigger -Settings $Settings -Description "Syncs data from upwork_jobs to listing_site DB every 15 minutes with watermark and audit log"

# Register task
Register-ScheduledTask -InputObject $Task -TaskName $TaskName -ErrorAction Stop

Write-Host ""
Write-Host "✅ Task created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Task Details:" -ForegroundColor Cyan
Write-Host "  Name: $TaskName"
Write-Host "  Interval: Every 15 minutes"
Write-Host "  Script: $ScriptName"
Write-Host "  Path: $ProjectPath"
Write-Host ""

# Show the task
Write-Host "Task Information:" -ForegroundColor Cyan
Get-ScheduledTask -TaskName $TaskName | Format-List TaskName, State, Description

Write-Host ""
Write-Host "Next Run:" -ForegroundColor Cyan
$TaskInfo = Get-ScheduledTask -TaskName $TaskName | Get-ScheduledTaskInfo
Write-Host "  $($TaskInfo.NextRunTime)"

Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "Setup Complete! ✅" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "To view task history:" -ForegroundColor Yellow
Write-Host "  Get-ScheduledTask -TaskName '$TaskName' | Get-ScheduledTaskInfo"
Write-Host ""
Write-Host "To disable task:" -ForegroundColor Yellow
Write-Host "  Disable-ScheduledTask -TaskName '$TaskName'"
Write-Host ""
Write-Host "To remove task:" -ForegroundColor Yellow
Write-Host "  Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"
Write-Host ""
