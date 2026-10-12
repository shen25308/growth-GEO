const paths = {
  explore: "/",
  repo: "/resources",
  author: "/people",
  collections: "/topics",
  trending: "/trending",
  stars: "/stars",
  profile: "/profile",
  journey: "/journey",
  practice: "/practice",
  login: "/login",
  signup: "/signup",
  recover: "/recover",
  "reset-password": "/reset-password",
  verify: "/verify",
  onboarding: "/onboarding",
  settings: "/settings",
  drafts: "/drafts",
  inbox: "/inbox",
  admin: "/admin",
  terms: "/terms",
  privacy: "/privacy",
};
export function routeURL(hash) {
  if (!hash?.startsWith("#")) return hash || "/";
  const [path, query = ""] = hash.slice(1).split("?");
  const [name, ...rest] = path.split("/");
  if (!(name in paths)) return hash;
  return (
    paths[name] +
    (rest.length ? "/" + rest.join("/") : "") +
    (query ? "?" + query : "")
  );
}
export function isPagePath(path) {
  return (
    path === "/" ||
    Object.values(paths).some(
      (p) =>
        p !== "/" &&
        (path === p ||
          ((p === "/resources" || p === "/people") &&
            path.startsWith(p + "/"))),
    )
  );
}
export function routeHash(location = globalThis.location) {
  if (location.hash?.startsWith("#") && location.hash !== "#main")
    return location.hash;
  const [first, ...rest] = location.pathname.slice(1).split("/");
  const name =
    Object.entries(paths).find(([, path]) => path === "/" + first)?.[0] ||
    "explore";
  return (
    "#" +
    name +
    (rest.length ? "/" + rest.join("/") : "") +
    (location.search || "")
  );
}
export function routeState(location) {
  const [path, query = ""] = routeHash(location).slice(1).split("?");
  const [route, id = ""] = path.split("/");
  const p = new URLSearchParams(query);
  let decoded = "";
  try {
    decoded = decodeURIComponent(id);
  } catch {}
  let sort =
    p.get("sort") ||
    (route === "trending"
      ? "practiced"
      : route === "explore"
        ? "popular"
        : "featured");
  if (
    ["explore", "trending"].includes(route) &&
    !["popular", "practiced", "updated"].includes(sort)
  )
    sort = "popular";
  return {
    route: route in paths ? route : "explore",
    id: decoded,
    q: p.get("q") || "",
    type: p.get("type") || (route === "explore" ? "skill" : "all"),
    topic: p.get("topic") || "all",
    level: p.get("level") || "all",
    sort,
    tab: p.get("tab") || "guide",
  };
}
export function cleanLinks(html) {
  return html.replace(/href="#([^"<>]*)"/g, (all, value) =>
    value === "main" ? all : 'href="' + routeURL("#" + value) + '"',
  );
}
