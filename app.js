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

///////////////////////////////////////////////////////////////////////////////////////////////////
// GLOBAL VARS
///////////////////////////////////////////////////////////////////////////////////////////////////

dotenv.config();
const KIOSK_USER = "kiosk";
const OPERATOR_USER = "kiosk";

let sdpClients = [];
let operatorSSEStreams = []; // List of SSE response streams

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
// AUTO DELETE STALE SESSIONS
///////////////////////////////////////////////////////////////////////////////////////////////////
setInterval(() => {
  const now = Date.now();
  const before = sdpClients.length;
  // console.log("executing cleanup script");

  sdpClients = sdpClients.filter(
    (client) => now - client.callerLastMessageOn <= DELETE_TIMER / 2 // delete stale connections
  );

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
// GET ALL CALLERS (KIOSK AND OPERATOR) ... WITH OPTION TO FILTER BY CALLER STATUS AND CALLER TYPE
///////////////////////////////////////////////////////////////////////////////////////////////////
app.get("/callers", (req, res) => {
  const { callerStatus, callerType } = req.query;

  console.log(
    styleText(
      "blue",
      `GET ALL CALLERS: ===> ` +
        `callerStatus : ${callerStatus || "filter Not provided"}` +
        ` , callerType : ${callerType || "filter Not provided"}`
    )
  );

  let filteredSdpClients = sdpClients;
  if (callerStatus || callerType) {
    if (callerType) {
      filteredSdpClients = filteredSdpClients.filter(
        (sdpClient) => sdpClient.callerType === callerType
      );

      console.log(
        styleText(
          "cyan",
          `GET ALL CALLERS: ===> with callerType ${callerType} , total: ${filteredSdpClients.length}`
        )
      );
    }

    if (callerStatus) {
      filteredSdpClients = filteredSdpClients.filter(
        (sdpClient) => sdpClient.callerStatus === callerStatus
      );

      console.log(
        styleText(
          "cyan",
          `GET ALL CALLERS: ===> with callerStatus ${callerStatus} , total: ${filteredSdpClients.length}`
        )
      );
    }

    res
      .status(200)
      .json({ totalClients: filteredSdpClients.length, filteredSdpClients });
  } else {
    console.log(
      styleText("cyan", `GET ALL CALLERS: ===> ${filteredSdpClients.length}`)
    );

    res.status(200).json({
      totalClients: filteredSdpClients.length,
      filteredSdpClients,
    });
  }
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// SIGN IN CALLERS (KIOSK AND OPERATOR)
///////////////////////////////////////////////////////////////////////////////////////////////////
app.get("/sign-in", (req, res) => {
  const { callerType, callerName } = req.query;

  console.log(
    styleText(
      "blue",
      `SIGN IN REQUEST: ===> ` +
        `callerType: ${callerType || "Not provided"} , ` +
        `callerName: ${callerName || "Not provided"}`
    )
  );

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
      callerConnectedOn: getCurrentDateTime(),
    });

    console.log(
      styleText(
        "cyan",
        `SIGN IN RESPONSE ===> callerId: ${currentMilliseconds} was assigned to ${callerType}:${callerName}`
      )
    );

    if (callerType === KIOSK_USER) {
      notifyOperatorsAboutOldestAvailableKiosk();
    }

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
app.get("/keep-session", (req, res) => {
  const { callerId } = req.query;

  console.log(
    styleText(
      "blue",
      `KEEP SESSION REQUEST: ===> ` + `callerId: ${callerId || "Not provided"}`
    )
  );

  const foundIndex = sdpClients.findIndex((sdpClient) => {
    return String(sdpClient.callerId) === String(callerId);
  });

  if (callerId && foundIndex !== -1) {
    const timer = Date.now() + DELETE_TIMER;
    sdpClients[foundIndex].callerLastMessageOn = timer;
    console.log(
      styleText(
        "cyan",
        `KEEP SESSION RESPONSE ===> callerId: ${callerId}  session was extended to ${timer}`
      )
    );

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
// update callers status
///////////////////////////////////////////////////////////////////////////////////////////////////
app.put("/callers", (req, res) => {
  const { caller, callee, actionType } = req.body;

  if (!caller || !callee || !actionType) {
    return res.status(400).json({ message: "Missing parameters" });
  }

  const callerClient = sdpClients.find((c) => c.callerId == caller);
  const calleeClient = sdpClients.find((c) => c.callerId == callee);

  if (!callerClient || !calleeClient) {
    return res.status(404).json({ message: "Caller or callee not found" });
  }

  if (actionType === "answer") {
    callerClient.callerStatus = "BUSY";
    calleeClient.callerStatus = "BUSY";
  } else {
    callerClient.callerStatus = "AVAILABLE";
    calleeClient.callerStatus = "AVAILABLE";
  }

  console.log(
    styleText(
      "blue",
      `CALL STATUS UPDATE: ${caller} and ${callee} => ${actionType}`
    )
  );

  // Always notify operators with the new oldest kiosk
  notifyOperatorsAboutOldestAvailableKiosk();

  res.status(200).json({ success: true });
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// get connection events
///////////////////////////////////////////////////////////////////////////////////////////////////
app.get("/events", (req, res) => {
  req.socket.setTimeout(0);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Add operator SSE stream
  operatorSSEStreams.push(res);

  req.on("close", () => {
    operatorSSEStreams = operatorSSEStreams.filter((stream) => stream !== res);
  });
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// Notify all available operators about the oldest kiosk
///////////////////////////////////////////////////////////////////////////////////////////////////
function notifyOperatorsAboutOldestAvailableKiosk() {
  const oldestKiosk = sdpClients
    .filter(
      (c) => c.callerType === KIOSK_USER && c.callerStatus === "AVAILABLE"
    )
    .sort(
      (a, b) => new Date(a.callerConnectedOn) - new Date(b.callerConnectedOn)
    )[0];

  if (!oldestKiosk) return;

  const data = {
    type: "incoming-kiosk",
    callerId: oldestKiosk.callerId,
    callerName: oldestKiosk.callerName,
  };

  operatorSSEStreams.forEach((stream) => {
    stream.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}
///////////////////////////////////////////////////////////////////////////////////////////////////
// LOAD TLS CERTIFICATES FOR HTTPS
///////////////////////////////////////////////////////////////////////////////////////////////////
const key = fs.readFileSync(__dirname + "/cert/www.isapsolution.com.key");
const cert = fs.readFileSync(__dirname + "/cert/www.isapsolution.com.crt");
const server = https.createServer({ key, cert }, app);

///////////////////////////////////////////////////////////////////////////////////////////////////
// START HTTPS SERVER
///////////////////////////////////////////////////////////////////////////////////////////////////

server.listen(port, () => {
  console.log(
    styleText("green", ` * * * HTTPS server started on port ${port} * * *`)
  );
});
