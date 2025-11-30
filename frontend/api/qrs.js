// frontend/api/qrs.js
const { connect } = require('./_db');
const QR = require('./models/QR');
const QRCode = require('qrcode');

module.exports = async (req, res) => {
  await connect();

  if (req.method === 'POST') {
    try {
      const { companyName, extraFields } = req.body || {};
      if (!companyName) return res.status(400).json({ error: 'companyName required' });

      // dynamic import for nanoid (ESM-only in newer versions)
      const { nanoid } = await import('nanoid');

      const qrId = typeof nanoid === 'function' ? nanoid(10) : String(Date.now()).slice(-10);
      const createdAt = new Date();
      const expiresAt = new Date(createdAt.getTime() + 12 * 60 * 60 * 1000);

      const doc = new QR({ qrId, companyName, extraFields: extraFields || {}, createdAt, expiresAt });
      await doc.save();

      const base = process.env.BASE_URL || `https://${req.headers.host}`;
      const scanUrl = `${base}/api/scan?qrId=${qrId}`;
      const dataUrl = await QRCode.toDataURL(scanUrl);

      return res.json({ qrId, dataUrl, createdAt, expiresAt });
    } catch (err) {
      console.error('qrs POST error:', err);
      return res.status(500).json({ error: 'server error', details: err.message });
    }
  }

  if (req.method === 'GET') {
    try {
      const list = await QR.find().sort({ createdAt: -1 }).lean();
      return res.json(list);
    } catch (err) {
      console.error('qrs GET error:', err);
      return res.status(500).json({ error: 'server error', details: err.message });
    }
  }

  res.setHeader('Allow', 'GET,POST');
  res.status(405).end('Method Not Allowed');
};
