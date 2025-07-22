"use strict";

const UTYPE_KIOSK = "kiosk";

////////////////////////////////////////////////////////////////////////////////////////
// ON LOAD
////////////////////////////////////////////////////////////////////////////////////////
(async () => {
  let sdpClientMedia;
  const refreshTimer = (await getEnvVars().DELETE_TIMER) || 15000;

  if ((await checkVideoDevices()) === false) {
    output("⚠️📷 No video devices detected on this client.");
    console.warn("⚠️ No video devices detected on this client.");
  }

  if ((await checkAudioDevices()) === false) {
    output("⚠️🎤 No audio input (microphone) detected on this client.");
    console.warn("⚠️ No audio input (microphone) detected on this client.");
  }

  sdpClientMedia = await listAllDevices();
  await initializePeerConnection(sdpClientMedia);

  const offer = await generateSdpOffer();
  if (!offer) {
    console.error("❌ SDP offer not generated. Exiting.");
    return;
  }

  let callerId = null;
  let keepAliveInterval = null;
  let callerInfoInterval = null;

  async function attemptSignInLoop() {
    while (!callerId) {
      try {
        callerId = await signIn(UTYPE_KIOSK, getKioskName());
        if (callerId) {
          await updateSdpClient(callerId, offer.sdp, null, "AVAILABLE");
          console.log(`✅ Signed in as ${callerId}`);
          startKeepAliveLoop();
          startCallerInfoPolling();
        }
      } catch (err) {
        console.warn(`🔁 Retrying sign-in: ${err.message}`);
        await new Promise((res) => setTimeout(res, 2000));
      }
    }
  }

  function startKeepAliveLoop() {
    keepAliveInterval = setInterval(async () => {
      try {
        await keepSessionAlive(callerId, UTYPE_KIOSK);

        if (!thisSdpClient.isOnline) {
          console.warn("🔴 Session marked offline. Stopping keep-alive.");
          clearInterval(keepAliveInterval);
          keepAliveInterval = null;
          clearInterval(callerInfoInterval);
          callerInfoInterval = null;
          callerId = null;
          attemptSignInLoop(); // Retry sign-in again
        }
      } catch (err) {
        console.error("❌ Keep-alive failed:", err);
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
        clearInterval(callerInfoInterval);
        callerInfoInterval = null;
        callerId = null;
        attemptSignInLoop(); // Retry sign-in again
      }
    }, refreshTimer / 2);
  }

  function startCallerInfoPolling() {
    callerInfoInterval = setInterval(async () => {
      if (thisSdpClient.isOnline && callerId) {
        try {
          let [myProfile] = await getCallersInfo(`callerId=${callerId}`);
          console.log("👀 Fetched my profile info:", myProfile);
          if (myProfile.sdpAnswer != null) {
            output("Connectet to Operator ...");
            await applyRemoteSdpAnswer(myProfile.sdpAnswer);
          }
        } catch (err) {
          console.error("⚠️ Failed to fetch my profile info:", err.message);
        }
      }
    }, 3000);
  }

  // Start initial sign-in loop
  attemptSignInLoop();
})();
