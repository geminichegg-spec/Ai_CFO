// Atlas voice relay: a Cloudflare Worker that forwards text-to-speech requests to AbhiBots.
// Your AbhiBots key is stored as a Worker secret named ABHI_KEY, so it never appears in the web page.
// "null" is the origin Chrome sends when index.html is opened as a local file.
const ALLOWED_ORIGINS = ["https://geminichegg-spec.github.io", "null"];
const UPSTREAMS = ["https://app.abhibots.com/api/tts/generate", "https://abhibots.com/api/tts/generate"];

function cors(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return { "Access-Control-Allow-Origin": allow, "Access-Control-Allow-Methods": "POST, OPTIONS",
           "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400", "Vary": "Origin" };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    if (request.method !== "POST") return new Response("Atlas voice relay is running.", { headers: cors(origin) });
    if (!ALLOWED_ORIGINS.includes(origin)) return new Response("Forbidden origin", { status: 403, headers: cors(origin) });

    let body;
    try { body = await request.json(); } catch { return new Response("Bad JSON", { status: 400, headers: cors(origin) }); }
    const payload = JSON.stringify({ text: String(body.text || "").slice(0, 1500), voiceId: body.voiceId, provider: body.provider,
                                     ...(body.voice_settings ? { voice_settings: body.voice_settings } : {}) });
    let last;
    for (const url of UPSTREAMS) {
      try {
        const r = await fetch(url, { method: "POST", headers: { "X-API-Key": env.ABHI_KEY, "Content-Type": "application/json" }, body: payload });
        if (r.status === 404) { last = r; continue; }
        const headers = new Headers(cors(origin));
        headers.set("Content-Type", r.headers.get("Content-Type") || "application/octet-stream");
        return new Response(r.body, { status: r.status, headers });
      } catch (e) { last = e; }
    }
    return new Response("AbhiBots unreachable: " + String(last && (last.status || last.message) || ""), { status: 502, headers: cors(origin) });
  },
};
