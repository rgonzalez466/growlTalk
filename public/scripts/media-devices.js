const SCREEN_SHARE = "UScreenCapture";

////////////////////////////////////////////////////////////////////////////////////////
// LIST ALL AUDIO INPUT , AUDIO OUTPUT , AND VIDEO DEVICES
////////////////////////////////////////////////////////////////////////////////////////
async function listAllDevices() {
  let { audioIn, audioOut, webcam, desktopCam } = false;
  output("===== Available Media Devices ===== ");
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const grouped = {
      videoinput: [],
      audioinput: [],
      audiooutput: [],
    };

    for (const device of devices) {
      grouped[device.kind]?.push({
        label: device.label || "Label not available",
        deviceId: device.deviceId,
      });
      if (!device.label) {
        console.warn(
          "Some devices cannot be recognized , ensure your browser camera and mic are allowed for this site"
        );
        output(
          `📹️️️️🎤⚠️Some devices cannot be recognized , ensure your browser camera and mic are allowed for this site`
        );
      }
    }

    output("--- Video Inputs ---");

    grouped.videoinput.forEach((video, index) => {
      output(`📹️#${index} name : ${video.label} ,id : ${video.deviceId}`);
      if (video.label === SCREEN_SHARE) {
        desktopCam = true;
      } else {
        webcam = true;
      }
    });

    if (desktopCam === false) {
      showToast(
        `${SCREEN_SHARE} not found. You won't be able to share your screen`,
        error
      );
    }

    output("--- Audio Inputs ---");
    grouped.audioinput.forEach((mic, index) => {
      index + 1;
      output(`🎤#${index} name : ${mic.label} ,id : ${mic.deviceId}`);
    });

    if (grouped.audioinput.length > 0) {
      audioIn = true;
    } else {
      output(`❌🎤 No available audio in sources`);
      showToast(`No audio in devices found.`, "error");
    }

    output("--- Audio Outputs ---");
    grouped.audiooutput.forEach((speaker, index) => {
      index + 1;
      output(`🔊#${index} name : ${speaker.label} ,id : ${speaker.deviceId}`);
    });

    if (grouped.audiooutput.length > 0) {
      audioOut = true;
    } else {
      showToast(`No audio out devices found.`, "error");
      output(`❌🔊 No available audio out sources`);
    }

    return { audioIn, audioOut, webcam, desktopCam };
  } catch (err) {
    output("❌📹🎤🔊Failed to list devices:");
  }
}

/////////////////////////////////////////////////////////////////////////////////////////
//  DO A MINI VIDEO TEST AND ASK FOR BROWSER PERMISSIONS
/////////////////////////////////////////////////////////////////////////////////////////
async function checkVideoDevices() {
  const header = "===== TEST FOR VIDEO DEVICES ===== ";
  try {
    // Check if MediaDevices API is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      output(header);
      output("❌📷MediaDevices API not supported - video disabled");
      return false;
    }

    // Check for video input devices
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter(
      (device) => device.kind === "videoinput" && device.deviceId !== "default"
    );

    if (videoInputs.length > 0) {
      // Test actual video access
      try {
        const testStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        testStream.getTracks().forEach((track) => track.stop());
        output(header);
        output("✅📷 Video enabled: camera available and accessible");
        return true;
      } catch (videoError) {
        output(header);
        output(
          `⚠️📷 Video devices found but not accessible: ${videoError.message}`
        );
        return false;
      }
    } else {
      output(header);
      output("❌📷 No video input devices found");
      return false;
    }
  } catch (error) {
    output(header);
    output(`❌📷 Error checking video availability: ${error.message}`);
    return false;
  }
}

/////////////////////////////////////////////////////////////////////////////////////////
//  DO A MINI AUDIO IN TEST AND ASK FOR BROWSER PERMISSIONS
/////////////////////////////////////////////////////////////////////////////////////////
async function checkAudioDevices() {
  const header = "===== TEST FOR AUDIO DEVICES ===== ";
  try {
    // Check if MediaDevices API is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      output(header);
      output("❌🎤 MediaDevices API not supported - audio disabled");
      return false;
    }

    // Check for audio devices
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(
      (device) => device.kind === "audioinput" && device.deviceId !== "default"
    );

    if (audioInputs.length > 0) {
      // Test actual audio access
      try {
        const testStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        testStream.getTracks().forEach((track) => track.stop());
        output(header);
        output("✅🎤 Audio enabled: microphone available and accessible");
        return true;
      } catch (audioError) {
        output(header);
        output(
          `⚠️🎤 Audio devices found but not accessible: ${audioError.message}`
        );
        return false;
      }
    } else {
      output(header);
      output("❌🎤No audio input devices found - video only mode");
      return false;
    }
  } catch (error) {
    output(header);
    output(`❌🎤Error checking audio availability: ${error.message}`);
    return false;
  }
}

////////////////////////////////////////////////////////////////////////////////////////
// ON LOAD
////////////////////////////////////////////////////////////////////////////////////////
let thisClientMedia;

(async () => {
  if ((await checkVideoDevices()) === false) {
    console.warn("⚠️ No video devices detected on this client.");
    output("⚠️📷 No video devices detected on this client.");
  }

  if ((await checkAudioDevices()) === false) {
    console.warn("⚠️ No audio input (microphone) detected on this client.");
    output("⚠️🎤 No audio input (microphone) detected on this client.");
  }

  thisClientMedia = await listAllDevices();
  console.log("thisClientMedia:", thisClientMedia);
})();
