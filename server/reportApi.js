import express from 'express';
import admin from 'firebase-admin';

const REPORT_COOLDOWN_MS = 90_000;
const lastReportByUser = new Map();

function cleanString(value, maxLength) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function authenticatedUser(req) {
  const match = String(req.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  try {
    return await admin.auth().verifyIdToken(match[1].trim(), true);
  } catch {
    return null;
  }
}

function buildReport(user, body) {
  const category = cleanString(body?.category, 40).toLowerCase();
  if (!['harassment', 'spam', 'other'].includes(category)) {
    throw new Error('Choose a valid report reason.');
  }

  const details = cleanString(body?.details, 2000);
  if (!details) throw new Error('Please add a short description.');

  const reportContext = ['profile', 'message'].includes(body?.reportContext)
    ? body.reportContext
    : 'debate';
  const report = {
    reporterUid: user.uid,
    reporterEmail: cleanString(user.email, 320).toLowerCase() || null,
    topicId: cleanString(body?.topicId, 200),
    roomId: cleanString(body?.roomId, 256) || null,
    yourSide: body?.yourSide === 'disagree' ? 'disagree' : 'agree',
    category,
    details,
    reportContext,
    status: 'open',
    staffResponse: null,
    respondedAt: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const peerUid = cleanString(body?.peerUid, 128);
  if (peerUid) report.peerUid = peerUid;
  if (body?.matchMode === 'quick' || body?.matchMode === 'custom') {
    report.matchMode = body.matchMode;
  }

  if (reportContext === 'profile') {
    const snapshot = body?.profileSnapshot || {};
    const avatar = cleanString(snapshot.avatarUrl, 2000);
    report.profileSnapshot = {
      displayName: cleanString(snapshot.displayName, 40),
      bio: cleanString(snapshot.bio, 500),
      avatarUrl: avatar.startsWith('data:') ? '[uploaded profile image]' : avatar,
    };
  } else if (reportContext === 'message') {
    const snapshot = body?.messageSnapshot || {};
    report.messageSnapshot = {
      text: cleanString(snapshot.text, 2000),
      sentAtMs: Number(snapshot.sentAtMs) || null,
      authorUid: cleanString(snapshot.authorUid || peerUid, 128) || null,
    };
  }

  return report;
}

async function sendConfirmationEmail({ to, reportId, category, reportContext }) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.REPORT_EMAIL_FROM || '').trim();
  if (!apiKey || !from || !to) return false;

  const replyTo = String(process.env.REPORT_EMAIL_REPLY_TO || '').trim();
  const typeLabel = reportContext === 'message'
    ? 'chat message'
    : reportContext === 'profile'
      ? 'profile'
      : 'debate';
  const reasonLabel = category.charAt(0).toUpperCase() + category.slice(1);
  const subject = 'We received your Hot Take report';
  const text = [
    'Hi,',
    '',
    'We received your report and sent it to the Hot Take moderation team for review.',
    `Report ID: ${reportId}`,
    `Report type: ${typeLabel}`,
    `Reason: ${reasonLabel}`,
    '',
    'You do not need to submit the same report again. We may contact you if we need more information.',
    '',
    'Hot Take Support',
  ].join('\n');
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#17171b;max-width:620px;margin:auto">
      <h1 style="font-size:24px">We received your report.</h1>
      <p>It has been sent to the Hot Take moderation team for review.</p>
      <div style="border:1px solid #e3e3e8;border-radius:10px;padding:16px;margin:20px 0">
        <div><strong>Report ID:</strong> ${escapeHtml(reportId)}</div>
        <div><strong>Report type:</strong> ${escapeHtml(typeLabel)}</div>
        <div><strong>Reason:</strong> ${escapeHtml(reasonLabel)}</div>
      </div>
      <p>You do not need to submit the same report again. We may contact you if we need more information.</p>
      <p>Hot Take Support</p>
    </div>`;

  const payload = { from, to: [to], subject, text, html };
  if (replyTo) payload.reply_to = replyTo;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `report-confirmation/${reportId}`,
      'User-Agent': 'HotTakeDebate/1.0',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    const responseText = await response.text().catch(() => '');
    throw new Error(`Resend returned ${response.status}: ${responseText.slice(0, 300)}`);
  }
  return true;
}

export function attachReportRoutes(app, { isAdminReady }) {
  const router = express.Router();

  router.post('/', async (req, res) => {
    if (!isAdminReady()) return res.status(503).json({ error: 'Reporting is temporarily unavailable.' });
    const user = await authenticatedUser(req);
    if (!user) return res.status(401).json({ error: 'Sign in to send a report.' });
    if (user.email_verified !== true) {
      return res.status(403).json({ error: 'Verify your email address before sending a report.' });
    }

    const remaining = REPORT_COOLDOWN_MS - (Date.now() - (lastReportByUser.get(user.uid) || 0));
    if (remaining > 0) {
      return res.status(429).json({
        error: `Please wait ${Math.max(1, Math.ceil(remaining / 1000))} seconds before sending another report.`,
      });
    }

    let report;
    try {
      report = buildReport(user, req.body);
    } catch (error) {
      return res.status(400).json({ error: error.message || 'This report is not valid.' });
    }

    try {
      const reportRef = await admin.firestore().collection('reports').add(report);
      lastReportByUser.set(user.uid, Date.now());

      let confirmationEmailSent = false;
      try {
        confirmationEmailSent = await sendConfirmationEmail({
          to: report.reporterEmail,
          reportId: reportRef.id,
          category: report.category,
          reportContext: report.reportContext,
        });
      } catch (error) {
        console.warn('[reports] Confirmation email failed:', error?.message ?? error);
      }

      return res.status(201).json({ id: reportRef.id, confirmationEmailSent });
    } catch (error) {
      console.error('[reports] Submission failed:', error?.message ?? error);
      return res.status(500).json({ error: 'Your report could not be saved. Please try again.' });
    }
  });

  app.use('/api/reports', router);
}
