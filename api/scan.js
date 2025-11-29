// api/scan.js
const { connect } = require('./_db');
const QR = require('./models/QR');

module.exports = async (req, res) => {
  await connect();

  // prefer query param ?qrId=xxx
  const qrId = req.query.qrId;
  if (!qrId) return res.status(400).send('<h2>No qrId provided</h2>');

  try {
    const qr = await QR.findOne({ qrId });
    if (!qr) return res.status(404).send('<h2>QR not found</h2>');

    const now = new Date();
    if (now > qr.expiresAt) return res.send('<h2>QR expired</h2>');

    qr.scanHistory.push({ time: now, userAgent: req.headers['user-agent'] || '', ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress });
    await qr.save();

    res.send(`<h2>Scan recorded for ${qr.companyName}</h2><p>Time: ${now.toISOString()}</p>`);
  } catch (err) {
    console.error(err);
    res.status(500).send('<h2>Server error</h2>');
  }
};
