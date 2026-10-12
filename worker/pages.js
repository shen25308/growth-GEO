import { authView } from "../public/auth-view.js";
import { pageData } from "./api.js";
import { createViews } from "../public/views.js";
import { routeState, cleanLinks } from "../public/routes.js";

export async function pageResponse(request, env) {
  if (!["GET", "HEAD"].includes(request.method))
    return new Response("Method not allowed", { status: 405 });
  const url = new URL(request.url),
    route = routeState(url);
  const template = await env.ASSETS.fetch(
    new Request(new URL("/index.html", url), { method: "GET" }),
  );
  if (!template.ok) return new Response("Page unavailable", { status: 503 });
  let model,
    cookies = [],
    status = 200;
  try {
    const data = await pageData(
      request,
      env,
      route.route === "repo" ? route.id : null,
    );
    cookies = data.cookies;
    if (route.route === "home" && data.bootstrap.user) {
      const headers = new Headers({
        location: "/discover",
        "cache-control": "private, no-store",
        vary: "Cookie",
      });
      for (const cookie of cookies) headers.append("set-cookie", cookie);
      return new Response(null, { status: 303, headers });
    }
    model = {
      ...data.bootstrap,
      ...route,
      ready: true,
      detail: data.detail?.resource ? data.detail : null,
      error: data.detail?.error || null,
    };
    if (data.detail?.error) status = data.detail.status || 503;
  } catch {
    model = {
      ...route,
      resources: [],
      stars: [],
      practices: [],
      user: null,
      ready: false,
      error: "暂时无法连接社区，请稍后重试。",
    };
    status = 503;
  }
  const view = createViews({ state: model });
  let main = "";
  if (!model.ready)
    main = view.empty("暂时无法连接", model.error, "retry", "重试");
  else if (route.route === "home") main = view.renderLanding();
  else if (["explore", "trending"].includes(route.route))
    main = view.renderDiscovery();
  else if (route.route === "repo") main = view.renderRepo();
  else if (route.route === "collections") main = view.renderCollections();
  else if (route.route === "author") main = view.renderListing();
  else if (
    ["login", "signup", "recover", "reset-password", "verify"].includes(
      route.route,
    )
  )
    main = authView({ state: model, ...view }, url);
  else
    main =
      '<div class="page-loading" role="status" aria-label="正在加载页面"><div class="loading-skeleton skeleton-heading"></div><div class="loading-skeleton skeleton-row"></div></div>';
  model.serverRendered =
    [
      "home",
      "explore",
      "trending",
      "repo",
      "collections",
      "author",
      "login",
      "signup",
      "recover",
      "reset-password",
      "verify",
    ].includes(route.route) && model.ready;
  const title =
    model.detail?.resource?.title ||
    {
      home: "增长实践社区",
      explore: "发现",
      trending: "实践榜",
      collections: "话题",
      login: "登录",
      signup: "加入 GrowthHub",
    }[route.route] ||
    "GrowthHub";
  // application/json is inert. Escaping '<' prevents user content closing the script element.
  const initial = JSON.stringify(model)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  let html = (await template.text())
    .replace(
      "<title>GrowthHub</title>",
      "<title>" + view.esc(title) + " · GrowthHub</title>",
    )
    .replace("<!--app-->", view.renderShell(cleanLinks(main)))
    .replace(
      "<!--initial-state-->",
      '<script id="initial-state" type="application/json">' +
        initial +
        "</script>",
    )
    .replace("<body>", '<body data-page="' + view.esc(route.route) + '">');
  const headers = new Headers({
    "content-type": "text/html; charset=utf-8",
    "cache-control": "private, no-store",
    vary: "Cookie",
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "content-security-policy":
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self'; frame-ancestors 'none'",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
  });
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(request.method === "HEAD" ? null : html, {
    status,
    headers,
  });
}
