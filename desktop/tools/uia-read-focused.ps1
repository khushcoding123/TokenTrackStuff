# UIA readability probe for the Cursor/VS Code prompt-capture feature.
#
# Reads the text of whatever UI element is currently FOCUSED, via Windows UI
# Automation — the same mechanism the desktop app would use to read the prompt
# you're drafting in Cursor/VS Code. Run this, then click into a Cursor/VS Code
# editor (or its Claude/AI chat input) and re-run: if `text` comes back with your
# editor content, UIA reading works and we can wire it into the app. If it's
# empty on Monaco, enable  "editor.accessibilitySupport": "on"  in Cursor/VS Code
# settings and try again (Chromium's a11y tree is lazy — see the Phase 5 doc).
#
# Usage (from the app, we'd shell out to this; to test by hand pass a delay so
# you can click into Cursor/VS Code before it reads):
#   powershell -ExecutionPolicy Bypass -File desktop/tools/uia-read-focused.ps1 4
#   ...then within 4s, click into your Cursor/VS Code editor and type something.

param([int]$DelaySeconds = 0)

if ($DelaySeconds -gt 0) {
  for ($i = $DelaySeconds; $i -ge 1; $i--) {
    Write-Host "Focus your Cursor/VS Code editor… reading in $i" -ForegroundColor Yellow
    Start-Sleep -Seconds 1
  }
}

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$focused = [System.Windows.Automation.AutomationElement]::FocusedElement
if (-not $focused) {
  [pscustomobject]@{ ok = $false; reason = "no focused element" } | ConvertTo-Json
  return
}

$text = $null
$vp = $null
if ($focused.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$vp)) {
  $text = $vp.Current.Value
} else {
  $tp = $null
  if ($focused.TryGetCurrentPattern([System.Windows.Automation.TextPattern]::Pattern, [ref]$tp)) {
    try { $text = $tp.DocumentRange.GetText(4000) } catch { $text = $null }
  }
}

[pscustomobject]@{
  ok          = $true
  app         = $focused.Current.Name
  className   = $focused.Current.ClassName
  controlType = $focused.Current.ControlType.ProgrammaticName
  hasText     = [bool]$text
  textPreview = if ($text) { $text.Substring(0, [Math]::Min(200, $text.Length)) } else { $null }
} | ConvertTo-Json -Compress
