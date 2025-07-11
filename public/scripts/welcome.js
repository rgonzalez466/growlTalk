    document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.login-button').forEach(button => {
    button.addEventListener('click', () => {

      // Fetch default values from server
      fetch('/env')
        .then(res => res.json())
        .then(data => {
        localStorage.setItem('growltalk_ip',  data.PROXY_SERVER_IP || '127.0.0.1');
        localStorage.setItem('growltalk_port', data.PROXY_SERVER_PORT || '7777');
        });


      const role = button.dataset.role;

      if (role === 'operator'){
          window.location.href = 'operator.html';
      }
      else
      { window.location.href = 'kiosk.html';  }
    
    });
  });
});
