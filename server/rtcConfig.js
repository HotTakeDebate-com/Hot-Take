const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

let cachedCloudflareConfig = null;

function staticIceConfig() {
  const raw = process.env.ICE_SERVERS_JSON;
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      console.warn('ICE_SERVERS_JSON invalid; ignoring static ICE config');
      return null;
    }
    return { iceServers: parsed, relayConfigured: parsed.some((entry) => /turns?:/i.test(JSON.stringify(entry.urls || ''))) };
  } catch (error) {
    console.warn('ICE_SERVERS_JSON parse error; ignoring static ICE config', error.message);
    return null;
  }
}

async function cloudflareTurnConfig() {
  const keyId = String(process.env.CLOUDFLARE_TURN_KEY_ID || '').trim();
  const apiToken = String(process.env.CLOUDFLARE_TURN_KEY_API_TOKEN || '').trim();
  if (!keyId || !apiToken) return null;
  if (cachedCloudflareConfig?.refreshAt > Date.now()) return cachedCloudflareConfig.value;

  const response = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ttl: 86400 }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Cloudflare TURN credential request failed (${response.status})`);
  const result = await response.json();
  if (!Array.isArray(result?.iceServers) || result.iceServers.length === 0) {
    throw new Error('Cloudflare TURN returned no ICE servers');
  }
  // Browsers commonly block port 53; removing it avoids needless ICE timeouts.
  const iceServers = result.iceServers.map((entry) => ({
    ...entry,
    urls: Array.isArray(entry.urls)
      ? entry.urls.filter((url) => !String(url).includes(':53'))
      : entry.urls,
  }));
  const value = { iceServers, relayConfigured: true };
  cachedCloudflareConfig = { value, refreshAt: Date.now() + 12 * 60 * 60 * 1000 };
  return value;
}

/**
 * ICE config for clients. Optional ICE_SERVERS_JSON env:
 * [{"urls":"stun:..."},{"urls":"turn:...","username":"u","credential":"p"}]
 */
export async function getRtcConfigForClient() {
  const staticConfig = staticIceConfig();
  if (staticConfig) return staticConfig;
  try {
    const cloudflareConfig = await cloudflareTurnConfig();
    if (cloudflareConfig) return cloudflareConfig;
  } catch (error) {
    console.warn('Cloudflare TURN unavailable; using default STUN', error.message);
  }
  return { iceServers: DEFAULT_ICE_SERVERS, relayConfigured: false };
}
