// api/models/QR.js
const mongoose = require('mongoose');

const ScanSchema = new mongoose.Schema({
  time: { type: Date, default: Date.now },
  userAgent: String,
  ip: String
}, { _id: false });

const QRSchema = new mongoose.Schema({
  qrId: { type: String, required: true, unique: true },
  companyName: { type: String, required: true },
  extraFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  scanHistory: { type: [ScanSchema], default: [] },
  flagged: { type: Boolean, default: false }
});

module.exports = mongoose.models.QR || mongoose.model('QR', QRSchema);
