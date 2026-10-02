require("dotenv").config();

const path = require("path");
const http = require("http");
const crypto = require("crypto");
const express = require("express");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { WebSocketServer } = require("ws");

const { query } = require("./config/db");
const { initializeDatabase } = require("./config/init-db");
const { seedDemoData, DEMO } = require("./config/seed-demo");
const authRoutes = require("./routes/auth");
const projectRoutes = require("./routes/projects");
const proposalRoutes = require("./routes/proposals");
const userRoutes = require("./routes/users");
const messageRoutes = require("./routes/messages");
const { notFound, errorHandler } = require("./middleware/error");

const isProduction = process.env.NODE_ENV === "production";
if (!process.env.JWT_SECRET) {
  if (isProduction) {
    console.error("JWT_SECRET must be set in production.");
    process.exit(1);
  }
  process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
  console.warn("[DEV] JWT_SECRET was not found. A temporary secret was generated for this session.");
}
if (process.env.JWT_SECRET.length < 32) {
  console.error("JWT_SECRET must contain at least 32 characters.");
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
const port = Number(process.env.PORT || 3000);

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "50kb" }));
app.use(cookieParser());

// The app is normally same-origin when opened from Express.
// CORS is also enabled for VS Code Live Server (5500/5501/etc.)
// so the project can still be tested from a static frontend.
const allowedOrigins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
  "http://localhost:5501",
  "http://127.0.0.1:5501"
]);
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
      return callback(null, true);
    }
    // Public Cloudflare/tunnel access is same-origin and does not need CORS.
    // Reject unknown cross-origin browser requests.
    return callback(null, false);
  },
  credentials: true
}));

app.get("/api/health", async (req, res, next) => {
  try {
    const result = await query("SELECT 1 AS ok");
    res.json({
      status: "ok",
      database: result.rows?.[0]?.ok === 1 || result.rows?.[0]?.ok === "1" ? "connected" : "unknown",
      environment: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/proposals", proposalRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);

app.get("/client", (req, res) => res.sendFile(path.join(__dirname, "public", "client-dashboard.html")));
app.get("/freelancer", (req, res) => res.sendFile(path.join(__dirname, "public", "freelancer-dashboard.html")));

app.use(express.static(path.join(__dirname, "public"), {
  extensions: ["html"]
}));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

const wss = new WebSocketServer({ noServer: true });
const online = new Map();

function authenticateWebSocket(request) {
  const cookie = request.headers.cookie || "";
  const match = cookie.match(/(?:^|;\s*)token=([^;]+)/);
  if (!match) throw new Error("Missing authentication cookie");
  return jwt.verify(decodeURIComponent(match[1]), process.env.JWT_SECRET);
}

server.on("upgrade", (request, socket, head) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const match = url.pathname.match(/^\/ws\/chat\/(\d+)$/);
    if (!match) return socket.destroy();

    const payload = authenticateWebSocket(request);
    const requestedId = Number(match[1]);
    if (payload.id !== requestedId) return socket.destroy();

    wss.handleUpgrade(request, socket, head, ws => {
      ws.user = payload;
      wss.emit("connection", ws, request);
    });
  } catch {
    socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
    socket.destroy();
  }
});

wss.on("connection", ws => {
  const userId = Number(ws.user.id);
  const previous = online.get(userId);
  if (previous && previous !== ws && previous.readyState === 1) previous.close(1000, "Replaced by a new connection");
  online.set(userId, ws);

  ws.send(JSON.stringify({ type: "connected", user_id: userId }));

  ws.on("message", async raw => {
    try {
      const data = JSON.parse(raw.toString());
      const receiverId = Number(data.receiver_id);
      const content = String(data.content || "").replace(/[<>]/g, "").trim().slice(0, 4000);

      if (!Number.isInteger(receiverId) || receiverId <= 0 || receiverId === userId || !content) {
        return ws.send(JSON.stringify({ type: "error", error: "Invalid message payload" }));
      }

      const receiver = await query("SELECT id FROM users WHERE id = ?", [receiverId]);
      if (!receiver.rows.length) {
        return ws.send(JSON.stringify({ type: "error", error: "Recipient not found" }));
      }

      const result = await query(
        "INSERT INTO messages (sender_id,receiver_id,content) VALUES (?,?,?)",
        [userId, receiverId, content]
      );
      const messageId = result.lastID || result.rows?.[0]?.id;
      const createdAt = new Date().toISOString();
      const message = {
        id: messageId,
        sender_id: userId,
        receiver_id: receiverId,
        content,
        created_at: createdAt
      };

      ws.send(JSON.stringify({ type: "delivered", message }));

      const receiverSocket = online.get(receiverId);
      if (receiverSocket?.readyState === 1) {
        receiverSocket.send(JSON.stringify({ type: "message", message }));
      }
    } catch (err) {
      console.error("WebSocket message error:", err);
      if (ws.readyState === 1) ws.send(JSON.stringify({ type: "error", error: "Message could not be delivered" }));
    }
  });

  ws.on("close", () => {
    if (online.get(userId) === ws) online.delete(userId);
  });
});

app.use(notFound);
app.use(errorHandler);

async function start() {
  try {
    await initializeDatabase();

    if (!isProduction && String(process.env.SEED_DEMO || "true").toLowerCase() === "true") {
      await seedDemoData();
      console.log("Demo accounts ready:");
      console.log(`  Client     : ${DEMO.client.email} / ${DEMO.client.password}`);
      console.log(`  Freelancer : ${DEMO.freelancer.email} / ${DEMO.freelancer.password}`);
    }

    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, resolve);
    });

    console.log("");
    console.log("============================================");
    console.log(" Workly Freelancer Marketplace is running");
    console.log(` Local:  http://localhost:${port}`);
    console.log(` Health: http://localhost:${port}/api/health`);
    console.log(" WebSocket: /ws/chat/{user_id}");
    console.log("============================================");
    console.log("");
  } catch (err) {
    console.error("Startup failed:", err);
    process.exit(1);
  }
}

start();
