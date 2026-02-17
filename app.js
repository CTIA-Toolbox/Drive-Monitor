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
      document.getElementById('status-old').classList.add('active');
      updateResults("OldELS Connected. Monitoring every 60s...");
      startMonitoring();
    } else if (state === 'new') {
      newElsToken = tokenResponse;
      document.getElementById('status-new').classList.add('active');
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
  // Use Promise.all to handle both, but we must be careful with the global token
  if (oldElsToken) {
    oldLastFileId = await checkDrive(oldElsToken, "OldELS", oldLastFileId);
  }
  // Small delay to ensure the GAPI client settles (GAPI is a bit "singleton" heavy)
  await new Promise(r => setTimeout(r, 500)); 
  
  if (newElsToken) {
    newLastFileId = await checkDrive(newElsToken, "NewELS", newLastFileId);
  }
}

async function checkDrive(token, label, lastId) {
  const statusId = label === "OldELS" ? "status-old" : "status-new";
  const statusDot = document.getElementById(statusId);
  
  gapi.client.setToken(token);

  try {
    const response = await gapi.client.drive.files.list({
      pageSize: 1,
      fields: 'files(id, name, createdTime)',
      orderBy: 'createdTime desc'
    });

    // If we reach here, connection is LIVE
    statusDot.classList.add('active');
    statusDot.classList.remove('error');

    const latestFile = response.result.files[0];
    if (!latestFile) return lastId;

    // Initial baseline setup
    if (!lastId) {
      updateResults(`${label}: Monitoring active. Initial file: ${latestFile.name}`);
      return latestFile.id;
    }

    // New File Detection
    if (latestFile.id !== lastId) {
      const timestamp = new Date().toLocaleTimeString();
      const msg = `<p class="new-alert"><strong>[${timestamp}] ${label}:</strong> New file detected: ${latestFile.name}</p>`;
      document.getElementById("results").innerHTML = msg + document.getElementById("results").innerHTML;
      return latestFile.id;
    }

    return lastId;
  } catch (err) {
    console.error(`Error checking ${label}:`, err);
    // Visual cue that the connection dropped (likely token expired)
    statusDot.classList.remove('active');
    statusDot.classList.add('error');
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