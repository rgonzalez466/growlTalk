"use strict";

const bearNames = [
  "Teddy",
  "Baloo",
  "Grizz",
  "Bjorn",
  "Misha",
  "Nanuk",
  "Yogi",
];

const bear = bearNames[Math.floor(Math.random() * bearNames.length)];
const username = `!${bear}-operator`;

localStorage.setItem("growltalk_name", username);

const logPanel = document.getElementById("logPanel");
const logToggleBtn = document.getElementById("logToggleBtn");
const hideLogBtn = document.getElementById("hideLogBtn");

logToggleBtn.addEventListener("click", () => {
  logPanel.classList.add("show");
});

hideLogBtn.addEventListener("click", () => {
  logPanel.classList.remove("show");
});

function output(message) {
  const c = document.getElementById("console");

  c.value += message;
  c.value += "\n";
  c.scrollTop = c.scrollHeight;
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
