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

  // === Webcam stream with audio (for stream_id) ===
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

    // Add video track
    const videoTrack = webcamStream.getVideoTracks()[0];
    if (videoTrack) {
      const webcamWrapperStream = new MediaStream([videoTrack]);
      Object.defineProperty(webcamWrapperStream, "id", { value: "stream_id" });
      peerConnection.addTrack(videoTrack, webcamWrapperStream);
      localStream.addTrack(videoTrack);
      console.log("Added webcam video track:", videoTrack.label);
    }

    // Add audio track if available
    const audioTracks = webcamStream.getAudioTracks();
    if (audioTracks.length > 0 && hasAudio) {
      const audioTrack = audioTracks[0];
      const audioWrapperStream = new MediaStream([audioTrack]);
      Object.defineProperty(audioWrapperStream, "id", {
        value: "audio_stream_id",
      });
      peerConnection.addTrack(audioTrack, audioWrapperStream);
      localStream.addTrack(audioTrack);
      console.log("Added webcam audio track:", audioTrack.label);
    } else {
      console.log("No audio track available or audio disabled");
    }
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

    if (screenTrack) {
      const screenWrapperStream = new MediaStream([screenTrack]);
      Object.defineProperty(screenWrapperStream, "id", { value: "screen_id" });
      peerConnection.addTrack(screenTrack, screenWrapperStream);
      desktopStream.addTrack(screenTrack);
      console.log("Added screen capture track:", screenTrack.label);
    }
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
//  GENERATE SDP OFFER (KIOSK)
/////////////////////////////////////////////////////////////////////////////////////////
async function generateSdpOffer(callerId) {
  if (!peerConnection) {
    console.error("❌ PeerConnection not initialized.");
    return null;
  }

  try {
    // Set up ICE candidate handling for offer
    peerConnection.onicecandidate = async (event) => {
      // Event that fires off when a new offer ICE candidate is created
      if (event.candidate) {
        // console.log("New ICE candidate for offer:", event.candidate);

        // Here you can send the complete SDP offer with ICE candidates to your signaling server
        // The localDescription will be updated with ICE candidates
        if (peerConnection.localDescription) {
          //  console.log("Updated SDP offer with ICE candidates:");
          //   console.log(peerConnection.localDescription.sdp);

          // Check how many ICE candidates are in the SDP
          const candidateCount = (
            peerConnection.localDescription.sdp.match(/a=candidate/g) || []
          ).length;
          output(`🧊 ICE candidates in offer: ${candidateCount}`);

          // Send offer with icde candidate to  signaling server
          let kioskOfferPayload = {
            callerId: callerId,
            sdpOffer: {
              type: "offer",
              sdp: peerConnection.localDescription.sdp,
              caller: callerId,
            },
            callerStatus: "AVAILABLE",
          };

          await updateSdpClient(kioskOfferPayload);
        }
      } else {
        // ICE gathering complete
        console.log("✅ ICE gathering complete for offer");
      }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    output("===== SDP Offer Created ===== ");
    console.log("✅ SDP offer created:");
    output(offer.sdp);
    //console.log("👉 Send this SDP to signalling server:", offer.sdp);

    return offer;
  } catch (err) {
    console.error("❌ Failed to create SDP offer:", err);
    return null;
  }
}

/////////////////////////////////////////////////////////////////////////////////////////
//  GENERATE SDP ANSWER (OPERATOR)
/////////////////////////////////////////////////////////////////////////////////////////
async function generateSdpAnswer(remoteSdpOffer, kioskId, operatorId) {
  //console.log(remoteSdpOffer);

  if (!peerConnection || !remoteSdpOffer) {
    console.error("❌ PeerConnection not initialized or no SDP offer.");
    return null;
  }

  try {
    // Set up ICE candidate handling for answer
    peerConnection.onicecandidate = async (event) => {
      // Event that fires off when a new answer ICE candidate is created
      if (event.candidate) {
        // console.log("New ICE candidate for answer:", event.candidate);

        // send the complete SDP answer with ICE candidates to the signaling server
        // The localDescription will be updated with ICE candidates
        if (peerConnection.localDescription) {
          // console.log("Updated SDP answer with ICE candidates:");
          //   console.log(peerConnection.localDescription.sdp);

          // Check how many ICE candidates are in the SDP
          const candidateCount = (
            peerConnection.localDescription.sdp.match(/a=candidate/g) || []
          ).length;
          console.log(`🧊 ICE candidates in answer: ${candidateCount}`);

          let updateKioskPayload = {
            callerId: kioskId,
            sdpAnswer: {
              type: "answer",
              sdp: peerConnection.localDescription.sdp,
              caller: kioskId,
              callee: operatorId,
            },
            callerStatus: "BUSY",
          };

          let updateOperatorkPayload = {
            callerId: operatorId,
            sdpAnswer: {
              type: "answer",
              sdp: peerConnection.localDescription.sdp,
              caller: kioskId,
              callee: operatorId,
            },
            callerStatus: "BUSY",
          };

          //update kiosk status to busy
          await updateSdpClient(updateKioskPayload);
          //update operator status to busy
          thisSdpClient.callerStatus = "BUSY";
          await updateSdpClient(updateOperatorkPayload);
        }
      } else {
        // ICE gathering complete
        console.log("✅ ICE gathering complete for answer");
      }
    };

    await peerConnection.setRemoteDescription({
      type: "offer",
      sdp: remoteSdpOffer,
    });

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    output("✅ SDP answer created:");
    console.log("✅ SDP answer created:");
    //  console.log(answer.sdp);

    return answer;
  } catch (err) {
    console.error("❌ Failed to create SDP answer:", err);
    return null;
  }
}

/////////////////////////////////////////////////////////////////////////////////////////
//
/////////////////////////////////////////////////////////////////////////////////////////
// Helper function to handle incoming ICE candidates from remote peer
async function addIceCandidate(candidateData) {
  if (!peerConnection) {
    console.error("❌ PeerConnection not initialized.");
    return;
  }

  try {
    if (candidateData && candidateData.candidate) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidateData));
      console.log("✅ ICE candidate added successfully");
    }
  } catch (err) {
    console.error("❌ Failed to add ICE candidate:", err);
  }
}

