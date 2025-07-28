"use strict";

import express from "express";
import fs from "fs";
import https from "https";
import path from "path";
import dotenv from "dotenv";
import { getCurrentDateTime } from "./controllers/misc.js";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { styleText } from "node:util";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";

///////////////////////////////////////////////////////////////////////////////////////////////////
// GLOBAL VARS
///////////////////////////////////////////////////////////////////////////////////////////////////

dotenv.config();
const KIOSK_USER = "kiosk";
const OPERATOR_USER = "operator";

let sdpClients = [];
//let operatorSSEStreams = []; // List of SSE response streams

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const port = process.env.SERVER_PORT || 9999;
const app = express();
const DELETE_TIMER = process.env.DELETE_TIMER * 1000 || 20000;

app.use(cors());
app.use(express.json());

///////////////////////////////////////////////////////////////////////////////////////////////////
// SERVE STATIC FILES IN THE PUBLIC FOLDER
///////////////////////////////////////////////////////////////////////////////////////////////////
app.use(
  express.static(path.join(__dirname, "public"), {
    index: false,
  })
);

///////////////////////////////////////////////////////////////////////////////////////////////////
// SET WELCOME HTML AS THE HOME PAGE
///////////////////////////////////////////////////////////////////////////////////////////////////
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "welcome.html"));
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// GET ENV VALUES
///////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * @swagger
 * /env:
 *   get:
 *     summary: Get environment configuration values
 *     tags: [Environment]
 *     responses:
 *       200:
 *         description: Returns environment variables
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 DELETE_TIMER:
 *                   type: string
 *                   example: "20"
 */
