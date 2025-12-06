// frontend/api/scan.js
const { connect } = require('./_db');
const QR = require('./models/QR');
const { setCorsHeaders, handlePreflight } = require('./_cors');

module.exports = async (req, res) => {
  setCorsHeaders(res, '*');
  if (handlePreflight(req, res)) return;

  await connect();

  const acceptJson = (req.query && req.query.json === '1') || (req.headers.accept && req.headers.accept.includes('application/json'));
  const qrId = req.query.qrId || (req.body && req.body.qrId);
  if (!qrId) {
    if (acceptJson) return res.status(400).json({ error: 'qrId required' });
    return res.status(400).send('<h2>No qrId provided</h2>');
  }

  try {
    const qr = await QR.findOne({ qrId });
    if (!qr) {
      if (acceptJson) return res.status(404).json({ error: 'QR not found' });
      return res.status(404).send('<h2>QR not found</h2>');
    }

    // If list requested: ?json=1&list=1
    if (req.method === 'GET' && (req.query.list === '1' || (acceptJson && req.query.list === '1'))) {
      const docs = (qr.scanHistory || []).slice().sort((a,b)=> new Date(b.time)-new Date(a.time));
      return res.json({ ok: true, scans: docs });
    }

    // record scan (default behaviour)
    const now = new Date();

    // If this is the **first** scan and expiresAt is null, start expiry countdown now.
    let firstScanStarted = false;
    if (!qr.expiresAt) {
      const duration = Number(qr.expireDurationHours || 12);
      qr.expiresAt = new Date(now.getTime() + duration * 60 * 60 * 1000);
      firstScanStarted = true;
    }

    const scanObj = {
      time: now,
      userAgent: req.headers['user-agent'] || (req.body && req.body.userAgent) || '',
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress || (req.body && req.body.ip) || ''
    };

    qr.scanHistory.push(scanObj);
    await qr.save();

    if (acceptJson) {
      return res.json({ ok: true, scan: scanObj, scanCount: qr.scanHistory.length, firstScanStarted, expiresAt: qr.expiresAt });
    }

    // default HTML response for scanner devices
    res.send(`<h2>Scan recorded for ${qr.companyName}</h2><p>Time: ${now.toISOString()}</p>`);
  } catch (err) {
    console.error('scan error:', err);
    if (acceptJson) return res.status(500).json({ error: 'Server error', details: err.message });
    return res.status(500).send('<h2>Server error</h2>');
  }
};
