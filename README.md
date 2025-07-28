# GrowlTalk

GrowlTalk is a WebRTC video concierge demo application that enables kiosk and operator clients to connect  video calls. 
It features a Node.js/Express signaling server, HTTPS support, and a browser-based frontend for both kiosk and operator roles.

## Features

- WebRTC signaling server using Express and HTTPS
- Kiosk and Operator login flows
- Secure video/audio communication
- REST API for session management
- Swagger API documentation (`/api-docs`)
- Automatic session cleanup for inactive clients

## Project Structure

```
.
├── app.js
├── package.json
├── .env
├── cert/
├── controllers/
├── public/
│   ├── kiosk.html
│   ├── operator.html
│   ├── welcome.html
│   ├── assets/
│   ├── scripts/
│   └── styles/
└── ReadMeDocs/
```

## Prerequisites

- Node.js (v14+ recommended)
- npm
- HTTPS certificates (`cert/www.isapsolution.com.key` and `.crt`)

## Setup

1. **Install dependencies:**
   ```sh
   npm install
   ```

2. **Configure environment variables:**
   Edit `.env` as needed:
   ```
   SERVER_PORT=9999
   DELETE_TIMER=60
   ```

3. **Add SSL certificates:**
   Place your `.key` and `.crt` files in the `cert/` directory.

4. **Start the server:**
   ```sh
   npm start
   ```

5. **Access the app:**
   - Open [https://localhost:9999](https://localhost:9999) in your browser.
   - Swagger API docs: [https://localhost:9999/api-docs](https://localhost:9999/api-docs)

## API Endpoints

- `GET /sign-in` - Sign in as kiosk or operator
- `GET /keep-session` - Extend a session
- `GET /sign-out` - Sign out a client
- `GET /callers` - List connected clients
- `PUT /caller` - Update client status/SDP
- `GET /env` - Get environment config

See [app.js](app.js) for full API details.

## Frontend

- `public/welcome.html` - Main entry point
- `public/kiosk.html` - Kiosk client UI
- `public/operator.html` - Operator client UI

## Development Notes

- Sessions are auto-removed after inactivity (see `DELETE_TIMER`).
- All static files are served from the `public/` directory.
- For local development, you may need to accept self-signed certificates in your browser.
- This application only works if the two clients are part of the same network

---


