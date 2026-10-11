import {api} from './api.js';

// Only /api/* runs this Worker. Static Assets serves the public directory directly.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    // Reject alternate hostnames for login/cookies; never trust forwarded host headers.
    if (!env.PUBLIC_ORIGIN || url.origin !== env.PUBLIC_ORIGIN) {
      return Response.json({error:'请使用网站的正式地址访问。'}, {status:421, headers:{'cache-control':'no-store'}});
    }
    if (env.MAINTENANCE === 'true') {
      return Response.json({error:'网站正在迁移，请稍后重试。'}, {status:503, headers:{'cache-control':'no-store','retry-after':'60'}});
    }
    const headers = new Headers(request.headers);
    for (const name of headers.keys()) {
      if (name.startsWith('oai-authenticated-')) headers.delete(name);
    }
    const response = await api(new Request(request, {headers}), env);
    response.headers.set('x-content-type-options','nosniff');
    response.headers.set('referrer-policy','no-referrer');
    response.headers.set('cache-control','no-store');
    return response;
  }
};
