// frontend/api/qrs.js
const { connect } = require('./_db');
const QR = require('./models/QR');
const QRCode = require('qrcode');
const { setCorsHeaders, handlePreflight } = require('./_cors');

module.exports = async (req, res) => {
  // CORS
  setCorsHeaders(res, '*');
  if (handlePreflight(req, res)) return;

  await connect();

  if (req.method === 'POST') {
    try {
      const { companyName, extraFields, location, note, expiresInHours } = req.body || {};
      if (!companyName) return res.status(400).json({ error: 'companyName required' });

      // dynamic import for nanoid (ESM-only in newer versions)
      const { nanoid } = await import('nanoid');

      const qrId = typeof nanoid === 'function' ? nanoid(10) : String(Date.now()).slice(-10);
      const createdAt = new Date();
      const expiresAt = new Date(createdAt.getTime() + (Number(expiresInHours || 12) * 60 * 60 * 1000));

      const doc = new QR({
        qrId,
        companyName,
        extraFields: { ...(extraFields || {}), location, note },
        createdAt,
        expiresAt
      });
      await doc.save();

      const base = process.env.BASE_URL || `https://${req.headers.host}`;
      const scanUrl = `${base}/api/scan?qrId=${encodeURIComponent(qrId)}`;
      const dataUrl = await QRCode.toDataURL(scanUrl);

      // Return sanitized doc + dataUrl
      const out = {
        qrId: doc.qrId,
        companyName: doc.companyName,
        extraFields: doc.extraFields,
        createdAt: doc.createdAt,
        expiresAt: doc.expiresAt,
        flagged: doc.flagged,
        scanCount: doc.scanHistory ? doc.scanHistory.length : 0,
        dataUrl
      };

      return res.status(201).json({ ok: true, doc: out });
    } catch (err) {
      console.error('qrs POST error:', err);
      return res.status(500).json({ error: 'server error', details: err.message });
    }
  }

  if (req.method === 'GET') {
    try {
      const { qrId, id, limit = 200 } = req.query || {};
      if (qrId || id) {
        let doc = null;
        if (qrId) {
          doc = await QR.findOne({ qrId }).lean();
        }
        if (!doc && id) {
          try {
            doc = await QR.findById(id).lean();
          } catch (e) {
            doc = null;
          }
        }
        if (!doc) return res.status(404).json({ ok: false, error: 'Not found' });

        const out = {
          qrId: doc.qrId,
          companyName: doc.companyName,
          extraFields: doc.extraFields,
          createdAt: doc.createdAt,
          expiresAt: doc.expiresAt,
          flagged: doc.flagged,
          scanCount: doc.scanHistory ? doc.scanHistory.length : 0,
          scanHistory: doc.scanHistory || []
        };
        return res.json({ ok: true, doc: out });
      } else {
        const list = await QR.find().sort({ createdAt: -1 }).limit(Number(limit)).lean();
        const summary = list.map(doc => ({
          qrId: doc.qrId,
          companyName: doc.companyName,
          extraFields: doc.extraFields,
          createdAt: doc.createdAt,
          expiresAt: doc.expiresAt,
          flagged: doc.flagged,
          scanCount: doc.scanHistory ? doc.scanHistory.length : 0,
          // keep dataUrl null for listing to avoid heavy payloads; frontend will request or generate
        }));
        return res.json({ ok: true, docs: summary });
      }
    } catch (err) {
      console.error('qrs GET error:', err);
      return res.status(500).json({ error: 'server error', details: err.message });
    }
  }

  res.setHeader('Allow', 'GET,POST,OPTIONS');
  res.status(405).end('Method Not Allowed');
};
