import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code } = req.query;
  if (!code || typeof code !== 'string') {
    return res.status(400).send('Missing share code');
  }

  const upperCode = code.toUpperCase();

  // Look up the share record
  const { data: share, error: shareError } = await supabase
    .from('spot_shares')
    .select('spot_payload, expires_at, claimed_by')
    .eq('code', upperCode)
    .single();

  // PGRST116 = "no rows returned" — valid not-found, not a real error
  if (shareError && shareError.code !== 'PGRST116') {
    console.error('[spot-share] query failed:', shareError.message);
    const html = buildSharePage(upperCode, 'A Fishing Spot', false, false, true);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  }

  const notFound = !share;
  const expired = share ? new Date(share.expires_at) < new Date() : false;
  const claimed = share?.claimed_by != null;
  const spotName = share?.spot_payload?.name ?? 'A Fishing Spot';

  const html = buildSharePage(upperCode, spotName, notFound, expired, claimed, false);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(html);
}

function buildSharePage(
  code: string,
  spotName: string,
  notFound: boolean,
  expired: boolean,
  claimed: boolean,
  unavailable: boolean
): string {
  const appStoreUrl = 'https://apps.apple.com/app/bitesignal/id6760796117';
  const playStoreUrl = 'https://play.google.com/store/apps/details?id=io.makolabs.bitesignal';
  const deepLink = `bitesignal://share/${code}`;

  const statusMessage = unavailable
    ? "We couldn't load this spot right now. Please try again in a moment."
    : notFound
      ? 'This share link could not be found. Please check the code and try again.'
      : expired
        ? 'This share link has expired.'
        : claimed
          ? 'Someone already added this spot.'
          : `Someone shared a fishing spot with you!`;

  const showActions = !notFound && !expired && !claimed && !unavailable;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(spotName)} — BiteSignal</title>

  <!-- Open Graph for link previews -->
  <meta property="og:title" content="${escapeHtml(spotName)} — BiteSignal" />
  <meta property="og:description" content="${showActions ? 'Open in BiteSignal to claim this fishing spot!' : statusMessage}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://bite-signal.com/share/${code}" />

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
    .spot-name {
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
    .download-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 16px;
    }
    .download-label {
      font-size: 14px;
      color: #64748b;
      margin-bottom: 4px;
    }
    .divider {
      color: #475569;
      font-size: 13px;
      margin: 8px 0 12px;
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

    ${!showActions ? `
      <div class="expired-icon">${unavailable ? '⚠️' : notFound ? '🔍' : expired ? '⏱️' : '✅'}</div>
      <div class="spot-name">${escapeHtml(spotName)}</div>
      <div class="status">${statusMessage}</div>
    ` : `
      <div class="spot-name">${escapeHtml(spotName)}</div>
      <div class="status">${statusMessage}</div>

      <div class="code-box">
        <div class="code-label">Share Code</div>
        <div class="code-value">${code}</div>
      </div>

      <div class="download-section">
        <p class="download-label">Download the free app to claim this spot</p>
        <a href="${appStoreUrl}" class="btn btn-primary" id="btn-ios">Download for iPhone</a>
        <a href="${playStoreUrl}" class="btn btn-primary" id="btn-android">Download for Android</a>
        <a href="${appStoreUrl}" class="btn btn-primary" id="btn-desktop">Download BiteSignal</a>
      </div>
      <div class="divider">Already have BiteSignal?</div>
      <a href="javascript:void(0)" onclick="openApp()" class="btn btn-store">Open in BiteSignal</a>
    `}
  </div>
  <script>
    (function () {
      var ua = navigator.userAgent;
      var isIOS = /iPad|iPhone|iPod/.test(ua);
      var isAndroid = /Android/.test(ua);
      var btnIOS = document.getElementById('btn-ios');
      var btnAndroid = document.getElementById('btn-android');
      var btnDesktop = document.getElementById('btn-desktop');
      if (btnIOS) btnIOS.style.display = isIOS ? 'block' : 'none';
      if (btnAndroid) btnAndroid.style.display = isAndroid ? 'block' : 'none';
      if (btnDesktop) btnDesktop.style.display = (!isIOS && !isAndroid) ? 'block' : 'none';

      window.openApp = function () {
        if (isAndroid) {
          var intentUrl = 'intent://share/${code}#Intent;scheme=bitesignal;package=io.makolabs.bitesignal;S.browser_fallback_url=' + encodeURIComponent('${playStoreUrl}') + ';end';
          window.location.href = intentUrl;
          return;
        }
        window.location.href = '${deepLink}';
        if (isIOS) {
          var t = setTimeout(function () { window.location.href = '${appStoreUrl}'; }, 1500);
          document.addEventListener('visibilitychange', function () { if (document.hidden) clearTimeout(t); });
        }
      };
    })();
  </script>
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
