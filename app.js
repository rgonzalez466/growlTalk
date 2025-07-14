"use strict";

const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const fetch = require("node-fetch");
const AbortController = require("abort-controller");
const https = require("https");
const path = require("path");
require("dotenv").config();

const port = process.env.SERVER_PORT || 9999;

const app = express();

// ⬇️ Serve static files WITHOUT auto-serving index.html
app.use(
  express.static(path.join(__dirname, "public"), {
    index: false, // Prevent index.html from automatically being served
  })
);

app.get("/favicon.ico", (req, res) => res.status(204));

// ⬇️ Serve welcome.html FIRST on root path "/"
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "welcome.html"));
});

// ⬇️ HTTPS Certificate and Server Start
const key = fs.readFileSync(__dirname + "/cert/www.isapsolution.com.key");
const cert = fs.readFileSync(__dirname + "/cert/www.isapsolution.com.crt");

const server = https.createServer({ key, cert }, app);

server.listen(port, () => {
  console.log(`HTTPS server started on port ${port}`);
});
