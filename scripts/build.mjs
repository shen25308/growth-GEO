import fs from "node:fs/promises";
import { build } from "esbuild";
import { createHash } from "node:crypto";

await fs.rm("dist/assets", { recursive: true, force: true });
await fs.mkdir("dist/assets/assets", { recursive: true });
await build({
  entryPoints: ["public/app.js"],
  bundle: true,
  minify: true,
  format: "esm",
  target: ["safari16", "chrome110", "firefox115"],
  outdir: "dist/assets/assets",
  entryNames: "[name]-[hash]",
  metafile: true,
}).then(async (result) => {
  const script = Object.keys(result.metafile.outputs)
    .find((path) => path.endsWith(".js"))
    .replace("dist/assets", "");
  const theme = await fs.readFile(
    "node_modules/@primer/primitives/dist/css/functional/themes/light.css",
    "utf8",
  );
  const tokenNames = [
    "fgColor-default",
    "fgColor-muted",
    "bgColor-muted",
    "bgColor-default",
    "borderColor-default",
    "fgColor-accent",
  ];
  const usedTheme =
    ":root{" +
    tokenNames
      .map((name) => {
        const match = theme.match(new RegExp("--" + name + ":\\s*([^;]+);"));
        if (!match) throw Error("Missing Primer token: " + name);
        return "--" + name + ":" + match[1] + ";";
      })
      .join("") +
    "}";
  const css = (
    await Promise.all(
      ["styles.css", "community.css", "product.css", "auth.css"].map((file) =>
        fs.readFile("public/" + file, "utf8"),
      ),
    )
  ).join("\n");
  const resultCSS = await build({
    stdin: {
      contents: usedTheme + "\n" + css,
      loader: "css",
      resolveDir: process.cwd() + "/public",
    },
    minify: true,
    write: false,
  });
  const bytes = resultCSS.outputFiles[0].contents;
  const stylesheet =
    "/assets/product-" +
    createHash("sha256").update(bytes).digest("hex").slice(0, 12) +
    ".css";
  await fs.writeFile("dist/assets" + stylesheet, bytes);
  let html = await fs.readFile("public/index.html", "utf8");
  html = html
    .replace(/<link rel="stylesheet"[^>]+>/g, "")
    .replace("</head>", `<link rel="stylesheet" href="${stylesheet}"></head>`)
    .replace("/app.js", script);
  await fs.writeFile("dist/assets/index.html", html);
  console.log(`Browser assets: ${script}, ${stylesheet}`);
});
for (const name of await fs.readdir("public"))
  if (/\.(zip|txt)$/.test(name))
    await fs.copyFile("public/" + name, "dist/assets/" + name);
await fs.writeFile(
  "dist/assets/_headers",
  `${(await fs.readFile("public/_headers", "utf8")).replace(/  Cache-Control: no-cache\n/g, "")}\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n`,
);
// Portable release artifact runs the same entrypoint as Cloudflare, with a static asset binding.
const assets = {};
for (const folder of ["", "assets/"])
  for (const name of await fs.readdir("dist/assets/" + folder)) {
    const file = folder + name;
    if (name === "assets" || name === "_headers") continue;
    const binary = /\.zip$/.test(name);
    const type = name.endsWith(".html")
      ? "text/html; charset=utf-8"
      : name.endsWith(".js")
        ? "text/javascript"
        : name.endsWith(".css")
          ? "text/css"
          : binary
            ? "application/zip"
            : "text/plain";
    assets["/" + file] = {
      body: await fs.readFile(
        "dist/assets/" + file,
        binary ? "base64" : "utf8",
      ),
      binary,
      type,
    };
  }
const entry = `import worker from './worker/index.js';\nconst assets=${JSON.stringify(assets)};\nexport default {fetch(request,env){return worker.fetch(request,{PUBLIC_ORIGIN:new URL(request.url).origin,...env,ASSETS:{async fetch(request){const a=assets[new URL(request.url).pathname];if(!a)return new Response('Not found',{status:404});if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});return new Response(request.method==='HEAD'?null:a.binary?Uint8Array.from(atob(a.body),c=>c.charCodeAt(0)):a.body,{headers:{'content-type':a.type,'x-content-type-options':'nosniff','cache-control':new URL(request.url).pathname.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-cache'}})}}})}};`;
await fs.mkdir("dist/server", { recursive: true });
await build({
  stdin: {
    contents: entry,
    resolveDir: process.cwd(),
    sourcefile: "release-entry.js",
  },
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  outfile: "dist/server/index.js",
});
console.log("Built server-rendered GrowthHub and fingerprinted static assets.");
