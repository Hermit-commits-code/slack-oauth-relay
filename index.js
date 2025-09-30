require("dotenv").config();
console.log("Relay server starting up");
const express = require("express");
const cors = require("cors");
const app = express();
// Explicit CORS headers for all responses (for Chrome extension support)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*"); // For production, use your extension ID for more security
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

app.use(cors());
app.use(express.json());

// OAuth callback for debugging
app.get("/oauth/callback", (req, res) => {
  const code = req.query.code;
  if (code) {
    res.send(`<h2>Slack OAuth Code:</h2><pre>${code}</pre>`);
  } else {
    res.send("<h2>No OAuth code found in URL.</h2>");
  }
});

// In-memory session store: sessionToken -> accessToken
const crypto = require("crypto");
const sessionStore = {};

// Exchange OAuth code for access token and issue session token
app.post("/api/exchange-token", async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "Missing code" });
  try {
    // Exchange code for access token with Slack
    const slackRes = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.SLACK_CLIENT_ID,
        client_secret: process.env.SLACK_CLIENT_SECRET,
        redirect_uri: process.env.SLACK_REDIRECT_URI,
      }),
    });
    const data = await slackRes.json();
    if (data.access_token) {
      const sessionToken = crypto.randomBytes(32).toString("hex");
      sessionStore[sessionToken] = data.access_token;
      return res.json({ session_token: sessionToken });
    } else {
      return res
        .status(400)
        .json({ error: data.error || "Could not retrieve access token" });
    }
  } catch (err) {
    console.error("Exchange error:", err);
    return res.status(500).json({ error: "Exchange error" });
  }
});

// Relay endpoint for posting to Slack using session token
app.post("/api/slack", async (req, res) => {
  console.log("Received POST /api/slack");
  console.log("Request body:", req.body);
  const { sessionToken, channel, text } = req.body;
  if (!sessionToken || !channel || !text) {
    console.error("Missing required fields", { sessionToken, channel, text });
    return res
      .status(400)
      .json({ ok: false, error: "Missing required fields" });
  }
  const accessToken = sessionStore[sessionToken];
  if (!accessToken) {
    console.error("Invalid session token");
    return res.status(401).json({ ok: false, error: "invalid_auth" });
  }
  try {
    const slackRes = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ channel, text }),
    });
    const data = await slackRes.json();
    console.log("Slack API response:", data);
    if (data.error === "invalid_auth" || data.error === "token_revoked") {
      console.error("Slack auth error:", data.error);
      return res.status(401).json({ ok: false, error: data.error });
    }
    return res.json(data);
  } catch (err) {
    console.error("Relay error:", err);
    return res.status(500).json({ ok: false, error: "Relay error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Relay server running on port ${PORT}`);
});
