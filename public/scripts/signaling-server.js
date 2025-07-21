const KIOSK_USER = "kiosk";
const OPERATOR_USER = "operator";

/////////////////////////////////////////////////////////////////
// GET ENV VALUES
/////////////////////////////////////////////////////////////////
async function getEnvVars() {
  try {
    const response = await fetch(`/env`);
    if (!response.ok) {
      throw new Error(`Failed to get env vars ${response.status}`);
    }
    const data = await response.json();
    output("===== RETRIEVING ENV VARS ===== ");
    output(`🟢 Retrieved Env Vars`);
    return data;
  } catch (err) {
    output("===== RETRIEVING ENV VARS ===== ");
    output(`❌ Error failed to get env vars: ${err.message}`);
    console.error(`❌ Error failed to get env vars: ${err.message}`);
    return null;
  }
}

/////////////////////////////////////////////////////////////////
// CONNECT TO SIGNALING SERVER
/////////////////////////////////////////////////////////////////
async function signIn(callerType, callerName) {
  try {
    const response = await fetch(
      `/sign-in?callerType=${callerType}&callerName=${encodeURIComponent(
        callerName
      )}`
    );
    if (!response.ok) {
      throw new Error(`Sign-in failed with status ${response.status}`);
    }
    const data = await response.json();

    output("===== CONNECT TO SIGNALING SERVER ===== ");
    output(
      `🟢 Signed in as ${callerType}:${callerName}, callerId: ${data.callerId}`
    );

    thisSdpClient.callerName = callerName;
    thisSdpClient.callerType = callerType;
    thisSdpClient.callerId = data.callerId;
    thisSdpClient.callerStatus = "AVAILABLE";
    thisSdpClient.isOnline = true;

    return data.callerId;
  } catch (err) {
    output("===== CONNECT TO SIGNALING SERVER ===== ");
    output(`❌ Error during sign-in: ${err.message}`);
    console.error(`❌ Error during sign-in: ${err.message}`);
    return null;
  }
}

/////////////////////////////////////////////////////////////////
// DISCONNECT FROM SIGNALING SERVER
/////////////////////////////////////////////////////////////////
async function signOut(callerId) {
  try {
    const response = await fetch(`/sign-out?callerId=${callerId}`);
    if (!response.ok) {
      throw new Error(`Sign-out failed with status ${response.status}`);
    }
    const data = await response.json();
    output("===== DISCONNECT FROM SIGNALING SERVER ===== ");
    output(`🟢 Signed out as callerId: ${data.callerId}`);
    thisSdpClient.isOnline = false;
    return data.callerId;
  } catch (err) {
    output("===== DISCONNECT FROM SIGNALING SERVER ===== ");
    output(`❌ Error during sign-out: ${err.message}`);
    console.error(`❌ Error during sign-out: ${err.message}`);
    return null;
  }
}

/////////////////////////////////////////////////////////////////
// REFRESH SIGNALING SERVER SESSION
/////////////////////////////////////////////////////////////////
async function keepSessionAlive(callerId, callerType) {
  try {
    const response = await fetch(`/keep-session?callerId=${callerId}`);
    if (!response.ok) {
      throw new Error(`Keep-alive failed with status ${response.status}`);
    }
    thisSdpClient.isOnline = true;
    output(`===== SESSION REFRESHED: ${callerId} ===== `);
    //   output(`💓 Session refreshed for callerId: ${callerId}`);
  } catch (err) {
    thisSdpClient.isOnline = false;
    output(`❌💓 Error keeping session alive: ${err.message}`);
    console.error(`❌ Error keeping session alive: ${err.message}`);
  }
}
/////////////////////////////////////////////////////////////////
// UPDATE SDP OFFER , SDP ANSWER OR SDP CLIENT STATUS
/////////////////////////////////////////////////////////////////
async function updateSdpClient(callerId, sdpOffer, sdpAnswer, status) {
  try {
    const payload = {};

    if (callerId) payload.callerId = callerId;
    if (sdpOffer != null) payload.sdpOffer = sdpOffer;
    if (sdpAnswer != null) payload.sdpAnswer = sdpAnswer;
    if (status != null) payload.status = status;

    const response = await fetch("/caller", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`update caller failed with status ${response.status}`);
    }

    if (sdpOffer) {
      thisSdpClient.sdpOffer = sdpOffer;
      output(`===== SDP Offer Sent ===== `);
    }

    if (status) {
      output(`===== UPDATED CALLER STATUS TO ${status} ===== `);
      thisSdpClient.callerStatus = status;
    }
  } catch (err) {
    if (sdpOffer) {
      output(`❌ update SDP Offer  for caller failed: ${err.message}`);
      console.error(`❌ update SDP Offer for caller failed: ${err.message}`);
    }
    if (status) {
      output(`❌ update status  for caller failed: ${err.message}`);
      console.error(`❌ update statys for caller failed: ${err.message}`);
    }
  }
}
