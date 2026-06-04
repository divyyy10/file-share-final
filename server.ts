import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import url from "url";
import { WebSocket, WebSocketServer } from "ws";
import { createServer as createViteServer } from "vite";

interface CustomWebSocket extends WebSocket {
  isAlive?: boolean;
}

interface ClientInfo {
  ws: CustomWebSocket;
  deviceId: string;
  deviceName: string;
  deviceType: string;
  roomId: string;
  joinedAt: number;
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;

  // In-memory room storage roomID -> ClientInfo[]
  const rooms = new Map<string, ClientInfo[]>();

  // Attach WebSocket server
  const wss = new WebSocketServer({ noServer: true });

  // Webhook or health endpoint
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      activeRooms: rooms.size,
      totalDevices: Array.from(rooms.values()).reduce((acc, curs) => acc + curs.length, 0),
    });
  });

  // Config endpoint to expose APP_URL safely for QR sharing
  app.get("/api/config", (req, res) => {
    res.json({
      appUrl: process.env.APP_URL || "",
    });
  });

  // Upgrade HTTP to WS
  server.on("upgrade", (request, socket, head) => {
    const parsedUrl = url.parse(request.url || "");
    const { pathname } = parsedUrl;

    if (pathname === "/ws") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      // In development, let Vite handle its websocket/HMR requests
      if (process.env.NODE_ENV !== "production") {
        // Do not destroy Vite ws upgrades
      } else {
        socket.destroy();
      }
    }
  });

  // Broadcast helper
  const broadcastToRoom = (roomId: string, message: any, excludeWs?: WebSocket) => {
    const clients = rooms.get(roomId);
    if (!clients) return;

    const payload = JSON.stringify(message);
    clients.forEach((client) => {
      if (client.ws !== excludeWs && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    });
  };

  // Send list of devices in the room to everyone in that room
  const sendRoomStatus = (roomId: string) => {
    const clients = rooms.get(roomId) || [];
    const devices = clients.map((c) => ({
      id: c.deviceId,
      name: c.deviceName,
      type: c.deviceType,
      joinedAt: c.joinedAt,
    }));

    broadcastToRoom(roomId, {
      type: "room-status",
      roomId,
      devices,
    });
  };

  // Setup WebSocket connection
  wss.on("connection", (ws: CustomWebSocket) => {
    ws.isAlive = true;
    let clientSession: ClientInfo | null = null;

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", (rawMessage) => {
      try {
        const messageString = rawMessage.toString();
        const message = JSON.parse(messageString);

        switch (message.type) {
          case "join": {
            const { roomId, deviceId, deviceName, deviceType } = message;
            if (!roomId || !deviceId) return;

            // Remove if device already exists in this room (prevent duplicates on reconnect)
            let existingClients = rooms.get(roomId) || [];
            existingClients = existingClients.filter((c) => c.deviceId !== deviceId);

            clientSession = {
              ws,
              deviceId,
              deviceName,
              deviceType,
              roomId,
              joinedAt: Date.now(),
            };

            existingClients.push(clientSession);
            rooms.set(roomId, existingClients);

            console.log(`Device [${deviceName}] joined room [${roomId}]`);

            // Report success and update room
            ws.send(JSON.stringify({ type: "join-success", roomId, deviceId }));
            sendRoomStatus(roomId);
            break;
          }

          // Direct data / metadata transfer (Piped transfer)
          case "file-metadata":
          case "file-chunk":
          case "file-chunk-ack":
          case "transfer-cancel":
          case "transfer-complete":
          case "transfer-failed":
          case "peer-cursor": {
            if (clientSession && clientSession.roomId) {
              const { targetId } = message;
              if (targetId) {
                // Route directly to the targeted client in the matching room
                const clients = rooms.get(clientSession.roomId) || [];
                const targetClient = clients.find((c) => c.deviceId === targetId);
                if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
                  targetClient.ws.send(JSON.stringify(message));
                }
              } else {
                // Pipe straight to other peer(s) in the identical room
                broadcastToRoom(clientSession.roomId, message, ws);
              }
            }
            break;
          }

          case "ping": {
            ws.send(JSON.stringify({ type: "pong" }));
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error("Error parsing WS message:", err);
      }
    });

    ws.on("close", () => {
      if (clientSession) {
        const { roomId, deviceId, deviceName } = clientSession;
        let clients = rooms.get(roomId) || [];
        clients = clients.filter((c) => c.deviceId !== deviceId);

        if (clients.length === 0) {
          rooms.delete(roomId);
          console.log(`Room [${roomId}] became empty, deleted.`);
        } else {
          rooms.set(roomId, clients);
          console.log(`Device [${deviceName}] left room [${roomId}]`);
          sendRoomStatus(roomId);
        }
      }
    });

    ws.on("error", (err) => {
      console.error("WebSocket client connection error:", err);
    });
  });

  // Keep connection alive with heartbeat pinging
  const interval = setInterval(() => {
    wss.clients.forEach((ws: CustomWebSocket) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(interval);
  });

  // Render frontend inside express
  const distPath = path.join(process.cwd(), "dist");
  const hasBuild = fs.existsSync(path.join(distPath, "index.html"));

  const isDev = process.env.VITE_DEV === "true" || process.env.NODE_ENV !== "production" || !hasBuild;

  if (isDev) {
    // Vite Dev Server middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static assets
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`===============================================`);
    console.log(`🚀 Server up and running at http://0.0.0.0:${PORT}`);
    console.log(`🔧 Mode: ${process.env.NODE_ENV || "development"}`);
    console.log(`===============================================`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
});
