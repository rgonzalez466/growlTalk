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
  setupRemoteStreamHandling();

  let callerId = null;
  let keepAliveInterval = null;
  let callerInfoInterval = null;

  showStickyNote("DISCONNECTED");

  async function attemptSignInLoop() {
    while (!callerId) {
      try {
        callerId = await signIn(UTYPE_KIOSK, getKioskName());
        if (callerId) {
          console.log(`✅ Signed in as ${callerId}`);
          showStickyNote("CONNECTED");
          let offer = await generateSdpOffer(callerId);
          if (!offer) {
            console.error("❌ SDP offer not generated. Exiting.");
            return;
          }

          //  await updateSdpClient(callerId, offer.sdp, null, "AVAILABLE");
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
          showStickyNote("DISCONNECTED");
          console.warn("🔴 Session marked offline. Stopping keep-alive.");
          clearInterval(keepAliveInterval);
          keepAliveInterval = null;
          clearInterval(callerInfoInterval);
          callerInfoInterval = null;
          callerId = null;
          attemptSignInLoop(); // Retry sign-in again
        }
      } catch (err) {
        showStickyNote("DISCONNECTED");
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

          // Handle SDP Answer
          if (
            myProfile.sdpAnswer != null &&
            !peerConnection.currentRemoteDescription
          ) {
            await applyRemoteSdpAnswer(myProfile.sdpAnswer.sdp);
          }

          // Handle ICE candidates (if your API supports it)
          if (
            myProfile.iceCandidates &&
            Array.isArray(myProfile.iceCandidates)
          ) {
            for (const candidate of myProfile.iceCandidates) {
              await addIceCandidate(candidate);
            }
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
