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
// GET ALL CALLERS (KIOSK AND OPERATOR) ... WITH OPTION TO FILTER BY CALLER STATUS AND CALLER TYPE
///////////////////////////////////////////////////////////////////////////////////////////////////
app.get("/callers", (req, res) => {
  const { callerStatus, callerType, limit, wait } = req.query;

  console.log(
    styleText(
      "blue",
      `GET ALL CALLERS: ===> ` +
        `callerStatus : ${callerStatus || "filter Not provided"}` +
        ` , callerType : ${callerType || "filter Not provided"}` +
        ` , limit : ${limit || "filter Not provided"}`
    )
  );

  const matchClients = () => {
    let filtered = sdpClients;

    if (callerType) {
      filtered = filtered.filter((c) => c.callerType === callerType);
    }

    if (callerStatus) {
      filtered = filtered.filter((c) => c.callerStatus === callerStatus);
    }

    // Sort by `callerConnectedOn` ascending (oldest first)
    filtered.sort(
      (a, b) => new Date(a.callerConnectedOn) - new Date(b.callerConnectedOn)
    );

    // Apply limit if provided
    const limited = limit ? filtered.slice(0, parseInt(limit)) : filtered;

    return limited;
  };

  const matchingClients = matchClients();
  return res.status(200).json({
    totalClients: matchingClients.length,
    filteredSdpClients: matchingClients,
  });
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
      callerConnectedOn: currentMilliseconds,
      sdpOffer: null,
      sdpAnswer: null,
      callerConnectedSince: getCurrentDateTime(),
    });

    console.log(
      styleText(
        "cyan",
        `SIGN IN RESPONSE ===> callerId: ${currentMilliseconds} was assigned to ${callerType}:${callerName}`
      )
    );

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
// UPDATE CALLER STATUS , SDP OFFER OR SDP ANSWER
///////////////////////////////////////////////////////////////////////////////////////////////////
app.put("/caller", (req, res) => {
  const { callerId, sdpOffer, sdpAnswer, status } = req.body;

  if (!callerId || (!sdpOffer && !sdpAnswer && !status)) {
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

  const callerClient = sdpClients.find((c) => c.callerId == callerId);

  if (!callerClient) {
    console.log(
      styleText("red", `UPDATE CALLER RESPONSE ===> callerId not found `)
    );
    return res.status(404).json({ message: "callerId not found" });
  }
  // caller id is found
  else {
    // update the sdp offer for the kiosk
    if (sdpOffer && callerClient.callerType == KIOSK_USER) {
      callerClient.sdpOffer = sdpOffer;
      sdpClients.forEach((client) => {
        if (client.callerId === callerClient.callerId) {
          client.sdpOffer = callerClient.sdpOffer;
          console.log(
            styleText(
              "blue",
              `UPDATE CALLER RESPONSE ===> updated sdpOffer for callerId ${callerClient.callerId}`
            )
          );
        }
      });
    }
    // update the sdp answer for the operator
    else if (sdpAnswer && callerClient.callerType == OPERATOR_USER) {
      callerClient.sdpAnswer = sdpAnswer;
      sdpClients.forEach((client) => {
        if (client.callerId === callerClient.callerId) {
          client.sdpAnswer = callerClient.sdpAnswer;
          console.log(
            styleText(
              "blue",
              `UPDATE CALLER RESPONSE ===> updated sdpAnswer for callerId ${callerClient.callerId}`
            )
          );
        }
      });
    }
    //update kiosk or operator status
    else {
      callerClient.status = status;
      sdpClients.forEach((client) => {
        if (client.callerId === callerClient.callerId) {
          client.status = callerClient.status;
          console.log(
            styleText(
              "blue",
              `UPDATE CALLER RESPONSE ===> updated status for callerId ${client.callerId}:${client.callerType} to ${callerClient.status}`
            )
          );
        }
      });
    }

    return res.status(200).json(callerClient);
  }
});

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
