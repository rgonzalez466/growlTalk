const SCREEN_SHARE = "UScreenCapture";

////////////////////////////////////////////////////////////////////////////////////////
// LIST ALL AUDIO INPUT , AUDIO OUTPUT , AND VIDEO DEVICES
////////////////////////////////////////////////////////////////////////////////////////
async function listAllDevices() {
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

    output("===== Available Media Devices ===== ");
    output("--- Video Inputs ---");
    grouped.videoinput.forEach((video, index) => {
      output(`📹️#${index} name : ${video.label} ,id : ${video.deviceId}`);
    });

    output("--- Audio Inputs ---");
    grouped.audioinput.forEach((mic, index) => {
      index + 1;
      output(`🎤#${index} name : ${mic.label} ,id : ${mic.deviceId}`);
    });

    output("--- Audio Outputs ---");
    grouped.audiooutput.forEach((speaker, index) => {
      index + 1;
      output(`🔊#${index} name : ${speaker.label} ,id : ${speaker.deviceId}`);
    });
  } catch (err) {
    output("❌📹🎤🔊Failed to list devices:");
  }
}
////////////////////////////////////////////////////////////////////////////////////////
// ON LOAD
////////////////////////////////////////////////////////////////////////////////////////
listAllDevices();
