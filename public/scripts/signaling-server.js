/////////////////////////////////////////////////////////////////
// GET ENV VALUES
/////////////////////////////////////////////////////////////////
async function getEnvVars() {
  output("===== RETRIEVING ENV VARS ===== ");
  try {
    const response = await fetch(`/env`);
    if (!response.ok) {
      throw new Error(`Failed to get env vars ${response.status}`);
    }
    const data = await response.json();
    output(`🟢 Retrieved Env Vars`);
    return data;
  } catch (err) {
    output(`❌ Error failed to get env vars: ${err.message}`);
    console.error(`❌ Error failed to get env vars: ${err.message}`);
    return null;
  }
}

/////////////////////////////////////////////////////////////////
// CONNECT TO SIGNALING SERVER
/////////////////////////////////////////////////////////////////
async function signIn(callerType, callerName) {
  output("===== CONNECT TO SIGNALING SERVER ===== ");
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
    output(
      `🟢 Signed in as ${callerType}:${callerName}, callerId: ${data.callerId}`
    );
    return data.callerId;
  } catch (err) {
    output(`❌ Error during sign-in: ${err.message}`);
    console.error(`❌ Error during sign-in: ${err.message}`);
    return null;
  }
}

/////////////////////////////////////////////////////////////////
// REFRESH SIGNALING SERVER SESSION
/////////////////////////////////////////////////////////////////
async function keepSessionAlive(callerId) {
  try {
    const response = await fetch(`/keep-session?callerId=${callerId}`);
    if (!response.ok) {
      throw new Error(`Keep-alive failed with status ${response.status}`);
    }
    output(`===== SESSION REFRESHED: ${callerId} ===== `);

    //   output(`💓 Session refreshed for callerId: ${callerId}`);
  } catch (err) {
    output(`❌💓 Error keeping session alive: ${err.message}`);
    console.error(`❌ Error keeping session alive: ${err.message}`);
  } // add an try to to sign-in upon error
}
