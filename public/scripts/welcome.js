document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".login-button").forEach((button) => {
    button.addEventListener("click", () => {
      const role = button.dataset.role;

      if (role === "operator") {
        window.location.href = "operator.html";
      } else {
        window.location.href = "kiosk.html";
      }
    });
  });
});
