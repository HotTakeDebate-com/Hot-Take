export function getMediaErrorMessage(err) {
  const name = err?.name;
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Camera or microphone access was blocked. Click the lock/camera icon in the address bar and allow the site, then try again.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'The browser could not use your camera and/or microphone. If your mic works in other apps: allow Edge/Chrome under Windows Settings → Privacy → Camera and Microphone, unplug/replug USB devices, or try another browser. (Requesting both can fail if the camera is missing or blocked even when the mic works.)';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Camera or mic is already in use (e.g. another tab, Zoom, or the other browser using the same device). Close those and try again.';
  }
  if (name === 'SecurityError') {
    return 'This page must be served over HTTPS or localhost to use the camera. Don’t open the built file directly from disk.';
  }
  if (name === 'OverconstrainedError') {
    return 'Your camera doesn’t support the requested settings. Try another browser or device.';
  }
  return `Could not start camera or microphone (${name || 'unknown'}). Check your device and try again.`;
}

/** Pass device ids from `<select>`; empty string = browser default. */
export function buildMediaConstraints(videoDeviceId, audioDeviceId) {
  return {
    video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
    audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
  };
}

/**
 * Many PCs fail `{ video: true, audio: true }` when there is no camera or the camera is blocked,
 * even if the microphone works. This tries: full → defaults (if custom ids) → audio-only → video-only.
 */
export async function getUserMediaWithFallback(videoDeviceId, audioDeviceId) {
  const chain = [
    () => navigator.mediaDevices.getUserMedia(buildMediaConstraints(videoDeviceId, audioDeviceId)),
  ];
  if (videoDeviceId || audioDeviceId) {
    chain.push(() => navigator.mediaDevices.getUserMedia(buildMediaConstraints('', '')));
  }
  chain.push(() =>
    navigator.mediaDevices.getUserMedia({
      audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
    })
  );
  chain.push(() => navigator.mediaDevices.getUserMedia({ audio: true }));
  chain.push(() =>
    navigator.mediaDevices.getUserMedia({
      video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
    })
  );
  chain.push(() => navigator.mediaDevices.getUserMedia({ video: true }));

  let lastErr;
  for (const run of chain) {
    try {
      return await run();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

/**
 * Browsers can briefly report devices as missing/busy immediately after a prior
 * debate releases them. Retry defaults after a short settle period instead of
 * showing a false permission error to someone whose devices just worked.
 */
export async function getUserMediaWithRecovery(videoDeviceId, audioDeviceId) {
  try {
    return await getUserMediaWithFallback(videoDeviceId, audioDeviceId);
  } catch (firstError) {
    const retryable = ['NotFoundError', 'DevicesNotFoundError', 'NotReadableError', 'TrackStartError', 'AbortError'].includes(firstError?.name);
    if (!retryable) throw firstError;
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    try {
      return await getUserMediaWithFallback('', '');
    } catch {
      await new Promise((resolve) => window.setTimeout(resolve, 850));
      return getUserMediaWithFallback('', '');
    }
  }
}