app.get("/env", (req, res) => {
  res.json({
    DELETE_TIMER: process.env.DELETE_TIMER,
  });
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// AUTO DELETE STALE SESSIONS
///////////////////////////////////////////////////////////////////////////////////////////////////
setInterval(() => {
  const now = Date.now();
  const before = sdpClients.length;

  const expiredClients = [];
  const activeClients = [];

  sdpClients.forEach((client) => {
    if (now + DELETE_TIMER / 2 - client.callerLastMessageOn < 0) {
      activeClients.push(client);
    } else {
      expiredClients.push(client);
    }
  });

  if (expiredClients.length > 0) {
    console.log("🗑️ Removed inactive clients:", expiredClients);
  }

  sdpClients = activeClients;

  const after = sdpClients.length;
  if (before !== after) {
    console.log(
      styleText(
        "magenta",
        `Cleaned up ${before - after} stale clients. Remaining: ${after}`
      )
    );
  }
}, DELETE_TIMER / 2); // check for unused session,  every session half life

///////////////////////////////////////////////////////////////////////////////////////////////////
// SIGN IN CALLERS (KIOSK AND OPERATOR)
///////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * @swagger
 * /sign-in:
 *   get:
 *     summary: Sign in a caller (kiosk or operator)
 *     tags: [Caller]
 *     parameters:
 *       - in: query
 *         name: callerType
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: callerName
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Returns caller id
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 callerId:
 *                   type: integer
 *                   example: 1753670376781
 *       400:
 *         description: Missing or invalid parameters
 */
app.get("/sign-in", (req, res) => {
  const { callerType, callerName } = req.query;

  // console.log(
  //   styleText(
  //     "blue",
  //     `SIGN IN REQUEST: ===> ` +
  //       `callerType: ${callerType || "Not provided"} , ` +
  //       `callerName: ${callerName || "Not provided"}`
  //   )
  // );

  if (
    callerType &&
    callerName &&
    (callerType === KIOSK_USER || callerType === OPERATOR_USER)
  ) {
    let currentMilliseconds = Date.now();
    currentMilliseconds = currentMilliseconds + DELETE_TIMER;

    sdpClients.push({
      callerId: currentMilliseconds,
      callerType: callerType,
      callerName: callerName,
      callerStatus: "AVAILABLE",
      callerLastMessageOn: currentMilliseconds,
      callerConnectedOn: currentMilliseconds,
      callerConnectedWith: null,
      sdpOffer: null,
      sdpAnswer: null,
      callerConnectedSince: getCurrentDateTime(),
      callerIceCandidate: null,
    });

    // console.log(
    //   styleText(
    //     "cyan",
    //     `SIGN IN RESPONSE ===> callerId: ${currentMilliseconds} was assigned to ${callerType}:${callerName}`
    //   )
    // );

    // console.log(sdpClients);
    // console.log("=====================================");

    res.status(200).json({ callerId: currentMilliseconds });
  } else {
    console.log(
      styleText(
        "red",
        `SIGN IN RESPONSE ===> Missing Parameters / Invalid Caller Type ... ${callerType}:${callerName}`
      )
    );

    res.status(400).json({
      callerType: callerType,
      callerName: callerName,
      message: "Missing Parameters / Invalid Caller Type",
    });
  }
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// MAINTAIN CALLERS SESSION (KIOSK AND OPERATOR)
///////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * @swagger
 * /keep-session:
 *   get:
 *     summary: Extend a caller session
 *     tags: [Caller]
 *     parameters:
 *       - in: query
 *         name: callerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Caller session details after extension
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 callerId:
 *                   type: integer
 *                   example: 1753671282356
 *                 callerType:
 *                   type: string
 *                   example: "kiosk"
 *                 callerName:
 *                   type: string
 *                   example: "SunBear"
 *                 callerStatus:
 *                   type: string
 *                   example: "BUSY"
 *                 callerLastMessageOn:
 *                   type: integer
 *                   example: 1753671299782
 *                 callerConnectedOn:
 *                   type: integer
 *                   example: 1753671282356
 *                 callerConnectedWith:
 *                   type: string
 *                   nullable: true
 *                   example: null
 *                 sdpOffer:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     type:
 *                       type: string
 *                       example: "offer"
 *                     sdp:
 *                       type: string
 *                       example: "v=0\\r\\no=- 4045909618533547915 2 IN IP4 127.0.0.1\\r\\ns=-\\r\\nt=0 0\\r\\na= ..."
 *                     caller:
 *                       type: integer
 *                       example: 1753671282356
 *                 sdpAnswer:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     type:
 *                       type: string
 *                       example: "answer"
 *                     sdp:
 *                       type: string
 *                       example: "v=0\\r\\no=- 7947950788329746695 2 IN IP4 127.0.0.1\\r\\ns=-\\r\\nt=0 0\\r\\na=group:BUNDLE ..."
 *                     caller:
 *                       type: integer
 *                       example: 1753671282356
 *                     callee:
 *                       type: integer
 *                       example: 1753671266772
 *                 callerConnectedSince:
 *                   type: string
 *                   example: "28-07-2025 10:53:42"
 *                 callerIceCandidate:
 *                   type: object
 *                   nullable: true
 *       400:
 *         description: Missing callerId
 *       404:
 *         description: Caller not found
 */

app.get("/keep-session", (req, res) => {
  const { callerId } = req.query;

  // console.log(
  //   styleText(
  //     "blue",
  //     `KEEP SESSION REQUEST: ===> ` + `callerId: ${callerId || "Not provided"}`
  //   )
  // );

  const foundIndex = sdpClients.findIndex((sdpClient) => {
    return String(sdpClient.callerId) === String(callerId);
  });

  if (callerId && foundIndex !== -1) {
    const timer = Date.now() + DELETE_TIMER;
    sdpClients[foundIndex].callerLastMessageOn = timer;

    // console.log(
    //   styleText(
    //     "cyan",
    //     `KEEP SESSION RESPONSE ===> callerId: ${callerId}  session was extended to ${timer}`
    //   )
    // );

    res.status(200).json(sdpClients[foundIndex]);
  } else if (!callerId) {
    console.log(
      styleText(
        "red",
        `KEEP SESSION RESPONSE ===> app was expecting parametere callerId but instead got ${req.query}`
      )
    );
    res.status(400).json({ message: `parameter callerId Not found` });
  } else {
    // no match
    console.log(
      styleText(
        "red",
        `KEEP SESSION RESPONSE ===> Client with callerId '${callerId}' not found for timestamp update.`
      )
    );

    res.status(404).json({ callerId: callerId, message: "callerId not found" });
  }
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// SIGN OUT CALLERS (KIOSK AND OPERATOR)
///////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * @swagger
 * /sign-out:
 *   get:
 *     summary: Sign out a caller by callerId
 *     tags: [Caller]
 *     parameters:
 *       - in: query
 *         name: callerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Caller successfully signed out
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 callerId:
 *                   type: integer
 *                   example: 1753670376781
 *                 message:
 *                   type: string
 *                   example: "Caller Id has signed out"
 *       404:
 *         description: CallerId not found
 */

app.get("/sign-out", (req, res) => {
  const { callerId } = req.query;
  console.log(
    styleText(
      "blue",
      `SIGN OUT REQUEST ===> callerType: ${callerId || "Not provided"}`
    )
  );

  const foundIndex = sdpClients.findIndex((sdpClient) => {
    return String(sdpClient.callerId) === String(callerId);
  });

  // delete the caller id from array
  if (callerId && foundIndex !== -1) {
    sdpClients = [
      ...sdpClients.slice(0, foundIndex),
      ...sdpClients.slice(foundIndex + 1),
    ];

    console.log(
      styleText(
        "cyan",
        `SIGN OUT RESPONSE ===> callerId ${callerId} was removed `
      )
    );

    res
      .status(200)
      .json({ callerId: callerId, message: "Caller Id has signed out" });
    //caller not found exception
  } else {
    console.log(
      styleText("red", `SIGN OUT RESPONSE ===> callerId ${callerId} not found `)
    );

    res
      .status(404)
      .json({ callerId: callerId, message: "Caller Id not found" });
  }
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// GET ALL CALLERS (KIOSK AND OPERATOR) ... WITH OPTION TO FILTER BY CALLER STATUS , CALLER TYPE, CALLER ID ,MAX RESULTS (LIMIT) AND LONG POLL (WAIT)
///////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * @swagger
 * /callers:
 *   get:
 *     summary: Get connected callers (kiosk and operator) information
 *     tags: [Callers]
 *     parameters:
 *       - in: query
 *         name: callerStatus
 *         description: Filter request with caller Status ("AVAILABLE", "BUSY", "INCALL")
 *         schema:
 *           type: string
 *       - in: query
 *         name: callerType
 *         description: Filter request with Caller Type ("kiosk", "operator")
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         description: Maximum number of results to return
 *         schema:
 *           type: integer
 *       - in: query
 *         name: wait
 *         description: Wait up to X seconds for matching callers if none are found initially
 *         schema:
 *           type: integer
 *       - in: query
 *         name: callerId
 *         description: Filter by callerId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of filtered callers with matching filter criteria
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalClients:
 *                   type: integer
 *                   example: 2
 *                 filteredSdpClients:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       callerId:
 *                         type: integer
 *                         example: 1753669815759
 *                       callerType:
 *                         type: string
 *                         example: "operator"
 *                       callerName:
 *                         type: string
 *                         example: "Misha"
 *                       callerStatus:
 *                         type: string
 *                         example: "BUSY"
 *                       callerLastMessageOn:
 *                         type: integer
 *                         example: 1753669820813
 *                       callerConnectedOn:
 *                         type: integer
 *                         example: 1753669815759
 *                       callerConnectedWith:
 *                         type: string
 *                         nullable: true
 *                         example: null
 *                       sdpOffer:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           type:
 *                             type: string
 *                             example: "offer"
 *                           sdp:
 *                             type: string
 *                             example: "v=0o=- 4691723812634575029 2 IN IP4 127.0.0.1s=-t=0 0a=group:BUNDLE 0 1a=extmap-allow-mixeda=msid-semantic: WMS 7f9d233c-deec-45f2-b011-04d506909c9fm=video 55674 UDP/TLS/RTP/SAVPF 96 97 103 104 107 108 109 114 115 116 117 118 39 40 45 46 98 99 100 101 119 120 121c=IN IP4 192.168.1.234a=rtcp:9 IN IP4 0.0.0.0a=candidate:2046901571 1 udp 2122260223 192.168.1.234 55674 typ host generation 0 network-id 1a=candidate:1682428193 1 udp 2122194687 192.168.1.159 55675 typ host generation 0 network-id 2a=candidate:80666587 1 tcp 1518280447 192.168.1.234 9 typ host tcptype active generation 0 network-id 1a=candidate:445133753 1 tcp 1518214911 192.168.1.159 9 typ host tcptype active generation 0 network-id 2a=ice-ufrag:66bha=ice-pwd:PwmMDBBZolY9M5IwXNQkGokWa=ice-options:tricklea=fingerprint:sha-256 65:25:58:BB:47:42:96:45:62:65:CB:68:66:BF:80:A7:9B:24:52:73:AE:BB:F0:78:D1:DC:97:2A:FE:3F:29:F1a=setup:actpassa=mid:0a=extmap:1 urn:ietf:params:rtp-hdrext:toffseta=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-timea=extmap:3 urn:3gpp:video-orientationa=extmap:4 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01a=extmap:5 http://www.webrtc.org/experiments/rtp-hdrext/playout-delaya=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/video-content-typea=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-timinga=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/color-spacea=extmap:9 urn:ietf:params:rtp-hdrext:sdes:mida=extmap:10 urn:ietf:params:rtp-hdrext:sdes:rtp-stream-ida=extmap:11 urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-ida=sendrecva=msid:7f9d233c-deec-45f2-b011-04d506909c9f 046560de-c064-4f10-8555-815bdf047f71a=rtcp-muxa=rtcp-rsizea=rtpmap:96 VP8/90000a=rtcp-fb:96 goog-remba=rtcp-fb:96 transport-cca=rtcp-fb:96 ccm fira=rtcp-fb:96 nacka=rtcp-fb:96 nack plia=rtpmap:97 rtx/90000a=fmtp:97 apt=96a=rtpmap:103 H264/90000a=rtcp-fb:103 goog-remba=rtcp-fb:103 transport-cca=rtcp-fb:103 ccm fira=rtcp-fb:103 nacka=rtcp-fb:103 nack plia=fmtp:103 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42001fa=rtpmap:104 rtx/90000a=fmtp:104 apt=103a=rtpmap:107 H264/90000a=rtcp-fb:107 goog-remba=rtcp-fb:107 transport-cca=rtcp-fb:107 ccm fira=rtcp-fb:107 nacka=rtcp-fb:107 nack plia=fmtp:107 level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=42001fa=rtpmap:108 rtx/90000a=fmtp:108 apt=107a=rtpmap:109 H264/90000a=rtcp-fb:109 goog-remba=rtcp-fb:109 transport-cca=rtcp-fb:109 ccm fira=rtcp-fb:109 nacka=rtcp-fb:109 nack plia=fmtp:109 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01fa=rtpmap:114 rtx/90000a=fmtp:114 apt=109a=rtpmap:115 H264/90000a=rtcp-fb:115 goog-remba=rtcp-fb:115 transport-cca=rtcp-fb:115 ccm fira=rtcp-fb:115 nacka=rtcp-fb:115 nack plia=fmtp:115 level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=42e01fa=rtpmap:116 rtx/90000a=fmtp:116 apt=115a=rtpmap:117 H264/90000a=rtcp-fb:117 goog-remba=rtcp-fb:117 transport-cca=rtcp-fb:117 ccm fira=rtcp-fb:117 nacka=rtcp-fb:117 nack plia=fmtp:117 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=4d001fa=rtpmap:118 rtx/90000a=fmtp:118 apt=117a=rtpmap:39 H264/90000a=rtcp-fb:39 goog-remba=rtcp-fb:39 transport-cca=rtcp-fb:39 ccm fira=rtcp-fb:39 nacka=rtcp-fb:39 nack plia=fmtp:39 level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=4d001fa=rtpmap:40 rtx/90000a=fmtp:40 apt=39a=rtpmap:45 AV1/90000a=rtcp-fb:45 goog-remba=rtcp-fb:45 transport-cca=rtcp-fb:45 ccm fira=rtcp-fb:45 nacka=rtcp-fb:45 nack plia=fmtp:45 level-idx=5;profile=0;tier=0a=rtpmap:46 rtx/90000a=fmtp:46 apt=45a=rtpmap:98 VP9/90000a=rtcp-fb:98 goog-remba=rtcp-fb:98 transport-cca=rtcp-fb:98 ccm fira=rtcp-fb:98 nacka=rtcp-fb:98 nack plia=fmtp:98 profile-id=0a=rtpmap:99 rtx/90000a=fmtp:99 apt=98a=rtpmap:100 VP9/90000a=rtcp-fb:100 goog-remba=rtcp-fb:100 transport-cca=rtcp-fb:100 ccm fira=rtcp-fb:100 nacka=rtcp-fb:100 nack plia=fmtp:100 profile-id=2a=rtpmap:101 rtx/90000a=fmtp:101 apt=100a=rtpmap:119 red/90000a=rtpmap:120 rtx/90000a=fmtp:120 apt=119a=rtpmap:121 ulpfec/90000a=ssrc-group:FID 2617136708 815239152a=ssrc:2617136708 cname:g3QMBlhIg1c0/GY/a=ssrc:2617136708 msid:7f9d233c-deec-45f2-b011-04d506909c9f 046560de-c064-4f10-8555-815bdf047f71a=ssrc:815239152 cname:g3QMBlhIg1c0/GY/a=ssrc:815239152 msid:7f9d233c-deec-45f2-b011-04d506909c9f 046560de-c064-4f10-8555-815bdf047f71m=video 55676 UDP/TLS/RTP/SAVPF 96 97 103 104 107 108 109 114 115 116 117 118 39 40 45 46 98 99 100 101 119 120 121c=IN IP4 192.168.1.234a=rtcp:9 IN IP4 0.0.0.0a=candidate:2046901571 1 udp 2122260223 192.168.1.234 55676 typ host generation 0 network-id 1a=candidate:1682428193 1 udp 2122194687 192.168.1.159 55677 typ host generation 0 network-id 2a=candidate:80666587 1 tcp 1518280447 192.168.1.234 9 typ host tcptype active generation 0 network-id 1a=candidate:445133753 1 tcp 1518214911 192.168.1.159 9 typ host tcptype active generation 0 network-id 2a=ice-ufrag:66bha=ice-pwd:PwmMDBBZolY9M5IwXNQkGokWa=ice-options:tricklea=fingerprint:sha-256 65:25:58:BB:47:42:96:45:62:65:CB:68:66:BF:80:A7:9B:24:52:73:AE:BB:F0:78:D1:DC:97:2A:FE:3F:29:F1a=setup:actpassa=mid:1a=extmap:1 urn:ietf:params:rtp-hdrext:toffseta=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-timea=extmap:3 urn:3gpp:video-orientationa=extmap:4 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01a=extmap:5 http://www.webrtc.org/experiments/rtp-hdrext/playout-delaya=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/video-content-typea=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-timinga=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/color-spacea=extmap:9 urn:ietf:params:rtp-hdrext:sdes:mida=extmap:10 urn:ietf:params:rtp-hdrext:sdes:rtp-stream-ida=extmap:11 urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-ida=sendrecva=msid:2b3f1d5a-0db0-41ff-b3c4-4a52b9521f98 4be34cee-5e81-497b-8f55-734544090a94a=rtcp-muxa=rtcp-rsizea=rtpmap:96 VP8/90000a=rtcp-fb:96 goog-remba=rtcp-fb:96 transport-cca=rtcp-fb:96 ccm fira=rtcp-fb:96 nacka=rtcp-fb:96 nack plia=rtpmap:97 rtx/90000a=fmtp:97 apt=96a=rtpmap:103 H264/90000a=rtcp-fb:103 goog-remba=rtcp-fb:103 transport-cca=rtcp-fb:103 ccm fira=rtcp-fb:103 nacka=rtcp-fb:103 nack plia=fmtp:103 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42001fa=rtpmap:104 rtx/90000a=fmtp:104 apt=103a=rtpmap:107 H264/90000a=rtcp-fb:107 goog-remba=rtcp-fb:107 transport-cca=rtcp-fb:107 ccm fira=rtcp-fb:107 nacka=rtcp-fb:107 nack plia=fmtp:107 level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=42001fa=rtpmap:108 rtx/90000a=fmtp:108 apt=107a=rtpmap:109 H264/90000a=rtcp-fb:109 goog-remba=rtcp-fb:109 transport-cca=rtcp-fb:109 ccm fira=rtcp-fb:109 nacka=rtcp-fb:109 nack plia=fmtp:109 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01fa=rtpmap:114 rtx/90000a=fmtp:114 apt=109a=rtpmap:115 H264/90000a=rtcp-fb:115 goog-remba=rtcp-fb:115 transport-cca=rtcp-fb:115 ccm fira=rtcp-fb:115 nacka=rtcp-fb:115 nack plia=fmtp:115 level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=42e01fa=rtpmap:116 rtx/90000a=fmtp:116 apt=115a=rtpmap:117 H264/90000a=rtcp-fb:117 goog-remba=rtcp-fb:117 transport-cca=rtcp-fb:117 ccm fira=rtcp-fb:117 nacka=rtcp-fb:117 nack plia=fmtp:117 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=4d001fa=rtpmap:118 rtx/90000a=fmtp:118 apt=117a=rtpmap:39 H264/90000a=rtcp-fb:39 goog-remba=rtcp-fb:39 transport-cca=rtcp-fb:39 ccm fira=rtcp-fb:39 nacka=rtcp-fb:39 nack plia=fmtp:39 level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=4d001fa=rtpmap:40 rtx/90000a=fmtp:40 apt=39a=rtpmap:45 AV1/90000a=rtcp-fb:45 goog-remba=rtcp-fb:45 transport-cca=rtcp-fb:45 ccm fira=rtcp-fb:45 nacka=rtcp-fb:45 nack plia=fmtp:45 level-idx=5;profile=0;tier=0a=rtpmap:46 rtx/90000a=fmtp:46 apt=45a=rtpmap:98 VP9/90000a=rtcp-fb:98 goog-remba=rtcp-fb:98 transport-cca=rtcp-fb:98 ccm fira=rtcp-fb:98 nacka=rtcp-fb:98 nack plia=fmtp:98 profile-id=0a=rtpmap:99 rtx/90000a=fmtp:99 apt=98a=rtpmap:100 VP9/90000a=rtcp-fb:100 goog-remba=rtcp-fb:100 transport-cca=rtcp-fb:100 ccm fira=rtcp-fb:100 nacka=rtcp-fb:100 nack plia=fmtp:100 profile-id=2a=rtpmap:101 rtx/90000a=fmtp:101 apt=100a=rtpmap:119 red/90000a=rtpmap:120 rtx/90000a=fmtp:120 apt=119a=rtpmap:121 ulpfec/90000a=ssrc-group:FID 2447693723 2189512708a=ssrc:2447693723 cname:g3QMBlhIg1c0/GY/a=ssrc:2447693723 msid:2b3f1d5a-0db0-41ff-b3c4-4a52b9521f98 4be34cee-5e81-497b-8f55-734544090a94a=ssrc:2189512708 cname:g3QMBlhIg1c0/GY/a=ssrc:2189512708 msid:2b3f1d5a-0db0-41ff-b3c4-4a52b9521f98 4be34cee-5e81-497b-8f55-734544090a94"
 *                           caller:
 *                             type: integer
 *                             example: 1753669819018
 *                       sdpAnswer:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           type:
 *                             type: string
 *                             example: "answer"
 *                           sdp:
 *                             type: string
 *                             example: "v=0o=- 1896851446026308321 2 IN IP4 127.0.0.1s=-t=0 0a=group:BUNDLE 0 1a=extmap-allow-mixeda=msid-semantic: WMS a2ede0df-37ce-4847-9abe-68fa84007dfdm=video 50864 UDP/TLS/RTP/SAVPF 96 97 103 104 107 108 109 114 115 116 117 118 39 40 45 46 98 99 100 101 119 120 121c=IN IP4 172.31.48.1a=rtcp:9 IN IP4 0.0.0.0a=candidate:4201981983 1 udp 2122260223 172.31.48.1 50864 typ host generation 0 network-id 2a=candidate:108228907 1 udp 2122194687 192.168.1.184 50865 typ host generation 0 network-id 1 network-cost 10a=candidate:81788043 1 tcp 1518280447 172.31.48.1 9 typ host tcptype active generation 0 network-id 2a=candidate:4175013311 1 tcp 1518214911 192.168.1.184 9 typ host tcptype active generation 0 network-id 1 network-cost 10a=ice-ufrag:e2C3a=ice-pwd:Ir+xz8UtMbt2ANZeNDyBXwJga=ice-options:tricklea=fingerprint:sha-256 84:32:BA:B7:90:3D:A5:DF:2A:2F:E7:0D:E6:A7:70:69:80:87:08:99:10:8F:F7:BC:FA:5C:C9:1B:34:ED:B2:F4a=setup:activea=mid:0a=extmap:1 urn:ietf:params:rtp-hdrext:toffseta=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-timea=extmap:3 urn:3gpp:video-orientationa=extmap:4 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01a=extmap:5 http://www.webrtc.org/experiments/rtp-hdrext/playout-delaya=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/video-content-typea=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-timinga=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/color-spacea=extmap:9 urn:ietf:params:rtp-hdrext:sdes:mida=extmap:10 urn:ietf:params:rtp-hdrext:sdes:rtp-stream-ida=extmap:11 urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-ida=sendrecva=msid:a2ede0df-37ce-4847-9abe-68fa84007dfd f53b4b23-ca08-4eb3-8106-8d5393b0369fa=rtcp-muxa=rtcp-rsizea=rtpmap:96 VP8/90000a=rtcp-fb:96 goog-remba=rtcp-fb:96 transport-cca=rtcp-fb:96 ccm fira=rtcp-fb:96 nacka=rtcp-fb:96 nack plia=rtpmap:97 rtx/90000a=fmtp:97 apt=96a=rtpmap:103 H264/90000a=rtcp-fb:103 goog-remba=rtcp-fb:103 transport-cca=rtcp-fb:103 ccm fira=rtcp-fb:103 nacka=rtcp-fb:103 nack plia=fmtp:103 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42001fa=rtpmap:104 rtx/90000a=fmtp:104 apt=103a=rtpmap:107 H264/90000a=rtcp-fb:107 goog-remba=rtcp-fb:107 transport-cca=rtcp-fb:107 ccm fira=rtcp-fb:107 nacka=rtcp-fb:107 nack plia=fmtp:107 level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=42001fa=rtpmap:108 rtx/90000a=fmtp:108 apt=107a=rtpmap:109 H264/90000a=rtcp-fb:109 goog-remba=rtcp-fb:109 transport-cca=rtcp-fb:109 ccm fira=rtcp-fb:109 nacka=rtcp-fb:109 nack plia=fmtp:109 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01fa=rtpmap:114 rtx/90000a=fmtp:114 apt=109a=rtpmap:115 H264/90000a=rtcp-fb:115 goog-remba=rtcp-fb:115 transport-cca=rtcp-fb:115 ccm fira=rtcp-fb:115 nacka=rtcp-fb:115 nack plia=fmtp:115 level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=42e01fa=rtpmap:116 rtx/90000a=fmtp:116 apt=115a=rtpmap:117 H264/90000a=rtcp-fb:117 goog-remba=rtcp-fb:117 transport-cca=rtcp-fb:117 ccm fira=rtcp-fb:117 nacka=rtcp-fb:117 nack plia=fmtp:117 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=4d001fa=rtpmap:118 rtx/90000a=fmtp:118 apt=117a=rtpmap:39 H264/90000a=rtcp-fb:39 goog-remba=rtcp-fb:39 transport-cca=rtcp-fb:39 ccm fira=rtcp-fb:39 nacka=rtcp-fb:39 nack plia=fmtp:39 level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=4d001fa=rtpmap:40 rtx/90000a=fmtp:40 apt=39a=rtpmap:45 AV1/90000a=rtcp-fb:45 goog-remba=rtcp-fb:45 transport-cca=rtcp-fb:45 ccm fira=rtcp-fb:45 nacka=rtcp-fb:45 nack plia=fmtp:45 level-idx=5;profile=0;tier=0a=rtpmap:46 rtx/90000a=fmtp:46 apt=45a=rtpmap:98 VP9/90000a=rtcp-fb:98 goog-remba=rtcp-fb:98 transport-cca=rtcp-fb:98 ccm fira=rtcp-fb:98 nacka=rtcp-fb:98 nack plia=fmtp:98 profile-id=0a=rtpmap:99 rtx/90000a=fmtp:99 apt=98a=rtpmap:100 VP9/90000a=rtcp-fb:100 goog-remba=rtcp-fb:100 transport-cca=rtcp-fb:100 ccm fira=rtcp-fb:100 nacka=rtcp-fb:100 nack plia=fmtp:100 profile-id=2a=rtpmap:101 rtx/90000a=fmtp:101 apt=100a=rtpmap:119 red/90000a=rtpmap:120 rtx/90000a=fmtp:120 apt=119a=rtpmap:121 ulpfec/90000a=ssrc-group:FID 215716257 619846521a=ssrc:215716257 cname:jXpjExZwm1R6wyP4a=ssrc:619846521 cname:jXpjExZwm1R6wyP4m=video 9 UDP/TLS/RTP/SAVPF 96 97 103 104 107 108 109 114 115 116 117 118 39 40 45 46 98 99 100 101 119 120 121c=IN IP4 0.0.0.0a=rtcp:9 IN IP4 0.0.0.0a=ice-ufrag:e2C3a=ice-pwd:Ir+xz8UtMbt2ANZeNDyBXwJga=ice-options:tricklea=fingerprint:sha-256 84:32:BA:B7:90:3D:A5:DF:2A:2F:E7:0D:E6:A7:70:69:80:87:08:99:10:8F:F7:BC:FA:5C:C9:1B:34:ED:B2:F4a=setup:activea=mid:1a=extmap:1 urn:ietf:params:rtp-hdrext:toffseta=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-timea=extmap:3 urn:3gpp:video-orientationa=extmap:4 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01a=extmap:5 http://www.webrtc.org/experiments/rtp-hdrext/playout-delaya=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/video-content-typea=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-timinga=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/color-spacea=extmap:9 urn:ietf:params:rtp-hdrext:sdes:mida=extmap:10 urn:ietf:params:rtp-hdrext:sdes:rtp-stream-ida=extmap:11 urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-ida=sendrecva=msid:ed320bcd-dbb5-4542-b834-aec7ab037e72 aa33d221-46be-428a-818b-207a733c7450a=rtcp-muxa=rtcp-rsizea=rtpmap:96 VP8/90000a=rtcp-fb:96 goog-remba=rtcp-fb:96 transport-cca=rtcp-fb:96 ccm fira=rtcp-fb:96 nacka=rtcp-fb:96 nack plia=rtpmap:97 rtx/90000a=fmtp:97 apt=96a=rtpmap:103 H264/90000a=rtcp-fb:103 goog-remba=rtcp-fb:103 transport-cca=rtcp-fb:103 ccm fira=rtcp-fb:103 nacka=rtcp-fb:103 nack plia=fmtp:103 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42001fa=rtpmap:104 rtx/90000a=fmtp:104 apt=103a=rtpmap:107 H264/90000a=rtcp-fb:107 goog-remba=rtcp-fb:107 transport-cca=rtcp-fb:107 ccm fira=rtcp-fb:107 nacka=rtcp-fb:107 nack plia=fmtp:107 level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=42001fa=rtpmap:108 rtx/90000a=fmtp:108 apt=107a=rtpmap:109 H264/90000a=rtcp-fb:109 goog-remba=rtcp-fb:109 transport-cca=rtcp-fb:109 ccm fira=rtcp-fb:109 nacka=rtcp-fb:109 nack plia=fmtp:109 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01fa=rtpmap:114 rtx/90000a=fmtp:114 apt=109a=rtpmap:115 H264/90000a=rtcp-fb:115 goog-remba=rtcp-fb:115 transport-cca=rtcp-fb:115 ccm fira=rtcp-fb:115 nacka=rtcp-fb:115 nack plia=fmtp:115 level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=42e01fa=rtpmap:116 rtx/90000a=fmtp:116 apt=115a=rtpmap:117 H264/90000a=rtcp-fb:117 goog-remba=rtcp-fb:117 transport-cca=rtcp-fb:117 ccm fira=rtcp-fb:117 nacka=rtcp-fb:117 nack plia=fmtp:117 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=4d001fa=rtpmap:118 rtx/90000a=fmtp:118 apt=117a=rtpmap:39 H264/90000a=rtcp-fb:39 goog-remba=rtcp-fb:39 transport-cca=rtcp-fb:39 ccm fira=rtcp-fb:39 nacka=rtcp-fb:39 nack plia=fmtp:39 level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=4d001fa=rtpmap:40 rtx/90000a=fmtp:40 apt=39a=rtpmap:45 AV1/90000a=rtcp-fb:45 goog-remba=rtcp-fb:45 transport-cca=rtcp-fb:45 ccm fira=rtcp-fb:45 nacka=rtcp-fb:45 nack plia=fmtp:45 level-idx=5;profile=0;tier=0a=rtpmap:46 rtx/90000a=fmtp:46 apt=45a=rtpmap:98 VP9/90000a=rtcp-fb:98 goog-remba=rtcp-fb:98 transport-cca=rtcp-fb:98 ccm fira=rtcp-fb:98 nacka=rtcp-fb:98 nack plia=fmtp:98 profile-id=0a=rtpmap:99 rtx/90000a=fmtp:99 apt=98a=rtpmap:100 VP9/90000a=rtcp-fb:100 goog-remba=rtcp-fb:100 transport-cca=rtcp-fb:100 ccm fira=rtcp-fb:100 nacka=rtcp-fb:100 nack plia=fmtp:100 profile-id=2a=rtpmap:101 rtx/90000a=fmtp:101 apt=100a=rtpmap:119 red/90000a=rtpmap:120 rtx/90000a=fmtp:120 apt=119a=rtpmap:121 ulpfec/90000a=ssrc-group:FID 87639558 954731173a=ssrc:87639558 cname:jXpjExZwm1R6wyP4a=ssrc:954731173 cname:jXpjExZwm1R6wyP4"
 *                           caller:
 *                             type: integer
 *                             example: 1753669819018
 *                           callee:
 *                             type: integer
 *                             example: 1753669815759
 *                       callerConnectedSince:
 *                         type: string
 *                         example: "28-07-2025 10:29:15"
 *                       callerIceCandidate:
 *                         type: object
 *                         nullable: true
 */

app.get("/callers", (req, res) => {
  const { callerStatus, callerType, limit, wait, callerId } = req.query;

  // console.log(
  //   styleText(
  //     "blue",
  //     `GET CALLERS: ===> ` +
  //       `callerStatus : ${callerStatus || "filter Not provided"}` +
  //       ` , callerType : ${callerType || "filter Not provided"}` +
  //       ` , limit : ${limit || "filter Not provided"}`,
  //     ` , wait : ${wait || "filter Not provided"}`
  //   )
  // );

  const matchClients = () => {
    let filtered = sdpClients;

    if (callerId) {
      filtered = filtered.filter((c) => {
        return String(c.callerId) === String(callerId);
      });
    }

    if (callerType) {
      filtered = filtered.filter((c) => c.callerType === callerType);
    }

    if (callerStatus) {
      filtered = filtered.filter((c) => c.callerStatus === callerStatus);
    }

    filtered.sort(
      (a, b) => new Date(a.callerConnectedOn) - new Date(b.callerConnectedOn)
    );

    const limited = limit ? filtered.slice(0, parseInt(limit)) : filtered;

    return limited;
  };

  const waitSeconds = Math.min(parseInt(wait) || 0, 60); // Cap wait to 60 seconds
  let secondsWaited = 0;

  const checkForClients = () => {
    const matchingClients = matchClients();

    if (matchingClients.length > 0 || secondsWaited >= waitSeconds) {
      return res.status(200).json({
        totalClients: matchingClients.length,
        filteredSdpClients: matchingClients,
      });
    }

    // Wait 1 second and retry
    setTimeout(() => {
      secondsWaited++;
      checkForClients();
    }, 1000);
  };

  // If wait is not defined or is zero, respond immediately
  if (!waitSeconds) {
    const matchingClients = matchClients();
    return res.status(200).json({
      totalClients: matchingClients.length,
      filteredSdpClients: matchingClients,
    });
  }

  // Otherwise, start polling
  checkForClients();
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// UPDATE CALLER STATUS , SDP OFFER OR SDP ANSWER
///////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * @swagger
 * /caller:
 *   put:
 *     summary: Update a caller's information
 *     tags: [Caller]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               callerId:
 *                 type: integer
 *                 example: 1753671282356
 *               callerType:
 *                 type: string
 *                 example: "kiosk"
 *               callerName:
 *                 type: string
 *                 example: "SunBear"
 *               callerStatus:
 *                 type: string
 *                 example: "BUSY"
 *               callerLastMessageOn:
 *                 type: integer
 *                 example: 1753671299782
 *               callerConnectedOn:
 *                 type: integer
 *                 example: 1753671282356
 *               callerConnectedWith:
 *                 type: string
 *                 nullable: true
 *                 example: null
 *               sdpOffer:
 *                 type: object
 *                 nullable: true
 *                 properties:
 *                   type:
 *                     type: string
 *                     example: "offer"
 *                   sdp:
 *                     type: string
 *                     example: "v=0\\r\\no=- 4045909618533547915 2 IN IP4 127.0.0.1\\r\\ns=-\\r\\nt=0 0\\r\\na= ..."
 *                   caller:
 *                     type: integer
 *                     example: 1753671282356
 *               sdpAnswer:
 *                 type: object
 *                 nullable: true
 *                 properties:
 *                   type:
 *                     type: string
 *                     example: "answer"
 *                   sdp:
 *                     type: string
 *                     example: "v=0\\r\\no=- 7947950788329746695 2 IN IP4 127.0.0.1\\r\\ns=-\\r\\nt=0 0\\r\\na=group:BUNDLE ..."
 *                   caller:
 *                     type: integer
 *                     example: 1753671282356
 *                   callee:
 *                     type: integer
 *                     example: 1753671266772
 *               callerConnectedSince:
 *                 type: string
 *                 example: "28-07-2025 10:53:42"
 *               callerIceCandidate:
 *                 type: object
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Caller session details after extension
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 callerId:
 *                   type: integer
 *                   example: 1753671282356
 *                 callerType:
 *                   type: string
 *                   example: "kiosk"
 *                 callerName:
 *                   type: string
 *                   example: "SunBear"
 *                 callerStatus:
 *                   type: string
 *                   example: "BUSY"
 *                 callerLastMessageOn:
 *                   type: integer
 *                   example: 1753671299782
 *                 callerConnectedOn:
 *                   type: integer
 *                   example: 1753671282356
 *                 callerConnectedWith:
 *                   type: string
 *                   nullable: true
 *                   example: null
 *                 sdpOffer:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     type:
 *                       type: string
 *                       example: "offer"
 *                     sdp:
 *                       type: string
 *                       example: "v=0\\r\\no=- 4045909618533547915 2 IN IP4 127.0.0.1\\r\\ns=-\\r\\nt=0 0\\r\\na= ..."
 *                     caller:
 *                       type: integer
 *                       example: 1753671282356
 *                 sdpAnswer:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     type:
 *                       type: string
 *                       example: "answer"
 *                     sdp:
 *                       type: string
 *                       example: "v=0\\r\\no=- 7947950788329746695 2 IN IP4 127.0.0.1\\r\\ns=-\\r\\nt=0 0\\r\\na=group:BUNDLE ..."
 *                     caller:
 *                       type: integer
 *                       example: 1753671282356
 *                     callee:
 *                       type: integer
 *                       example: 1753671266772
 *                 callerConnectedSince:
 *                   type: string
 *                   example: "28-07-2025 10:53:42"
 *                 callerIceCandidate:
 *                   type: object
 *                   nullable: true
 *       400:
 *         description: Missing parameters
 *       404:
 *         description: Caller not found
 */

app.put("/caller", (req, res) => {
  const {
    callerId,
    sdpOffer,
    sdpAnswer,
    callerStatus,
    callerIceCandidate,
    calleeIceCandidate,
  } = req.body;

  // if invalid parameters are provided , then return 400
  if (
    !callerId ||
    (!sdpOffer &&
      !sdpAnswer &&
      !callerStatus &&
      !callerIceCandidate &&
      !calleeIceCandidate)
  ) {
    console.log(
      styleText(
        "red",
        `UPDATE CALLER RESPONSE ===> Missing parameter callerId plus sdpOffer, sdpAnswer or status `
      )
    );
    return res.status(400).json({
      message: "Missing parameter callerId plus sdpOffer, sdpAnswer or status",
    });
  }

  //check if the callerId exists , else return 404
  const callerClient = sdpClients.find((c) => c.callerId == callerId);
  let callerType = callerClient.callerType;
  if (!callerClient) {
    console.log(
      styleText("red", `UPDATE CALLER RESPONSE ===> callerId not found `)
    );
    return res.status(404).json({ message: "callerId not found" });
  }

  //update caller Status
  if (callerStatus != null) {
    sdpClients.forEach((client) => {
      if (client.callerId === callerId) {
        client.callerStatus = callerStatus;
        console.log(
          styleText(
            "blue",
            `UPDATE CALLER RESPONSE ===> updated status for callerId ${callerId}:${callerType} to ${callerStatus}`
          )
        );
      }
    });
  }

  //update sdp offer
  if (sdpOffer != null) {
    sdpClients.forEach((client) => {
      if (client.callerId === callerId) {
        client.sdpOffer = sdpOffer;
        console.log(
          styleText(
            "blue",
            `UPDATE CALLER RESPONSE ===> updated sdp offer for callerId ${callerId}:${callerType}`
          )
        );
      }
    });
  }

  //update sdpAnswer
  if (sdpAnswer != null) {
    sdpClients.forEach((client) => {
      if (client.callerId === callerId) {
        client.sdpAnswer = sdpAnswer;
        console.log(
          styleText(
            "blue",
            `UPDATE CALLER RESPONSE ===> updated sdp answer for callerId ${callerId}:${callerType}`
          )
        );
      }
    });
  }

  //update Caller iceCandidate
  if (callerIceCandidate != null) {
    sdpClients.forEach((client) => {
      if (client.callerId === callerId) {
        client.callerIceCandidate = callerIceCandidate;
        console.log(
          styleText(
            "blue",
            `UPDATE CALLER RESPONSE ===> updated Caller ICE candidate for callerId ${callerId}:${callerType}`
          )
        );
      }
    });
  }

  //update callee iceCandidate
  if (calleeIceCandidate != null) {
    sdpClients.forEach((client) => {
      if (client.callerId === callerId) {
        client.calleeIceCandidate = calleeIceCandidate;
        console.log(
          styleText(
            "blue",
            `UPDATE CALLER RESPONSE ===> updated Callee ICE candidate for callerId ${callerId}:${callerType}`
          )
        );
      }
    });
  }

  return res.status(200).json(callerClient);
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// LOAD TLS CERTIFICATES FOR HTTPS
///////////////////////////////////////////////////////////////////////////////////////////////////
const key = fs.readFileSync(__dirname + "/cert/www.isapsolution.com.key");
const cert = fs.readFileSync(__dirname + "/cert/www.isapsolution.com.crt");
const server = https.createServer({ key, cert }, app);

///////////////////////////////////////////////////////////////////////////////////////////////////
// ADD SWAGGER DEFINITION
///////////////////////////////////////////////////////////////////////////////////////////////////
// Swagger definition
const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "Growltalk API",
    version: "1.0.0",
    description: "A sample API for a webRTC signaling server",
  },
  servers: [
    {
      url: `https://localhost:${port}`,
    },
  ],
};

const options = {
  swaggerDefinition,
  apis: ["./app.js"],
};

const swaggerSpec = swaggerJsdoc(options);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
///////////////////////////////////////////////////////////////////////////////////////////////////
// START HTTPS SERVER
///////////////////////////////////////////////////////////////////////////////////////////////////

server.listen(port, () => {
  console.log(
    styleText("green", ` * * * HTTPS server started on port ${port} * * *`)
  );
});
