import React, { useState, useEffect } from "react";
import "./App.css";

const API_BASE = "https://qr-monitor.vercel.app"; // your backend

export default function App() {
  // FORM STATE
  const [companyName, setCompanyName] = useState("");
  const [location, setLocation] = useState("");
  const [contact, setContact] = useState("");
  const [purpose, setPurpose] = useState("");

  // GENERATED QR
  const [generated, setGenerated] = useState(null);

  // LIST OF ALL QRs
  const [list, setList] = useState([]);

  // SCAN HISTORY MODAL
  const [modalData, setModalData] = useState(null);

  // Fetch existing QRs on load
  const loadQRs = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/qrs`);
      const data = await res.json();
      setList(data);
    } catch (err) {
      console.error("Failed to load list", err);
    }
  };

  useEffect(() => {
    loadQRs();
  }, []);

  // Submit form to generate QR
  const generateQR = async (e) => {
    e.preventDefault();
    const body = {
      companyName,
      extraFields: { location, contact, purpose },
    };

    const res = await fetch(`${API_BASE}/api/qrs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    setGenerated(data);
    loadQRs(); // refresh list after creation
  };

  return (
    <div className="container">
      <h1>QR Monitoring Dashboard</h1>

      {/* ---------- FORM ---------- */}
      <div className="card">
        <h2>Create New QR</h2>
        <form onSubmit={generateQR}>
          <input
            placeholder="Company Name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
          />

          <input
            placeholder="Location / Branch"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />

          <input
            placeholder="Contact Person"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />

          <input
            placeholder="Purpose"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
          />

          <button type="submit">Generate QR</button>
        </form>

        {/* Display Generated QR */}
        {generated && (
          <div className="qr-display">
            <h3>QR for: {generated.qrId}</h3>
            <img src={generated.dataUrl} alt="QR" />

            <button
              onClick={() => {
                const a = document.createElement("a");
                a.href = generated.dataUrl;
                a.download = `${generated.qrId}.png`;
                a.click();
              }}
            >
              Download QR
            </button>
          </div>
        )}
      </div>

      {/* ---------- TABLE ---------- */}
      <div className="card">
        <h2>All QRs</h2>
        <table>
          <thead>
            <tr>
              <th>QR ID</th>
              <th>Company</th>
              <th>Created</th>
              <th>Expires</th>
              <th>Last Scan</th>
              <th>Flagged</th>
              <th>History</th>
            </tr>
          </thead>
          <tbody>
            {list.map((row) => (
              <tr key={row.qrId}>
                <td>{row.qrId}</td>
                <td>{row.companyName}</td>
                <td>{new Date(row.createdAt).toLocaleString()}</td>
                <td>{new Date(row.expiresAt).toLocaleString()}</td>
                <td>
                  {row.scanHistory?.length
                    ? new Date(
                        row.scanHistory[row.scanHistory.length - 1].timestamp
                      ).toLocaleString()
                    : "Never"}
                </td>
                <td style={{ color: row.flagged ? "red" : "green" }}>
                  {row.flagged ? "⚠️ Yes" : "✔ OK"}
                </td>
                <td>
                  <button onClick={() => setModalData(row)}>View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---------- MODAL ---------- */}
      {modalData && (
        <div className="modal-bg" onClick={() => setModalData(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Scan History: {modalData.qrId}</h3>
            <ul>
              {modalData.scanHistory?.length ? (
                modalData.scanHistory.map((s, i) => (
                  <li key={i}>{new Date(s.timestamp).toLocaleString()}</li>
                ))
              ) : (
                <li>No scans yet</li>
              )}
            </ul>
            <button onClick={() => setModalData(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
