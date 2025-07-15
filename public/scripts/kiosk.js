"use strict";

const logPanel = document.getElementById("logPanel");
const logToggleBtn = document.getElementById("logToggleBtn");
const hideLogBtn = document.getElementById("hideLogBtn");

// Global variable to store the peer connection
let peerConnection;

/////////////////////////////////////////////////////////////////
// GIVE THE KIOSK A RANDOM NAME
/////////////////////////////////////////////////////////////////
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

const bear = bearNames[Math.floor(Math.random() * bearNames.length)];
const username = `${bear}`;

/////////////////////////////////////////////////////////////////
// SHOW / HIDE LOG PANELS
/////////////////////////////////////////////////////////////////
logToggleBtn.addEventListener("click", () => {
  logPanel.classList.add("show");
});

hideLogBtn.addEventListener("click", () => {
  logPanel.classList.remove("show");
});

/////////////////////////////////////////////////////////////////
// LOG VIDEO CALL SERVER EVENTS
/////////////////////////////////////////////////////////////////
function output(message) {
  const c = document.getElementById("console");

  c.value += message;
  c.value += "\n";
  c.scrollTop = c.scrollHeight;
}

/////////////////////////////////////////////////////////////////
// TEST THE CLIENT AUDIO & VIDEO DEVICES
/////////////////////////////////////////////////////////////////
// async function checkDevices() {
//   const result = {
//     webcam: false,
//     microphone: false,
//     speakers: false,
//     desktopCam: false,
//     webcamDevice: null,
//     microphoneDevice: null,
//     desktopDevice: null,
//     error: null,
//   };

//   const devices = await navigator.mediaDevices?.enumerateDevices();
//   const videoInputs = devices.filter((device) => device.kind === "videoinput");
//   const audioInputs = devices.filter((device) => device.kind === "audioinput");

//   try {
//     const devices = await navigator.mediaDevices.enumerateDevices();

//     let webcamDeviceId = null;
//     let microphoneDeviceId = null;
//     let desktopDeviceId = null;

//     console.log(devices);

//     for (const device of devices) {
//       if (device.kind === "videoinput") {
//         if (device.label.includes("UScreenCapture")) {
//           desktopDeviceId = device.deviceId;
//           result.desktopDevice = device.label;
//         } else if (!webcamDeviceId) {
//           webcamDeviceId = device.deviceId;
//           result.webcamDevice = device.label;
//         }
//       } else if (device.kind === "audioinput" && !microphoneDeviceId) {
//         microphoneDeviceId = device.deviceId;
//         result.microphoneDevice = device.label;
//       } else if (device.kind === "audiooutput") {
//         result.speakers = true;
//       }
//     }

//     // Try webcam test
//     if (webcamDeviceId) {
//       try {
//         const stream = await navigator.mediaDevices.getUserMedia({
//           video: { deviceId: { exact: webcamDeviceId } },
//           audio: microphoneDeviceId
//             ? { deviceId: { exact: microphoneDeviceId } }
//             : false,
//         });
//         result.webcam = true;
//         if (stream.getAudioTracks().length > 0) result.microphone = true;
//         stream.getTracks().forEach((track) => track.stop());
//       } catch (err) {
//         result.error = `Webcam test failed: ${err.message}`;
//       }
//     }

//     // Try desktopCam test (video only)
//     if (desktopDeviceId) {
//       try {
//         const stream = await navigator.mediaDevices.getUserMedia({
//           video: { deviceId: { exact: desktopDeviceId } },
//           audio: false,
//         });
//         result.desktopCam = true;
//         stream.getTracks().forEach((track) => track.stop());
//       } catch (err) {
//         result.error ??= `DesktopCam test failed: ${err.message}`;
//       }
//     }
//   } catch (err) {
//     result.error = `General error: ${err.message}`;
//   }

//   console.log(result);
// }

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

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast show ${type}`;

  // Hide after 2s
  setTimeout(() => {
    toast.className = "toast";
  }, 2000);
}

////////////////////////////////////////////////////////////////////////////////////////
// ON LOAD
////////////////////////////////////////////////////////////////////////////////////////
//checkDevices();
