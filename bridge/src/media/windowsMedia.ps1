# Windows media session helper, started by the bridge (bridge/src/media/windowsMedia.ts)
# when config.json has "media": { "source": "windows" }. Needs Windows PowerShell 5.1
# (powershell.exe, built into Windows 10/11); PowerShell 7 can't load WinRT types.
#
# stdout: one JSON object per line
#   {"t":"state", "title":..., "artist":..., "album":..., "app":..., "playing":bool,
#    "positionSec":n|null, "durationSec":n|null, "art":id|null, "canNext":bool, "canPrevious":bool}
#   {"t":"art", "id":n, "mime":"image/png", "data":"<base64>"}
#   {"t":"error", "msg":...}
# stdin: one command per line: playPause | next | previous

param([int]$PollMs = 1000)

$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding $false
$out = New-Object System.IO.StreamWriter ([Console]::OpenStandardOutput()), $utf8
$out.AutoFlush = $true
$stdin = New-Object System.IO.StreamReader ([Console]::OpenStandardInput()), $utf8

function Send($obj) { $out.WriteLine(($obj | ConvertTo-Json -Compress -Depth 3)) }

# --- WinRT plumbing: await IAsyncOperation<T> from PowerShell --------------------------
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTaskGeneric = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
  $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1

function Await($op, [Type]$type) {
  $task = $asTaskGeneric.MakeGenericMethod($type).Invoke($null, @($op))
  if (-not $task.Wait(5000)) { throw 'WinRT call timed out' }
  $task.Result
}

[void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
[void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType = WindowsRuntime]
[void][Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime]
$asStreamForRead = [System.IO.WindowsRuntimeStreamExtensions].GetMethod('AsStreamForRead', [Type[]]@([Windows.Storage.Streams.IInputStream]))
$contentTypeProp = [Windows.Storage.Streams.IContentTypeProvider].GetProperty('ContentType')

$manager = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) `
  ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])

# --- album art --------------------------------------------------------------------------
$artId = 0
$artKey = $null      # track the current art belongs to
$artTries = 0        # apps often attach the thumbnail a moment after the track changes

function Read-Art($thumb) {
  $stream = Await ($thumb.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
  # PowerShell sees the stream as a bare COM object it can't cast; calling through
  # reflection lets .NET do the interface casts. Closing the .NET wrapper closes the stream.
  $net = $asStreamForRead.Invoke($null, @($stream))
  try {
    $mem = New-Object System.IO.MemoryStream
    $net.CopyTo($mem)
    if ($mem.Length -eq 0) { return $null }
    # e.g. "image/jpeg,image/jpe,image/jpg"
    $types = "$($contentTypeProp.GetValue($stream))"
    $mime = if ($types) { $types.Split(',')[0].Trim() } else { 'image/jpeg' }
    return @{ mime = $mime; data = [Convert]::ToBase64String($mem.ToArray()) }
  } finally {
    $net.Dispose()
  }
}

# --- state ------------------------------------------------------------------------------
$last = $null

function Poll {
  $session = $manager.GetCurrentSession()
  if (-not $session) {
    $script:artKey = $null
    $state = [ordered]@{ t = 'state'; title = $null; artist = $null; album = $null; app = $null; playing = $false
      positionSec = $null; durationSec = $null; art = $null; canNext = $false; canPrevious = $false }
  } else {
    $props = Await ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
    $info = $session.GetPlaybackInfo()
    $tl = $session.GetTimelineProperties()
    $playing = "$($info.PlaybackStatus)" -eq 'Playing'

    $duration = ($tl.EndTime - $tl.StartTime).TotalSeconds
    $position = $null
    if ($duration -gt 0) {
      $position = ($tl.Position - $tl.StartTime).TotalSeconds
      # Apps report position only now and then; extrapolate from when they last did.
      if ($playing -and $tl.LastUpdatedTime.Year -gt 2000) {
        $position += ([DateTimeOffset]::Now - $tl.LastUpdatedTime).TotalSeconds
      }
      $position = [Math]::Round([Math]::Min([Math]::Max($position, 0), $duration), 2)
      $duration = [Math]::Round($duration, 2)
    } else {
      $duration = $null
    }

    $key = "$($session.SourceAppUserModelId)|$($props.Title)|$($props.Artist)|$($props.AlbumTitle)"
    if ($key -ne $script:artKey) {
      $script:artKey = $key
      $script:artTries = 0
      $script:artCurrent = $null
    }
    if (-not $script:artCurrent -and $props.Thumbnail -and $script:artTries -lt 5) {
      $script:artTries++
      try {
        $img = Read-Art $props.Thumbnail
        if ($img) {
          $script:artId++
          $script:artCurrent = $script:artId
          Send ([ordered]@{ t = 'art'; id = $script:artId; mime = $img.mime; data = $img.data })
        }
      } catch {
        Send @{ t = 'error'; msg = "art: $($_.Exception.Message)" }
      }
    }

    $state = [ordered]@{
      t = 'state'
      title = if ($props.Title) { $props.Title } else { $null }
      artist = if ($props.Artist) { $props.Artist } else { $null }
      album = if ($props.AlbumTitle) { $props.AlbumTitle } else { $null }
      app = $session.SourceAppUserModelId
      playing = $playing
      positionSec = $position
      durationSec = $duration
      art = $script:artCurrent
      canNext = [bool]$info.Controls.IsNextEnabled
      canPrevious = [bool]$info.Controls.IsPreviousEnabled
    }
  }

  # Position moves every poll while playing; otherwise only send real changes.
  $json = $state | ConvertTo-Json -Compress
  if ($json -ne $script:last) {
    $script:last = $json
    $out.WriteLine($json)
  }
}

function Run-Command([string]$cmd) {
  $session = $manager.GetCurrentSession()
  if (-not $session) { return }
  switch ($cmd) {
    'playPause' { [void](Await ($session.TryTogglePlayPauseAsync()) ([bool])) }
    'next' { [void](Await ($session.TrySkipNextAsync()) ([bool])) }
    'previous' { [void](Await ($session.TrySkipPreviousAsync()) ([bool])) }
  }
}

# --- main loop: poll on a timer, react to commands as they arrive ------------------------
$pending = $stdin.ReadLineAsync()
$nextPoll = [DateTime]::MinValue
while ($true) {
  try {
    if ($pending.IsCompleted) {
      $line = $pending.Result
      if ($null -eq $line) { break } # bridge closed stdin: exit
      Run-Command $line.Trim()
      $pending = $stdin.ReadLineAsync()
      Start-Sleep -Milliseconds 150   # let the player apply it before we look again
      $nextPoll = [DateTime]::MinValue
    }
    if ([DateTime]::UtcNow -ge $nextPoll) {
      $nextPoll = [DateTime]::UtcNow.AddMilliseconds($PollMs)
      Poll
    }
  } catch {
    Send @{ t = 'error'; msg = $_.Exception.Message }
    $nextPoll = [DateTime]::UtcNow.AddMilliseconds($PollMs)
  }
  Start-Sleep -Milliseconds 50
}
