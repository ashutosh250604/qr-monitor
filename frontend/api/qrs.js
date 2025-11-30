// api/qrs.js
const { connect } = require('./_db');
const QR = require('./models/QR');
const QRCode = require('qrcode');
const { nanoid } = require('nanoid');

module.exports = async (req, res) => {
  await connect();

  if (req.method === 'POST') {
    try {
      const { companyName, extraFields } = req.body || {};
      if (!companyName) return res.status(400).json({ error: 'companyName required' });

      const qrId = nanoid(10);
      const createdAt = new Date();
      const expiresAt = new Date(createdAt.getTime() + 12 * 60 * 60 * 1000);

      const doc = new QR({ qrId, companyName, extraFields: extraFields || {}, createdAt, expiresAt });
      await doc.save();

      const base = process.env.BASE_URL || `https://${req.headers.host}`;
      const scanUrl = `${base}/api/scan?qrId=${qrId}`;
      const dataUrl = await QRCode.toDataURL(scanUrl);

      res.json({ qrId, dataUrl, createdAt, expiresAt });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'server error' });
    }
    return;
  }

  if (req.method === 'GET') {
    try {
      const list = await QR.find().sort({ createdAt: -1 }).lean();
      return res.json(list);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'server error' });
    }
  }

  res.setHeader('Allow', 'GET,POST');
  res.status(405).end('Method Not Allowed');
};
