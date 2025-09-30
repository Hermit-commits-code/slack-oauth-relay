export default async function handler(req, res) {
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
  const client_id = "9599374319411.9591125131255";
  const client_secret = "fadb8e2bd5f8a3c357822c01e77d47d0";
  const redirect_uri =
    "https://slack-oauth-relay-production.up.railway.app/oauth/callback";
  const code = req.body.code;
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
