async function forward(request, { params }) {
    const path = (await params).path.join("/");
    const cookie = request.headers.get("cookie") || "";
    const search = new URL(request.url).search; // e.g. "?deviceId=abc123" — was previously dropped entirely
  
    const init = {
      method: request.method,
      headers: { cookie, "Content-Type": "application/json" },
    };
  
    if (request.method === "POST" || request.method === "PUT" || request.method === "PATCH") {
      init.body = await request.text();
    }
  
    // Points at the deployed Express backend in production; falls back to
    // localhost for local dev. This runs server-side (inside the Next.js
    // Route Handler), never in the browser, so this is a plain server-to-
    // server fetch — no CORS involved regardless of the deployed domains.
    const apiBase = process.env.EXPRESS_API_URL || "http://localhost:8000";
    const res = await fetch(`${apiBase}/api/${path}${search}`, init);
    const data = await res.json();
    return Response.json(data, { status: res.status });
  }
  
  export { forward as GET, forward as POST, forward as PUT, forward as PATCH, forward as DELETE };
