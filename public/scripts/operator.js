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

const evtSource = new EventSource("http://localhost:3000/events");

evtSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === "incoming-kiosk") {
    showIncomingCallPopup(data.callerId, data.callerName).then(() => {
      console.log("Call answered.");
      // Optionally send update to server here
    });
  }
};

////////////////////////////////////////////////////////////////////////////////////////
// ON LOAD
////////////////////////////////////////////////////////////////////////////////////////
(async () => {
  const refreshTimer = (await getEnvVars().DELETE_TIMER) || 10000;
  const callerId = await signIn(UTYPE_OPERATOR, getOperatorName());

  if (callerId) {
    setInterval(
      () => keepSessionAlive(callerId, UTYPE_OPERATOR),
      refreshTimer / 2
    ); // call every half life
  }
})();
