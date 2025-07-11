document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('settingsModal');
  const openBtn = document.querySelector('.settings-icon');
  const closeBtn = document.getElementById('closeModal');
  const saveBtn = document.getElementById('saveSettings');
  const ipInput = document.getElementById('serverIp');
  const portInput = document.getElementById('serverPort');

  // Open modal
  openBtn.addEventListener('click', () => {
    modal.style.display = 'block';

    // Fetch default values from server
    fetch('/env')
      .then(res => res.json())
      .then(data => {
        ipInput.value = data.PROXY_SERVER_IP || '';
        portInput.value = data.PROXY_SERVER_PORT || '';
      });

  });

  // Close modal
  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  // Save settings
  saveBtn.addEventListener('click', () => {
    localStorage.setItem('growltalk_ip', ipInput.value);
    localStorage.setItem('growltalk_port', portInput.value);
    modal.style.display = 'none';
  });
});
