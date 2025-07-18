"use strict";

const UTYPE_KIOSK = "kiosk";

////////////////////////////////////////////////////////////////////////////////////////
// ON LOAD
////////////////////////////////////////////////////////////////////////////////////////
(async () => {
  const refreshTimer = (await getEnvVars().DELETE_TIMER) || 10000;
  const callerId = await signIn(UTYPE_KIOSK, getKioskName());
  if (callerId) {
    setInterval(() => keepSessionAlive(callerId), refreshTimer / 2); // call every 10s
  }
})();

//checkDevices();
