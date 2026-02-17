// ===============================
// CONFIG (Use the WEB APP ID here)
// ===============================
const CLIENT_ID = "911024790272-bcttcijd65s399klvdk11baaka2kflcq.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.readonly";
const REDIRECT_URI = window.location.origin + window.location.pathname;

let oldElsToken = null;
let newElsToken = null;
let oldLastFileId = null;
let newLastFileId = null;

// ===============================
// INITIALIZATION
// ===============================
function gapiLoaded() {
  gapi.load("client", initializeGapiClient);
}

async function initializeGapiClient() {
  // This "Discovery Doc" is the map that tells GAPI how to use Drive
  await gapi.client.init({
    discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
  });
  console.log("Drive API ready");
  
  // Handle redirect callback from OAuth
  handleRedirectCallback();
}

// ===============================
// HANDLE OAUTH REDIRECT CALLBACK
// ===============================
function handleRedirectCallback() {
  const hash = window.location.hash;
  if (!hash) return;
  
  const params = new URLSearchParams(hash.substring(1));
  const accessToken = params.get('access_token');
  
  if (accessToken) {
    const tokenResponse = {
      access_token: accessToken,
      expires_in: params.get('expires_in'),
      token_type: params.get('token_type'),
      scope: params.get('scope')
    };
    
    // Determine which account based on state parameter
    const state = params.get('state');
    
    if (state === 'old') {
      oldElsToken = tokenResponse;
      updateResults("OldELS Connected. Monitoring every 60s...");
      startMonitoring();
    } else if (state === 'new') {
      newElsToken = tokenResponse;
      updateResults("NewELS Connected. Monitoring every 60s...");
      startMonitoring();
    }
    
    // Clean up URL
    window.history.replaceState(null, null, window.location.pathname);
  }
}

// ===============================
// AUTH HANDLERS - Manual OAuth2 Flow
// ===============================
function authenticateOld() {
  const state = 'old';
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `response_type=token&` +
    `scope=${encodeURIComponent(SCOPES)}&` +
    `state=${state}&` +
    `prompt=select_account`;
  
  window.location.href = authUrl;
}

function authenticateNew() {
  const state = 'new';
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(REDIRECT_URI)}&` +
    `response_type=token&` +
    `scope=${encodeURIComponent(SCOPES)}&` +
    `state=${state}&` +
    `prompt=select_account`;
  
  window.location.href = authUrl;
}

// ===============================
// MONITORING LOGIC
// ===============================
function startMonitoring() {
  // Check once immediately, then every minute
  runCheck();
  setInterval(runCheck, 60000); 
}

async function runCheck() {
  if (oldElsToken) oldLastFileId = await checkDrive(oldElsToken, "OldELS", oldLastFileId);
  if (newElsToken) newLastFileId = await checkDrive(newElsToken, "NewELS", newLastFileId);
}

async function checkDrive(token, label, lastId) {
  // Set the specific token for THIS account call
  gapi.client.setToken(token);

  try {
    const response = await gapi.client.drive.files.list({
      pageSize: 1,
      fields: 'files(id, name, createdTime)',
      orderBy: 'createdTime desc'
    });

    const latestFile = response.result.files[0];
    if (!latestFile) return lastId;

    // Detect Change
    if (lastId && latestFile.id !== lastId) {
      const timestamp = new Date().toLocaleTimeString();
      const msg = `<p><strong>[${timestamp}] ${label}:</strong> New file: ${latestFile.name}</p>`;
      document.getElementById("results").innerHTML = msg + document.getElementById("results").innerHTML;
    }

    return latestFile.id;
  } catch (err) {
    console.error(`Error checking ${label}:`, err);
    return lastId;
  }
}

function updateResults(text) {
  const box = document.getElementById("results");
  box.innerHTML = `<p>${text}</p>` + box.innerHTML;
}

// Bindings
document.getElementById("auth-old").onclick = authenticateOld;
document.getElementById("auth-new").onclick = authenticateNew;