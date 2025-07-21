"use strict";

const UTYPE_OPERATOR = "operator";

/////////////////////////////////////////////////////////////////
// GET KIOSK CALL EVENTS
/////////////////////////////////////////////////////////////////
// const evtSource = new EventSource("https://192.168.1.184:9999/events");

// evtSource.onmessage = (event) => {
//   const data = JSON.parse(event.data);
//   if (data.type === "incoming-kiosk") {
//     showIncomingCallPopup(data.callerId, data.callerName).then(() => {
//       console.log("Call answered.");
//       // Optionally send update to server here
//     });
//   }
// };

/////////////////////////////////////////////////////////////////////////////////
// SHOW INCOMING CALL TO OPERATOR
/////////////////////////////////////////////////////////////////////////////////

function showIncomingCallPopup(id, name) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("incoming-call-overlay");
    const avatar = document.getElementById("caller-avatar");
    const callerName = document.querySelector(".caller-name");
    const subtext = document.querySelector(".caller-subtext");
    const answerBtn = document.getElementById("answer-call-btn");

    callerName.textContent = id + " " + name;
    subtext.textContent = "is calling you";
    overlay.style.display = "flex";

    avatar.src = `assets/kiosk.png`;

    const audio = new Audio("assets/bear.mp3");
    audio.loop = true;
    audio.play().catch(() => {
      console.warn("Autoplay failed. Will wait for user interaction.");
    });

    answerBtn.onclick = () => {
      audio.pause();
      audio.currentTime = 0;
      overlay.style.display = "none";
      resolve(true); // Accept the call
    };
  });
}

////////////////////////////////////////////////////////////////////////////////////////
// ON LOAD
////////////////////////////////////////////////////////////////////////////////////////
(async () => {
  let sdpClientMedia;
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

  const offer = await generateSdpOffer();
  if (offer) {
    // send offer.sdp to the server or signaling channel
    //console.log("👉 Send this SDP to server:", offer.sdp);
    const refreshTimer = (await getEnvVars().DELETE_TIMER) || 10000;
    const callerId = await signIn(UTYPE_OPERATOR, getKioskName());
    const sendSdpAnswer = await updateSdpClient(
      callerId,
      offer.sdp,
      null,
      null
    );
    if (callerId) {
      setInterval(
        () => keepSessionAlive(callerId, UTYPE_OPERATOR),
        refreshTimer / 2
      ); // call every half life
    }
  }
})();