// Function to apply the remote answer (caller uses this after receiving answer from callee)
async function applyRemoteSdpAnswer(remoteAnswer) {
  if (!peerConnection || !remoteAnswer) {
    console.error("❌ PeerConnection not initialized or no SDP answer.");
    return false;
  }

  try {
    // Extract SDP string if remoteAnswer is an object
    let sdpString;
    if (typeof remoteAnswer === "string") {
      sdpString = remoteAnswer;
    } else if (remoteAnswer.sdp) {
      sdpString = remoteAnswer.sdp;
    } else {
      throw new Error("Invalid SDP answer format");
    }

    // console.log("Setting remote answer:", sdpString);

    await peerConnection.setRemoteDescription({
      type: "answer",
      sdp: sdpString,
    });

    console.log("✅ Remote answer applied successfully");
    return true;
  } catch (err) {
    console.error("❌ Failed to apply remote answer:", err);
    return false;
  }
}

// Function to set up remote stream handling
function setupRemoteStreamHandling() {
  if (!peerConnection) {
    console.error("❌ PeerConnection not initialized.");
    return;
  }

  let streamCounter = 0; // Track received streams

  peerConnection.ontrack = (event) => {
    console.log("🎥 Received remote track:", event.track);

    event.streams.forEach((stream) => {
      console.log("📺 Remote stream received:", stream.id);

      // Handle different stream types based on your implementation
      if (stream.id === "stream_id") {
        // Webcam stream
        if (this.remoteVideo) {
          this.remoteVideo.srcObject = stream;
          console.log("Remote webcam video set");
        }
      } else if (stream.id === "screen_id") {
        // Screen share stream
        if (this.remoteScreen) {
          this.remoteScreen.srcObject = stream;
          console.log("Remote screen share video set");
        }
      } else {
        // Fallback - assign to available video elements based on order
        console.log("Assigning remote stream to video element");
        streamCounter++;

        if (streamCounter === 1) {
          // First stream goes to remoteVideo (webcam)
          const remoteVideo = document.getElementById("remoteVideo"); // Remote camera video element
          if (remoteVideo) {
            remoteVideo.srcObject = stream;
            console.log(
              "✅ First remote stream assigned to remoteVideo (remoteVideo)"
            );
          }
        } else if (streamCounter === 2) {
          // Second stream goes to remoteScreen (desktop)
          const remoteScreen = document.getElementById("remoteScreen"); // Remote desktop video element
          if (remoteScreen) {
            remoteScreen.srcObject = stream;
            console.log(
              "✅ Second remote stream assigned to remoteScreen (remoteScreen)"
            );
          }
        }
      }
    });
  };

  // Monitor connection state
  peerConnection.onconnectionstatechange = () => {
    console.log("🔗 Connection state:", peerConnection.connectionState);

    switch (peerConnection.connectionState) {
      case "connected":
        console.log("✅ Peer connection established successfully!");
        break;
      case "disconnected":
        console.log("⚠️ Peer connection disconnected");
        break;
      case "failed":
        console.log("❌ Peer connection failed");
        break;
      case "closed":
        console.log("🔒 Peer connection closed");
        break;
    }
  };

  // Monitor ICE connection state
  peerConnection.oniceconnectionstatechange = () => {
    console.log("🧊 ICE connection state:", peerConnection.iceConnectionState);
  };
}
