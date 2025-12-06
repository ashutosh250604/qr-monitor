// frontend/api/_cors.js
// small helper to set CORS headers and handle preflight
function setCorsHeaders(res, origin = '*') {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, x-job-secret');
  // If you ever use cookies or credentials, set to 'true' and set a specific origin instead of '*'
  res.setHeader('Access-Control-Allow-Credentials', 'false');
}

function handlePreflight(req, res, origin = '*') {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res, origin);
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

module.exports = { setCorsHeaders, handlePreflight };
