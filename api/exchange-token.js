export default async function handler(req, res) {
  console.log("exchange-token endpoint hit");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const fetch = (...args) =>
    import("node-fetch").then(({ default: fetch }) => fetch(...args));
  const client_id = process.env.SLACK_CLIENT_ID;
  const client_secret = process.env.SLACK_CLIENT_SECRET;
  const redirect_uri = process.env.SLACK_REDIRECT_URI;
  const code = req.body.code;
  console.log("client_id:", client_id);
  console.log("client_secret:", client_secret ? "[set]" : "[missing]");
  console.log("redirect_uri:", redirect_uri);
  console.log("code:", code);
  if (!code) {
    res.status(400).json({ error: "Missing code" });
    return;
  }
  try {
    const slackRes = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id,
        client_secret,
        code,
        redirect_uri,
      }),
    });
    const data = await slackRes.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Exchange error" });
  }
}
