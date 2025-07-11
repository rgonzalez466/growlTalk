// const bearNames = [
//   'Grizzly', 'Kodiak', 'Polar', 'Panda', 'BlackBear',
//   'SunBear', 'Spectacled', 'SlothBear', 'Spirit', 'MoonBear'
// ];

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.login-button').forEach(button => {
    button.addEventListener('click', () => {
      const role = button.dataset.role;
      // const bear = bearNames[Math.floor(Math.random() * bearNames.length)];
      // const username = role === 'operator' ? `!${bear}-operator` : `${bear}-kiosk`;

      // localStorage.setItem('growltalk_name', username);

      if (role === 'operator'){
  window.location.href = 'operator.html';
      }
      else
      {
          window.location.href = 'kiosk.html';
      }
    
    });
  });
});
