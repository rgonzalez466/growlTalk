"use strict";

const logPanel = document.getElementById("logPanel");
const logToggleBtn = document.getElementById("logToggleBtn");
const hideLogBtn = document.getElementById("hideLogBtn");

const UTYPE_KIOSK = "kiosk";

// Global variable to store the peer connection
let peerConnection;

/////////////////////////////////////////////////////////////////
// GIVE THE KIOSK A RANDOM NAME
/////////////////////////////////////////////////////////////////

function getKioskName() {
  const bearNames = [
    "GrizzlyBear",
    "FormosanBear",
    "PolarBear",
    "Panda",
    "BlackBear",
    "SunBear",
    "SpectacledBear",
    "SlothBear",
    "SpiritBear",
    "MoonBear",
  ];

  const kiosk_username =
    bearNames[Math.floor(Math.random() * bearNames.length)];
  return kiosk_username;
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
    output("===== SESSION REFRESHED: ${callerId} ===== ");

    //   output(`💓 Session refreshed for callerId: ${callerId}`);
  } catch (err) {
    output(`❌💓 Error keeping session alive: ${err.message}`);
    console.error(`❌ Error keeping session alive: ${err.message}`);
  } // add an try to to sign-in upon error
}

///////////////////////////////////////////////////////////////////////////
// SHOW / HIDE STICKY NOTE WITH USERNAME
///////////////////////////////////////////////////////////////////////////
function showStickyNote(message) {
  const sticky = document.getElementById("sticky-note");
  const header = document.querySelector(".header");
  sticky.textContent = message;
  sticky.style.display = "block";
  if (header) header.classList.add("with-sticky-note");
}

function hideStickyNote() {
  const sticky = document.getElementById("sticky-note");
  const header = document.querySelector(".header");
  sticky.style.display = "none";
  if (header) header.classList.remove("with-sticky-note");
}

////////////////////////////////////////////////////////////////////////////////////////
// ON LOAD
////////////////////////////////////////////////////////////////////////////////////////
(async () => {
  const callerId = await signIn(UTYPE_KIOSK, getKioskName());
  if (callerId) {
    setInterval(() => keepSessionAlive(callerId), 10_000); // call every 10s
  }
})();

//checkDevices();
