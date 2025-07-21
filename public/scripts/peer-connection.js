const SCREEN_SHARE = "UScreenCapture";

// Global variable to store the peer connection
let peerConnection;

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

    thisSdpClient.audio = "NA";
    if (audioInputs.length > 0) {
      // Test actual audio access
      try {
        const testStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        testStream.getTracks().forEach((track) => track.stop());
        thisSdpClient.audio = audioInputs[0].label;
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

/////////////////////////////////////////////////////////////////////////////////////////
//  INITIALIZE PEER CONNECTION
/////////////////////////////////////////////////////////////////////////////////////////
async function initializePeerConnection(sdpClientMedia) {
  let hasAudio = sdpClientMedia.audioIn || false;
  let webcamDevice = null;
  let screenDevice = null;

  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoInputs = devices.filter((device) => device.kind === "videoinput");
  //  const audioInputs = devices.filter((device) => device.kind === "audioinput");

  for (const device of videoInputs) {
    if (device.label === SCREEN_SHARE) {
      thisSdpClient.desktopCam = device.label;
      screenDevice = device;
    } else {
      if (!webcamDevice) webcamDevice = device;
      thisSdpClient.webcamDevice = device.label;
    }
  }

  const localStream = new MediaStream();
  const desktopStream = new MediaStream();

  // === Initialize RTCPeerConnection ===
  peerConnection = new RTCPeerConnection();

  // === Webcam stream (for stream_id) ===
  if (webcamDevice) {
    const webcamStream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: { exact: webcamDevice.deviceId },
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { max: 30 },
      },
      audio: hasAudio,
    });

    const videoTrack = webcamStream.getVideoTracks()[0];

    const webcamWrapperStream = new MediaStream([videoTrack]);
    Object.defineProperty(webcamWrapperStream, "id", { value: "stream_id" });

    //    console.log(videoTrack);
    peerConnection.addTrack(videoTrack, webcamWrapperStream);
    localStream.addTrack(videoTrack);
    console.log("Added webcam track:", videoTrack.label);
  }

  // === UScreenCapture stream (for screen_id) ===
  if (screenDevice) {
    const screenStream = await navigator.mediaDevices.getUserMedia({
      video: {
        deviceId: { exact: screenDevice.deviceId },
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { max: 15 },
      },
      audio: false,
    });

    const screenTrack = screenStream.getVideoTracks()[0];

    // Create wrapper stream with screen_id
    const screenWrapperStream = new MediaStream([screenTrack]);
    Object.defineProperty(screenWrapperStream, "id", { value: "screen_id" });

    //console.log(screenTrack);
    peerConnection.addTrack(screenTrack, screenWrapperStream);
    desktopStream.addTrack(screenTrack);
    console.log("Added screen capture track:", screenTrack.label);
  }

  if (this.localVideo != null) {
    this.localVideo.srcObject = localStream;
    console.log("Local video srcObject set with webcam track");
  }
  if (this.localScreen != null) {
    this.localScreen.srcObject = desktopStream;
    console.log("Local desktop srcObject set with screen track");
  }
}

/////////////////////////////////////////////////////////////////////////////////////////
//  GENERATE SDP OFFER
/////////////////////////////////////////////////////////////////////////////////////////
async function generateSdpOffer() {
  if (!peerConnection) {
    console.error("❌ PeerConnection not initialized.");
    return null;
  }

  try {
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    output("===== SDP Offer Created ===== ");
    console.log("✅ SDP offer created:");
    output(offer.sdp);
    console.log("👉 Send this SDP to signalling server:", offer.sdp);
    return offer;
  } catch (err) {
    console.error("❌ Failed to create SDP offer:", err);
    return null;
  }
}

/////////////////////////////////////////////////////////////////////////////////////////
//  GENERATE SDP ANSWER
/////////////////////////////////////////////////////////////////////////////////////////
async function generateSdpAnswer() {
  if (!peerConnection) {
    console.error("❌ PeerConnection not initialized.");
    return null;
  }

  try {
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    output("===== SDP Answer Created =====");
    console.log("✅ SDP answer created:");
    output(answer.sdp);
    console.log("👉 Send this SDP to signalling server:", answer.sdp);
    return answer;
  } catch (err) {
    console.error("❌ Failed to create SDP answer:", err);
    return null;
  }
}
