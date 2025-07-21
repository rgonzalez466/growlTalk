"use strict";

const UTYPE_KIOSK = "kiosk";

////////////////////////////////////////////////////////////////////////////////////////
// ON LOAD
////////////////////////////////////////////////////////////////////////////////////////
(async () => {
  let sdpClientMedia;
  const refreshTimer = (await getEnvVars().DELETE_TIMER) || 15000;

  if ((await checkVideoDevices()) === false) {
    console.warn("⚠️ No video devices detected on this client.");
    output("⚠️📷 No video devices detected on this client.");
  }

  if ((await checkAudioDevices()) === false) {
    console.warn("⚠️ No audio input (microphone) detected on this client.");
    output("⚠️🎤 No audio input (microphone) detected on this client.");
  }

  sdpClientMedia = await listAllDevices();
  console.log("sdpClientMedia:", sdpClientMedia);

  await initializePeerConnection(sdpClientMedia);

  // only for kiosks
  const offer = await generateSdpOffer();
  if (offer) {
    // send offer.sdp to the server or signaling channel
    console.log("👉 Send this SDP to server:", offer.sdp);
    //console.log(refreshTimer);
    const callerId = await signIn(UTYPE_KIOSK, getKioskName());
    const sendSdpOffer = await updateSdpClient(callerId, offer.sdp, null, null);
    if (callerId) {
      setInterval(
        () => keepSessionAlive(callerId, UTYPE_KIOSK),
        refreshTimer / 2
      ); // call every half life
    }
  } //add a retry mechanism if session fails
})();
