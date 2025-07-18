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
// SHOW / HIDE LOG PANELS
/////////////////////////////////////////////////////////////////
logToggleBtn.addEventListener("click", () => {
  logPanel.classList.add("show");
});

hideLogBtn.addEventListener("click", () => {
  logPanel.classList.remove("show");
});

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
