const bearNames = [
  'Grizzly', 'Kodiak', 'Polar', 'Panda', 'BlackBear',
  'SunBear', 'Spectacled', 'SlothBear', 'Spirit', 'MoonBear'
];

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.login-button').forEach(button => {
    button.addEventListener('click', () => {
      const role = button.dataset.role;
      const bear = bearNames[Math.floor(Math.random() * bearNames.length)];
      const name = role === 'operator' ? `!${bear}-operator` : `${bear}-kiosk`;

      // Save both name and server values for index.html
      localStorage.setItem('growltalk_name', name);

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
