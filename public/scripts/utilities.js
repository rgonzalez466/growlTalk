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
