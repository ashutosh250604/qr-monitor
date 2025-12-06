import React, { useState, useEffect } from "react";
import "./App.css";

// Use relative API base by default to avoid cross-origin issues in preview deployments
const API_BASE = process.env.REACT_APP_API_BASE || "";

function formatDateIsoToDDMMYYYY(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatRelativeOrNever(iso) {
  if (!iso) return "Never";
  const d = new Date(iso);
  return d.toLocaleString();
}

function StatusBadge({ qr }) {
  const now = new Date();
  const expiresAt = qr.expiresAt ? new Date(qr.expiresAt) : null;
  if (expiresAt && expiresAt < now) return <span className="badge badge-expired">Expired</span>;
  if (qr.flagged) return <span className="badge badge-flagged">Flagged</span>;
  return <span className="badge badge-active">Active</span>;
}

export default function App() {
  // form state
  const [companyName, setCompanyName] = useState("");
  const [location, setLocation] = useState("");
  const [contact, setContact] = useState("");
  const [purpose, setPurpose] = useState("");

  // UI state
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(null);
  const [error, setError] = useState(null);
  const [detailRow, setDetailRow] = useState(null);

  // load list
  const loadList = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/qrs`);
      if (!res.ok) throw new Error("Failed to load list");
      const data = await res.json();
      // handle both legacy array and new {ok:true, docs:[]} formats
      if (Array.isArray(data)) setList(data);
      else if (data.ok && data.docs) setList(data.docs);
      else if (data.ok && data.doc) setList([data.doc]);
      else setList([]);
    } catch (err) {
      console.error(err);
      setError("Could not load QR list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
  }, []);

  // form validation and submit
  const handleGenerate = async (ev) => {
    ev.preventDefault();
    setError(null);

    if (!companyName.trim()) {
      setError("Company name is required");
      return;
    }

    const payload = {
      companyName: companyName.trim(),
      extraFields: {
        location: location.trim(),
        contact: contact.trim(),
        purpose: purpose.trim(),
      },
    };

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/qrs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Server error");
      }

      const data = await res.json();
      // new format: { ok: true, doc: { ... } }
      const doc = (data && data.doc) ? data.doc : data;
      setGenerated(doc);

      // reset the form (as requested)
      setCompanyName("");
      setLocation("");
      setContact("");
      setPurpose("");

      // reload list to show the new QR
      await loadList();
    } catch (err) {
      console.error("Create QR error:", err);
      setError("Failed to generate QR. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // Download QR PNG from dataUrl
  const downloadDataUrl = (dataUrl, filename = "qr.png") => {
    if (!dataUrl) {
      alert("No data available to download");
      return;
    }
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // Print QR
  const printDataUrl = (dataUrl) => {
    if (!dataUrl) {
      alert("No data to print");
      return;
    }
    const w = window.open("");
    w.document.write(`<img src="${dataUrl}" onload="window.print();window.close()" />`);
    w.document.close();
  };

  return (
    <div className="app-root">
      <header className="topbar">
        <div className="brand">QR Monitor</div>
        <nav>
          <button className="link-btn active">Dashboard</button>
          <button className="link-btn">+ Generate QR</button>
        </nav>
      </header>

      <main className="page">
        <h1>Generate QR Code</h1>
        <p className="muted">Create a new QR code with 12-hour validity. It must be scanned at least once every 3 hours.</p>

        <section className="grid">
          <div className="card form-card">
            <h2>QR Code Details</h2>
            <p className="muted">Enter the information for your QR code. Fields marked * are required.</p>

            {error && <div className="alert">{error}</div>}

            <form onSubmit={handleGenerate} className="form-grid">
              <div className="field">
                <label>Company Name *</label>
                <input
                  placeholder="e.g., XYZ Corporation"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  required
                />
              </div>

              <div className="field">
                <label>Contact Person</label>
                <input placeholder="e.g., John Doe" value={contact} onChange={(e) => setContact(e.target.value)} />
              </div>

              <div className="field">
                <label>Location / Branch</label>
                <input placeholder="e.g., New York Office" value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>

              <div className="field">
                <label>Purpose</label>
                <input placeholder="e.g., Visitor Access" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
              </div>

              <div className="submit-row">
                <button className="primary" type="submit" disabled={loading}>
                  {loading ? "Generating..." : "Generate QR Code"}
                </button>
              </div>
            </form>
          </div>

          <div className="card list-card">
            <h2>All QRs</h2>
            {loading && <div className="muted">Loading...</div>}
            {!loading && (
              <>
                <div className="metrics-row">
                  <div className="metric">
                    <div className="metric-value">{list.length}</div>
                    <div className="metric-label">Total QR Codes</div>
                  </div>
                  <div className="metric">
                    <div className="metric-value">
                      {list.filter((q) => !q.flagged && new Date(q.expiresAt) > new Date()).length}
                    </div>
                    <div className="metric-label">Active</div>
                  </div>
                  <div className="metric">
                    <div className="metric-value">{list.filter((q) => q.flagged).length}</div>
                    <div className="metric-label">Flagged</div>
                  </div>
                  <div className="metric">
                    <div className="metric-value">{list.filter((q) => new Date(q.expiresAt) < new Date()).length}</div>
                    <div className="metric-label">Expired</div>
                  </div>
                </div>

                <table className="qr-table">
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Location</th>
                      <th>Purpose</th>
                      <th>Created</th>
                      <th>Last Scan</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((row) => (
                      <tr key={row.qrId || row._id}>
                        <td>{row.companyName || "-"}</td>
                        <td>{row.extraFields?.location || "-"}</td>
                        <td>{row.extraFields?.purpose || "-"}</td>
                        <td>{formatDateIsoToDDMMYYYY(row.createdAt)}</td>
                        <td>
                          {row.scanHistory && row.scanHistory.length
                            ? formatRelativeOrNever(row.scanHistory[row.scanHistory.length - 1].time)
                            : "Never"}
                        </td>
                        <td>
                          <StatusBadge qr={row} />
                        </td>
                        <td>
                          <button className="btn-light" onClick={() => setDetailRow(row)}>
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </section>

        {/* Generated QR Modal */}
        {generated && (
          <div className="modal-bg" onClick={() => setGenerated(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>QR Code Generated Successfully</h3>
                <button className="close" onClick={() => setGenerated(null)}>
                  ×
                </button>
              </div>

              <div className="modal-body">
                <div className="qr-box">
                  <img src={generated.dataUrl} alt="Generated QR" />
                </div>

                <div className="qr-meta">
                  <div className="muted">Expires:</div>
                  <div className="meta-value">
                    {generated.expiresAt ? `${formatDateIsoToDDMMYYYY(generated.expiresAt)}` : "-"}
                  </div>

                  <div className="muted">Company:</div>
                  <div className="meta-value">{generated.companyName}</div>

                  <div className="muted">Location:</div>
                  <div className="meta-value">{generated.extraFields?.location || "-"}</div>

                  <div className="muted">Purpose:</div>
                  <div className="meta-value">{generated.extraFields?.purpose || "-"}</div>

                  <div className="modal-actions">
                    <button onClick={() => downloadDataUrl(generated.dataUrl, `${generated.qrId}.png`)}>
                      Download PNG
                    </button>
                    <button onClick={() => printDataUrl(generated.dataUrl)}>Print</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Detail modal for a list row */}
        {detailRow && (
          <div className="modal-bg" onClick={() => setDetailRow(null)}>
            <div className="modal wide" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>QR Details</h3>
                <button className="close" onClick={() => setDetailRow(null)}>
                  ×
                </button>
              </div>

              <div className="modal-body two-col">
                <div className="left">
                  <div className="qr-box">
                    <img
                      src={`${detailRow?.dataUrl || ""}`}
                      alt="QR"
                      onError={(e) => {
                        if (detailRow.qrId) {
                          e.target.src = `${API_BASE}/api/qrs?qrId=${detailRow.qrId}`;
                        }
                      }}
                    />
                  </div>

                  <div className="info">
                    <div>
                      <strong>QR ID:</strong> <span className="muted">{detailRow.qrId}</span>
                    </div>
                    <div>
                      <strong>Contact Person:</strong> <span className="muted">{detailRow.extraFields?.contact || "-"}</span>
                    </div>
                    <div>
                      <strong>Created:</strong> <span className="muted">{formatDateIsoToDDMMYYYY(detailRow.createdAt)}</span>
                    </div>
                    <div>
                      <strong>Expires:</strong> <span className="muted">{formatDateIsoToDDMMYYYY(detailRow.expiresAt)}</span>
                    </div>
                    <div>
                      <strong>Total Scans:</strong> <span className="muted">{detailRow.scanHistory?.length || 0}</span>
                    </div>
                  </div>
                </div>

                <div className="right">
                  <h4>Scan History</h4>
                  {detailRow.scanHistory && detailRow.scanHistory.length ? (
                    <ul className="history-list">
                      {detailRow.scanHistory.map((s, i) => (
                        <li key={i}>{new Date(s.time).toLocaleString()}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="muted">No scans recorded yet</div>
                  )}
                </div>
              </div>

              <div className="modal-actions">
                <button onClick={() => setDetailRow(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
