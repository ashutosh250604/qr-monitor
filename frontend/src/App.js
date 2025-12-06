import React, { useState, useEffect, useRef } from "react";
import "./App.css";

// relative API
const API_BASE = process.env.REACT_APP_API_BASE || "";

function formatDateIsoToDDMMYYYY(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString();
}

function timeRemainingParts(targetIso) {
  if (!targetIso) return null;
  const now = new Date().getTime();
  const target = new Date(targetIso).getTime();
  let diff = Math.max(0, target - now);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  diff -= days * 1000 * 60 * 60 * 24;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  diff -= hours * 1000 * 60 * 60;
  const minutes = Math.floor(diff / (1000 * 60));
  diff -= minutes * 1000 * 60;
  const seconds = Math.floor(diff / 1000);
  return { days, hours, minutes, seconds, totalMs: (new Date(targetIso).getTime() - new Date().getTime()) };
}

function StatusBadge({ qr }) {
  const now = new Date();
  const expiresAt = qr.expiresAt ? new Date(qr.expiresAt) : null;
  if (expiresAt && expiresAt < now) return <span className="badge badge-expired">Expired</span>;
  if (qr.flagged) return <span className="badge badge-flagged">Flagged</span>;
  return <span className="badge badge-active">Active</span>;
}

export default function App() {
  // tabs
  const [activeTab, setActiveTab] = useState("dashboard"); // default to dashboard

  // form
  const [companyName, setCompanyName] = useState("");
  const [location, setLocation] = useState("");
  const [contact, setContact] = useState("");
  const [purpose, setPurpose] = useState("");
  const [expiresInHours, setExpiresInHours] = useState(12);
  const [flagThresholdHours, setFlagThresholdHours] = useState(3);

  // UI
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(null); // created doc shown in modal
  const [error, setError] = useState(null);
  const [detailQr, setDetailQr] = useState(null); // object for View modal
  const countdownTimerRef = useRef(null);
  const [countdownParts, setCountdownParts] = useState(null);

  // Load list
  const loadList = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/qrs`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      let normalized = [];
      if (Array.isArray(data)) normalized = data;
      else if (data && data.ok && Array.isArray(data.docs)) normalized = data.docs;
      else normalized = [];
      // normalize fields
      normalized = normalized.map(it => ({
        qrId: it.qrId || it._id || null,
        companyName: it.companyName || "-",
        extraFields: it.extraFields || {},
        createdAt: it.createdAt || it.created || null,
        expiresAt: it.expiresAt || null,
        flagged: !!it.flagged,
        scanHistory: Array.isArray(it.scanHistory) ? it.scanHistory : [],
        dataUrl: it.dataUrl || null,
        expireDurationHours: it.expireDurationHours || 12,
        flagThresholdHours: it.flagThresholdHours || 3,
        scanCount: it.scanCount || (Array.isArray(it.scanHistory) ? it.scanHistory.length : 0)
      }));
      setList(normalized);
    } catch (err) {
      console.error(err);
      setError("Could not load list");
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadList(); }, []);

  // generate
  const handleGenerate = async (e) => {
    e.preventDefault();
    setError(null);
    if (!companyName.trim()) {
      setError("Company name required");
      return;
    }
    const payload = {
      companyName: companyName.trim(),
      extraFields: { location: location.trim(), contact: contact.trim(), purpose: purpose.trim() },
      expiresInHours: Number(expiresInHours || 12),
      flagThresholdHours: Number(flagThresholdHours || 3)
    };
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/qrs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const txt = await res.text().catch(()=>null);
        throw new Error(txt || "Server error");
      }
      const r = await res.json();
      const doc = r && r.doc ? r.doc : r;
      setGenerated(doc);
      setCompanyName(""); setLocation(""); setContact(""); setPurpose("");
      setExpiresInHours(12); setFlagThresholdHours(3);
      await loadList();
      // switch back to dashboard? keep as-is: stay on Generate but modal visible
    } catch (err) {
      console.error(err);
      setError("Failed to generate QR");
    } finally {
      setLoading(false);
    }
  };

  // countdown for generated/existing QR
  useEffect(() => {
    // update countdownParts every second when a doc with expiresAt exists
    function startCountdown(expiresAt) {
      if (!expiresAt) { setCountdownParts(null); return; }
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      const tick = () => setCountdownParts(timeRemainingParts(expiresAt));
      tick();
      countdownTimerRef.current = setInterval(tick, 1000);
    }
    if (generated && generated.expiresAt) startCountdown(generated.expiresAt);
    else if (detailQr && detailQr.expiresAt) startCountdown(detailQr.expiresAt);
    else {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      setCountdownParts(null);
    }
    return () => { if (countdownTimerRef.current) clearInterval(countdownTimerRef.current); }
  }, [generated, detailQr]);

  // View modal: load full doc (with dataUrl and scanHistory)
  const openView = async (qrId) => {
    if (!qrId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/qrs?qrId=${encodeURIComponent(qrId)}`);
      if (!res.ok) throw new Error("Failed to load QR");
      const json = await res.json();
      const doc = json && json.doc ? json.doc : null;
      setDetailQr(doc);
      // ensure countdown hooks pick this up
    } catch (err) {
      console.error(err);
      setError("Failed to load details");
    } finally {
      setLoading(false);
    }
  };

  // Download/print helpers
  const downloadDataUrl = (dataUrl, filename = 'qr.png') => {
    if (!dataUrl) { alert('No QR image'); return; }
    const a = document.createElement('a'); a.href = dataUrl; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  };
  const printDataUrl = (dataUrl) => {
    if (!dataUrl) { alert('No QR image'); return; }
    const w = window.open(''); w.document.write(`<img src="${dataUrl}" onload="window.print();window.close()" />`); w.document.close();
  };

  return (
    <div className="app-root">
      <header className="topbar">
        <div className="brand">QR Monitor</div>
        <nav>
          <button className={`link-btn ${activeTab==="dashboard" ? "active": ""}`} onClick={() => setActiveTab("dashboard")}>Dashboard</button>
          <button className={`link-btn ${activeTab==="generate" ? "active": ""}`} onClick={() => setActiveTab("generate")}>+ Generate QR</button>
        </nav>
      </header>

      <main className="page">
        <h1>{activeTab === "generate" ? "Generate QR Code" : "Dashboard"}</h1>
        <p className="muted">{activeTab === "generate" ? "Create a new QR code. Expiry starts after first scan." : "Overview of QR codes and stats."}</p>

        <section className="grid">
          {/* Show form only when Generate tab active */}
          {activeTab === "generate" && (
            <div className="card form-card">
              <h2>QR Code Details</h2>
              <p className="muted">Fields marked * are required.</p>

              {error && <div className="alert">{error}</div>}

              <form onSubmit={handleGenerate} className="form-grid">
                <div className="field">
                  <label>Company Name *</label>
                  <input placeholder="e.g., XYZ Corporation" value={companyName} onChange={(e)=>setCompanyName(e.target.value)} required />
                </div>
                <div className="field">
                  <label>Contact Person</label>
                  <input placeholder="e.g., John Doe" value={contact} onChange={(e)=>setContact(e.target.value)} />
                </div>
                <div className="field">
                  <label>Location / Branch</label>
                  <input placeholder="e.g., New York Office" value={location} onChange={(e)=>setLocation(e.target.value)} />
                </div>
                <div className="field">
                  <label>Purpose</label>
                  <input placeholder="e.g., Visitor Access" value={purpose} onChange={(e)=>setPurpose(e.target.value)} />
                </div>

                <div className="field">
                  <label>Expires after first scan (hours)</label>
                  <input type="number" min="1" value={expiresInHours} onChange={(e)=>setExpiresInHours(e.target.value)} />
                </div>
                <div className="field">
                  <label>Flag threshold (hours)</label>
                  <input type="number" min="1" value={flagThresholdHours} onChange={(e)=>setFlagThresholdHours(e.target.value)} />
                </div>

                <div className="submit-row">
                  <button className="primary" type="submit" disabled={loading}>{loading ? "Generating..." : "Generate QR Code"}</button>
                </div>
              </form>
            </div>
          )}

          {/* Show list only when Dashboard tab active */}
          {activeTab === "dashboard" && (
            <div className="card list-card" style={{ gridColumn: "1 / -1" }}>
              <h2>All QRs</h2>
              {loading && <div className="muted">Loading...</div>}
              {!loading && (
                <>
                  <div className="metrics-row">
                    <div className="metric"><div className="metric-value">{list.length}</div><div className="metric-label">Total</div></div>
                    <div className="metric"><div className="metric-value">{list.filter(q => !q.flagged && (!q.expiresAt || new Date(q.expiresAt) > new Date())).length}</div><div className="metric-label">Active</div></div>
                    <div className="metric"><div className="metric-value">{list.filter(q => q.flagged).length}</div><div className="metric-label">Flagged</div></div>
                    <div className="metric"><div className="metric-value">{list.filter(q => q.expiresAt && new Date(q.expiresAt) < new Date()).length}</div><div className="metric-label">Expired</div></div>
                  </div>

                  <table className="qr-table">
                    <thead>
                      <tr><th>Company</th><th>Location</th><th>Purpose</th><th>Created</th><th>Last Scan</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {list.map(row => (
                        <tr key={row.qrId || row._id}>
                          <td>{row.companyName}</td>
                          <td>{row.extraFields?.location || "-"}</td>
                          <td>{row.extraFields?.purpose || "-"}</td>
                          <td>{formatDateIsoToDDMMYYYY(row.createdAt)}</td>
                          <td>{(row.scanHistory && row.scanHistory.length) ? formatDateTime(row.scanHistory[row.scanHistory.length - 1].time) : "Never"}</td>
                          <td><StatusBadge qr={row} /></td>
                          <td><button className="btn-light" onClick={() => openView(row.qrId)}>View</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>
          )}
        </section>

        {/* Generated QR modal */}
        {generated && (
          <div className="modal-bg" onClick={() => setGenerated(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>QR Code Generated</h3>
                <button className="close" onClick={() => setGenerated(null)}>×</button>
              </div>
              <div className="modal-body">
                <div className="qr-box">
                  <img src={generated.dataUrl} alt="QR" />
                </div>
                <div className="qr-meta">
                  <div className="muted">Created</div>
                  <div className="meta-value">{formatDateTime(generated.createdAt)}</div>

                  <div className="muted">Expires</div>
                  <div className="meta-value">
                    {generated.expiresAt ? (
                      <>
                        {formatDateTime(generated.expiresAt)}
                        {countdownParts && countdownParts.totalMs > 0 && (
                          <div className="muted">
                            {countdownParts.days}d {countdownParts.hours}h {countdownParts.minutes}m {countdownParts.seconds}s
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="muted">Starts after first scan (configured {generated.expireDurationHours} hrs)</div>
                    )}
                  </div>

                  <div className="muted">Company</div>
                  <div className="meta-value">{generated.companyName}</div>

                  <div className="muted">Location</div>
                  <div className="meta-value">{generated.extraFields?.location || "-"}</div>

                  <div className="muted">Purpose</div>
                  <div className="meta-value">{generated.extraFields?.purpose || "-"}</div>

                  <div className="muted">Flag threshold</div>
                  <div className="meta-value">{generated.flagThresholdHours || 3} hours (will flag if not rescanned)</div>

                  <div className="modal-actions">
                    <button onClick={() => downloadDataUrl(generated.dataUrl, `${generated.qrId}.png`)}>Download PNG</button>
                    <button onClick={() => printDataUrl(generated.dataUrl)}>Print</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View modal */}
        {detailQr && (
          <div className="modal-bg" onClick={() => setDetailQr(null)}>
            <div className="modal wide" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>QR Details</h3>
                <button className="close" onClick={() => setDetailQr(null)}>×</button>
              </div>
              <div className="modal-body two-col">
                <div className="left">
                  <div className="qr-box">
                    <img src={detailQr.dataUrl} alt="QR" />
                  </div>
                  <div className="info">
                    <div><strong>QR ID:</strong> <span className="muted">{detailQr.qrId}</span></div>
                    <div><strong>Created:</strong> <span className="muted">{formatDateIsoToDDMMYYYY(detailQr.createdAt)}</span></div>
                    <div><strong>Expires:</strong> <span className="muted">{detailQr.expiresAt ? formatDateTime(detailQr.expiresAt) : "Starts after first scan"}</span></div>
                    <div><strong>Total Scans:</strong> <span className="muted">{detailQr.scanCount || (detailQr.scanHistory && detailQr.scanHistory.length) || 0}</span></div>
                  </div>
                </div>

                <div className="right">
                  <h4>Scan History</h4>
                  {detailQr.scanHistory && detailQr.scanHistory.length ? (
                    <ul className="history-list">
                      {detailQr.scanHistory.map((s,i) => <li key={i}>{formatDateTime(s.time)} — {s.userAgent || ""} — {s.ip || ""}</li>)}
                    </ul>
                  ) : <div className="muted">No scans recorded yet</div>}
                </div>
              </div>

              <div className="modal-actions">
                <button onClick={() => setDetailQr(null)}>Close</button>
                <button onClick={() => downloadDataUrl(detailQr.dataUrl, `${detailQr.qrId}.png`)}>Download</button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
