import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code } = req.query;
  if (!code || typeof code !== 'string') {
    return res.status(400).send('Missing invite code');
  }

  const upperCode = code.toUpperCase();

  // Look up the invite record
  const { data: invite } = await supabase
    .from('trip_invites')
    .select('trip_id, expires_at, max_uses, use_count')
    .eq('code', upperCode)
    .single();

  // Look up the trip name if invite exists
  let tripName = 'A Fishing Trip';
  if (invite?.trip_id) {
    const { data: trip } = await supabase
      .from('trips')
      .select('name')
      .eq('id', invite.trip_id)
      .single();
    if (trip?.name) tripName = trip.name;
  }

  const expired = !invite || new Date(invite.expires_at) < new Date();
  const full = invite ? invite.max_uses > 0 && invite.use_count >= invite.max_uses : false;

  // Rebuild the canonical URL the user actually visited so the og:url matches.
  // The rewrite in vercel.json routes both /trip/:code and /trip/join/:code
  // to this handler — req.url reflects the post-rewrite path (/api/trip/...),
  // so we use the Host header + a fallback to reconstruct the public URL.
  const host = (req.headers['x-forwarded-host'] ?? req.headers.host) as string | undefined;
  const originalPath =
    (req.headers['x-original-url'] as string | undefined) ??
    (typeof req.url === 'string' && req.url.startsWith('/api/trip/')
      ? `/trip/join/${upperCode}`
      : req.url ?? `/trip/join/${upperCode}`);
  const canonicalUrl = host ? `https://${host}${originalPath}` : `https://bite-signal.com/trip/join/${upperCode}`;

  const html = buildTripPage(upperCode, tripName, expired, full, canonicalUrl);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}

function buildTripPage(
  code: string,
  tripName: string,
  expired: boolean,
  full: boolean,
  canonicalUrl: string,
): string {
  const appStoreUrl = 'https://apps.apple.com/app/bitesignal/id6760796117';
  const playStoreUrl = 'https://play.google.com/store/apps/details?id=io.makolabs.bitesignal';
  const deepLink = `bitesignal://trip/join/${code}`;

  const statusMessage = expired
    ? 'This invite link has expired.'
    : full
      ? 'This trip is full.'
      : `You've been invited to join a fishing trip!`;

  const showActions = !expired && !full;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(tripName)} — BiteSignal</title>

  <meta property="og:title" content="Join "${escapeHtml(tripName)}" on BiteSignal" />
  <meta property="og:description" content="${showActions ? 'Open in BiteSignal to join this fishing trip!' : statusMessage}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${canonicalUrl}" />

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a1628;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #1a2744;
      border-radius: 20px;
      padding: 40px 32px;
      max-width: 400px;
      width: 100%;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    }
    .logo {
      font-size: 28px;
      font-weight: 700;
      color: #38bdf8;
      letter-spacing: -0.5px;
      margin-bottom: 24px;
    }
    .trip-name {
      font-size: 22px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .status {
      color: #94a3b8;
      font-size: 15px;
      margin-bottom: 28px;
      line-height: 1.5;
    }
    .code-box {
      background: #0f1d32;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 28px;
    }
    .code-label {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 6px;
    }
    .code-value {
      font-size: 32px;
      font-weight: 700;
      letter-spacing: 4px;
      color: #38bdf8;
      font-family: 'SF Mono', 'Fira Code', monospace;
    }
    .buttons {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .btn {
      display: block;
      padding: 14px 24px;
      border-radius: 12px;
      text-decoration: none;
      font-size: 16px;
      font-weight: 600;
      transition: opacity 0.15s;
    }
    .btn:hover { opacity: 0.85; }
    .btn-primary {
      background: #38bdf8;
      color: #0a1628;
    }
    .btn-store {
      background: #1e3a5f;
      color: #e2e8f0;
    }
    .divider {
      color: #475569;
      font-size: 13px;
      margin: 4px 0;
    }
    .expired-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">BITESIGNAL</div>

    ${expired || full ? `
      <div class="expired-icon">${expired ? '⏱️' : '🎣'}</div>
      <div class="trip-name">${escapeHtml(tripName)}</div>
      <div class="status">${statusMessage}</div>
    ` : `
      <div class="trip-name">${escapeHtml(tripName)}</div>
      <div class="status">${statusMessage}</div>

      <div class="code-box">
        <div class="code-label">Invite Code</div>
        <div class="code-value">${code}</div>
      </div>

      <div class="buttons">
        <a href="${deepLink}" class="btn btn-primary">Open in BiteSignal</a>
        <div class="divider">Don't have the app?</div>
        <a href="${appStoreUrl}" class="btn btn-store">Download for iPhone</a>
        <a href="${playStoreUrl}" class="btn btn-store">Download for Android</a>
      </div>
    `}
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
