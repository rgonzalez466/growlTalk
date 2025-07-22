"use strict";

const UTYPE_OPERATOR = "operator";

/////////////////////////////////////////////////////////////////////////////////
// GET KIOSKS CALLING FOR HELP , AND SHOW INCOMING CALL CONTROL
/////////////////////////////////////////////////////////////////////////////////

let popupVisible = false;
let currentAudio = null;

async function pollAvailableCallers() {
  while (thisSdpClient.callerStatus === "AVAILABLE") {
    try {
      let getCallerQuery;

      if (!popupVisible) {
        getCallerQuery =
          "callerStatus=AVAILABLE&limit=1&wait=60&callerType=kiosk";
      } else {
        getCallerQuery = "callerStatus=AVAILABLE&callerType=kiosk";
      }

      const [caller] = await getCallersInfo(getCallerQuery);

      if (caller && thisSdpClient.callerStatus === "AVAILABLE") {
        if (!popupVisible) {
          popupVisible = true;
          showIncomingCallPopup(caller.callerId, caller.callerName).then(
            async (accepted) => {
              popupVisible = false;
              stopIncomingAudio();

              // operator clicked on the answer button
              if (accepted) {
                // create operator sdp answer using kiosk's sdp offer
                let [kioskSdp] = await getCallersInfo(
                  `callerId=${caller.callerId}`
                );
                kioskSdp = kioskSdp.sdpOffer;
                thisSdpClient.remoteSdpOffer = kioskSdp;
                thisSdpClient.mySdpAnswer = await generateSdpAnswer(kioskSdp);
                //update kiosk status to busy
                await updateSdpClient(
                  thisSdpClient.callerId,
                  null,
                  thisSdpClient.mySdpAnswer.sdp,
                  "BUSY"
                );
                //update operator status to busy
                thisSdpClient.callerStatus = "BUSY";

                await updateSdpClient(
                  caller.callerId,
                  null,
                  thisSdpClient.mySdpAnswer.sdp,
                  "BUSY"
                );
              }
            }
          );
        }
        // Else: popup is already shown → keep showing
      } else {
        // No matching caller or status changed → hide if shown
        if (popupVisible) {
          hideIncomingCallPopup();
          popupVisible = false;
        }
      }
    } catch (err) {
      console.error("Polling error:", err);
      if (popupVisible) {
        hideIncomingCallPopup();
        popupVisible = false;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1s before next call
  }
}

/////////////////////////////////////////////////////////////////////////////////
// SHOW INCOMING CALL TO OPERATOR WITH SOUND WHEN A KIOSK NEEDS HELP
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

    // Play audio only once per popup show
    currentAudio = new Audio("assets/bear.mp3");
    currentAudio.loop = true;
    currentAudio.play().catch(() => {
      console.warn("Autoplay failed. Will wait for user interaction.");
    });

    answerBtn.onclick = () => {
      stopIncomingAudio();
      overlay.style.display = "none";
      resolve(true); // Accept the call
    };
  });
}

/////////////////////////////////////////////////////////////////////////////////
// HIDE CALL CONTROL , WHEN NO ONE IS CALLING
/////////////////////////////////////////////////////////////////////////////////

function hideIncomingCallPopup() {
  const overlay = document.getElementById("incoming-call-overlay");
  overlay.style.display = "none";
  stopIncomingAudio();
}

/////////////////////////////////////////////////////////////////////////////////
// STOP INCOMING CALL SOUND , WHEN NO ONE IS CALLING OR CALL HAS BEEN ANSWERED
/////////////////////////////////////////////////////////////////////////////////

function stopIncomingAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

////////////////////////////////////////////////////////////////////////////////////////
// ON LOAD
////////////////////////////////////////////////////////////////////////////////////////
(async () => {
  let sdpClientMedia;
  let currentCallerId;
  let keepAliveIntervalId;

  // Helper function to start keep-alive with auto-renewal
  const startKeepAlive = (callerId, refreshTimer) => {
    if (keepAliveIntervalId) {
      clearInterval(keepAliveIntervalId);
    }

    keepAliveIntervalId = setInterval(async () => {
      try {
        await keepSessionAlive(callerId, UTYPE_OPERATOR);
      } catch (error) {
        // Check if it's a 404 error (session expired/invalid)
        if (error.status === 404 || error.response?.status === 404) {
          output("⚠️ Session expired, signing in again...");
          console.warn("⚠️ Session expired, signing in again...");

          try {
            // Clear the current interval
            clearInterval(keepAliveIntervalId);

            // Sign in again to get a new caller ID
            const newCallerId = await signIn(UTYPE_OPERATOR, getOperatorName());

            if (newCallerId) {
              currentCallerId = newCallerId;
              output(
                `✅ Successfully renewed session with new caller ID: ${newCallerId}`
              );
              console.log(
                "✅ Successfully renewed session with new caller ID:",
                newCallerId
              );

              await updateSdpClient(newCallerId, null, null, "AVAILABLE");

              // Restart keep-alive with new caller ID
              startKeepAlive(newCallerId, refreshTimer);
            } else {
              output("❌ Failed to get new caller ID during renewal");
              console.error("❌ Failed to get new caller ID during renewal");
            }
          } catch (renewalError) {
            output("❌ Failed to renew session");
            console.error("❌ Failed to renew session:", renewalError);
            // Optionally implement exponential backoff retry logic here
          }
        } else {
          output(`❌ Keep-alive failed with non-404 error ${error}`);
          console.error("❌ Keep-alive failed with non-404 error:", error);
        }
      }
    }, refreshTimer / 2);
  };

  // Main initialization
  if ((await checkVideoDevices()) === false) {
    console.warn("⚠️ No video devices detected on this client.");
    output("⚠️📷 No video devices detected on this client.");
  }
  if ((await checkAudioDevices()) === false) {
    console.warn("⚠️ No audio input (microphone) detected on this client.");
    output("⚠️🎤 No audio input (microphone) detected on this client.");
  }

  sdpClientMedia = await listAllDevices();
  await initializePeerConnection(sdpClientMedia);
  //const offer = await generateSdpOffer();

  //if (offer) {
  const refreshTimer = (await getEnvVars().DELETE_TIMER) || 10000;
  currentCallerId = await signIn(UTYPE_OPERATOR, getOperatorName());

  const sendSdpAnswer = await updateSdpClient(
    currentCallerId,
    null,
    null,
    "AVAILABLE"
  );

  if (thisSdpClient.isOnline === true) {
    pollAvailableCallers();
  }

  if (currentCallerId) {
    startKeepAlive(currentCallerId, refreshTimer);
  }
  //}
})();
