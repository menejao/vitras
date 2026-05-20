export default {
  async fetch(request, env) {
    let response = await env.ASSETS.fetch(request);
    // SPA fallback: serve index.html for client-side routes (e.g. /activate)
    if (response.status === 404) {
      const indexUrl = new URL(request.url);
      indexUrl.pathname = "/index.html";
      response = await env.ASSETS.fetch(new Request(indexUrl.toString()));
    }
    return response;
  }
};
