// Remembers (on this device only) that the person agreed to camera use.
const KEY = "humankit-camera-consent";
const SESSIONS = "humankit-sessions";

export function hasCameraConsent(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function giveCameraConsent() {
  try {
    localStorage.setItem(KEY, new Date().toISOString());
  } catch {
    // Storage is blocked; we will simply ask again next time.
  }
}

// Removes the saved agreement and every saved session.
export function deleteAllMyData() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(SESSIONS);
  } catch {
    // nothing to delete
  }
}
