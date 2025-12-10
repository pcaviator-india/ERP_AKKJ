const { WebSocketServer } = require("ws");

// channel -> Set<WebSocket>
const channels = new Map();
const lastPayload = new Map();
let wss = null;

function addClient(channel, ws) {
  if (!channels.has(channel)) {
    channels.set(channel, new Set());
  }
  channels.get(channel).add(ws);
}

function removeClient(channel, ws) {
  const set = channels.get(channel);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) {
    channels.delete(channel);
  }
}

function broadcastToScreen(channel = "default", payload = {}) {
  lastPayload.set(channel, payload);
  const set = channels.get(channel);
  if (!set || set.size === 0) return;
  const message = JSON.stringify({ type: "update", payload });
  for (const ws of set) {
    if (ws.readyState === ws.OPEN) {
      ws.send(message);
    }
  }
}

function initCustomerScreenHub(server) {
  if (wss) return wss;
  wss = new WebSocketServer({ server, path: "/customer-screen" });
  wss.on("connection", (ws, req) => {
    let channel = "default";
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      channel = url.searchParams.get("channel") || channel;
    } catch (err) {
      console.warn("Failed to parse websocket URL", err);
    }
    addClient(channel, ws);
    ws.send(JSON.stringify({ type: "status", message: "connected", channel }));
    const cached = lastPayload.get(channel);
    if (cached) {
      ws.send(JSON.stringify({ type: "update", payload: cached }));
    }
    ws.on("close", () => removeClient(channel, ws));
    ws.on("error", () => removeClient(channel, ws));
  });
  return wss;
}

module.exports = {
  initCustomerScreenHub,
  broadcastToScreen,
};
