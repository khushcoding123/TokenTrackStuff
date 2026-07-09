// OS permission handling for background prompt capture.
//
// IMPORTANT nuance (see docs/phase5-screen-awareness-proposal.md): reading the
// prompt out of another app is done via the OS *accessibility* tree, which reads
// the actual text of a focused input field — NOT by recording the screen. So the
// permission that actually matters is Accessibility, and Screen Recording is only
// relevant if we ever add pixel/OCR capture (we don't, by design). This module
// requests what's needed and reports status honestly per platform.

const { systemPreferences, shell } = require("electron");

const isMac = () => process.platform === "darwin";

// Accessibility — required on macOS to read another app's focused text field.
function getAccessibilityStatus() {
  if (!isMac()) return "not-required"; // Windows UIA / Linux AT-SPI aren't OS-gated the same way
  return systemPreferences.isTrustedAccessibilityClient(false) ? "granted" : "denied";
}

// Passing true surfaces the macOS prompt and adds the app to the Accessibility
// list; the user still has to toggle it on (and usually restart the app).
function requestAccessibility() {
  if (!isMac()) return "not-required";
  return systemPreferences.isTrustedAccessibilityClient(true) ? "granted" : "denied";
}

// Screen Recording — NOT needed for text-field reading; surfaced for honesty
// and in case a future OCR path is added.
function getScreenRecordingStatus() {
  if (!isMac()) return "not-required";
  try {
    return systemPreferences.getMediaAccessStatus("screen"); // granted | denied | restricted | not-determined
  } catch {
    return "unknown";
  }
}

// macOS can't programmatically grant Screen Recording — deep-link to the pane.
function openScreenRecordingSettings() {
  if (isMac()) {
    shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture");
  }
}
function openAccessibilitySettings() {
  if (isMac()) {
    shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility");
  }
}

/**
 * Ensure we have what's needed to capture prompts. Requests Accessibility on
 * macOS; on Windows/Linux there's no blocking OS prompt, so it proceeds.
 * @returns {{ ok:boolean, accessibility:string, screenRecording:string, platform:string }}
 */
function ensureCapturePermission() {
  const accessibility = requestAccessibility();
  return {
    ok: accessibility === "granted" || accessibility === "not-required",
    accessibility,
    screenRecording: getScreenRecordingStatus(),
    platform: process.platform,
  };
}

function getPermissionStatus() {
  return {
    accessibility: getAccessibilityStatus(),
    screenRecording: getScreenRecordingStatus(),
    platform: process.platform,
  };
}

module.exports = {
  ensureCapturePermission,
  getPermissionStatus,
  requestAccessibility,
  getAccessibilityStatus,
  getScreenRecordingStatus,
  openScreenRecordingSettings,
  openAccessibilitySettings,
};
