// api/run-check.js
const { connect } = require('./_db');
const QR = require('./models/QR');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end('Method Not Allowed');

  const secret = req.headers['x-job-secret'];
  if (!secret || secret !== process.env.JOB_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  await connect();

  try {
    const now = new Date();
    const active = await QR.find({ expiresAt: { $gt: now }, flagged: false }).exec();
    let flaggedCount = 0;
    for (const qr of active) {
      const last = (qr.scanHistory && qr.scanHistory.length) ? qr.scanHistory[qr.scanHistory.length - 1].time : qr.createdAt;
      if (now.getTime() - new Date(last).getTime() > 3 * 60 * 60 * 1000) {
        qr.flagged = true;
        await qr.save();
        flaggedCount++;
      }
    }
    return res.json({ ok: true, checked: active.length, flagged: flaggedCount });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'server error' });
  }
};
