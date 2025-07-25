let thisSdpClient = {}; // used for storing this web client's properties

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
// SHOW TOAST
/////////////////////////////////////////////////////////////////
function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast show ${type}`;

  // Hide after 2s
  setTimeout(() => {
    toast.className = "toast";
  }, 2000);
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

/////////////////////////////////////////////////////////////////
// GIVE THE KIOSK A RANDOM BEAR NAME
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
// GIVE THE OPERATOR A RANDOM BEAR NAME
/////////////////////////////////////////////////////////////////
function getOperatorName() {
  const bearNames = [
    "Teddy",
    "Baloo",
    "Grizz",
    "Bjorn",
    "Misha",
    "Nanuk",
    "Yogi",
  ];

  const operator_username =
    bearNames[Math.floor(Math.random() * bearNames.length)];
  return operator_username;
}

/////////////////////////////////////////////////////////////////
// LOGO HANDLER - CLICK ON LOGO TO SIGN OUT
/////////////////////////////////////////////////////////////////
async function handleHomeButtonClick(event) {
  event.preventDefault(); // Prevent default link behavior

  if (thisSdpClient.callerId) {
    await signOut(thisSdpClient.callerId);
  }

  // Navigate to welcome.html after signOut completes
  window.location.href = "welcome.html";
}

/////////////////////////////////////////////////////////////////
// CLOSE BROWSER HANDLER -  SIGN OUT UPON BROWSER CLOSE
/////////////////////////////////////////////////////////////////
// Add event listener when DOM is loaded
document.addEventListener("DOMContentLoaded", function () {
  const homeButton = document.getElementById("homeButton");
  const logToggleBtn = document.getElementById("logToggleBtn");
  const logPanel = document.getElementById("logPanel");
  const hideLogBtn = document.getElementById("hideLogBtn");

  const mainVideo = document.getElementById("mainVideo");
  const thumbnails = document.querySelectorAll(".thumbnails video");

  thumbnails.forEach((thumb) => {
    thumb.addEventListener("dblclick", () => {
      if (thumb.srcObject) {
        mainVideo.srcObject = thumb.srcObject;
      } else {
        mainVideo.src = thumb.src;
      }
    });
  });

  logToggleBtn.addEventListener("click", () => {
    logPanel.classList.add("show");
  });

  hideLogBtn.addEventListener("click", () => {
    logPanel.classList.remove("show");
  });

  if (homeButton) {
    homeButton.addEventListener("click", handleHomeButtonClick);
  }
});

// Handle browser window close/refresh
window.addEventListener("beforeunload", function (event) {
  if (thisSdpClient.callerId) {
    navigator.sendBeacon(`/sign-out?callerId=${thisSdpClient.callerId}`);
  }
});

function showVideo(videoId) {
  const video = document.getElementById(videoId);
  const placeholder = document.getElementById(`${videoId}Placeholder`);
  if (video && placeholder) {
    placeholder.style.display = "none";
    video.hidden = false;
  }
}

function showPlaceholder(videoId) {
  const video = document.getElementById(videoId);
  const placeholder = document.getElementById(`${videoId}Placeholder`);
  if (video && placeholder) {
    placeholder.style.display = "block";
    video.hidden = true;
    video.pause();
    video.srcObject = null;
  }
}
