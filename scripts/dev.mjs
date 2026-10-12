import { fixtureAuth, fixtureCookie } from "./auth-fixture.mjs";
import http from "node:http";
import fs from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import worker from "../dist/server/index.js";
await fs.mkdir(".sites-runtime", { recursive: true });
const sqlite = new DatabaseSync(".sites-runtime/preview.sqlite");
sqlite.exec(
  "PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY)",
);
for (const file of (await fs.readdir("drizzle"))
  .filter((x) => x.endsWith(".sql"))
  .sort()) {
  if (sqlite.prepare("SELECT name FROM _migrations WHERE name=?").get(file))
    continue;
  sqlite.exec(await fs.readFile("drizzle/" + file, "utf8"));
  sqlite.prepare("INSERT INTO _migrations(name) VALUES (?)").run(file);
}
export const DB = {
  prepare(sql) {
    return {
      bind(...values) {
        return {
          async first() {
            return sqlite.prepare(sql).get(...values) || null;
          },
          async all() {
            return { results: sqlite.prepare(sql).all(...values) };
          },
          async run() {
            const r = sqlite.prepare(sql).run(...values);
            return { meta: { changes: Number(r.changes) } };
          },
          sql,
          values,
        };
      },
    };
  },
  async batch(stmts) {
    sqlite.exec("BEGIN");
    try {
      const r = stmts.map((s) => {
        const x = sqlite.prepare(s.sql).run(...s.values);
        return { meta: { changes: Number(x.changes) } };
      });
      sqlite.exec("COMMIT");
      return r;
    } catch (e) {
      sqlite.exec("ROLLBACK");
      throw e;
    }
  },
};
// This identity switch exists only in the loopback preview server; it is never bundled.
for (const [id, name] of [
  ["sb:admin", "Alan Sun"],
  ["sb:member", "试用成员"],
])
  sqlite
    .prepare(
      "INSERT INTO profiles(id,name,bio,accepted_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET accepted_at=COALESCE(profiles.accepted_at,excluded.accepted_at)",
    )
    .run(id, name, "本地测试账户", Date.now());
sqlite
  .prepare(
    "INSERT OR IGNORE INTO invitations(email,created_by,created_at,active) VALUES (?,?,?,1)",
  )
  .run("member@example.test", "local-preview-alan", Date.now());
const previewBar =
  '<aside style="padding:8px 16px;background:#203d29;color:white;font:12px system-ui;display:flex;gap:16px;flex-wrap:wrap" aria-label="本地测试身份"><strong>仅本地预览</strong><a style="color:white" href="/__preview/guest">访客</a><a style="color:white" href="/__preview/member">试用成员</a><a style="color:white" href="/__preview/admin">管理员</a><a style="color:white" href="/__preview/pending">未受邀账户</a></aside>';
const port = Number(process.env.PORT || 4177);
http
  .createServer(async (req, res) => {
    try {
      const url = "http://127.0.0.1:" + port + req.url;
      if (req.url.startsWith("/__preview/")) {
        const mode = req.url.split("/")[2];
        if (!["guest", "member", "admin", "pending"].includes(mode))
          throw Error("Unknown test persona");
        res.writeHead(303, {
          "set-cookie":
            "gh-preview=" + mode + "; Path=/; HttpOnly; SameSite=Lax",
          location: "/",
        });
        res.end();
        return;
      }
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const headers = new Headers(req.headers);
      for (const key of [...headers.keys()])
        if (key.startsWith("oai-authenticated-")) headers.delete(key);
      const persona = /gh-preview=(admin|member|pending)/.exec(
        req.headers.cookie || "",
      )?.[1];
      if (persona) headers.set("cookie", fixtureCookie(persona));
      else headers.delete("cookie");
      const request = new Request(url, {
        method: req.method,
        headers,
        ...(!["GET", "HEAD"].includes(req.method)
          ? { body: Buffer.concat(chunks) }
          : {}),
      });
      let response = await worker.fetch(request, {
        DB,
        ...fixtureAuth,
        ADMIN_EMAILS: "admin@example.test",
        INVITE_ONLY: "true",
        PUBLIC_ORIGIN: "http://127.0.0.1:" + port,
      });
      const out = Object.fromEntries(response.headers);
      if (response.headers.getSetCookie().length)
        out["set-cookie"] = response.headers.getSetCookie();
      if (req.url === "/api/auth/logout")
        out["set-cookie"] = [
          ...(out["set-cookie"] || []),
          "gh-preview=guest; Path=/; HttpOnly; SameSite=Lax",
        ];
      let body = Buffer.from(await response.arrayBuffer());
      if (response.headers.get("content-type")?.includes("text/html"))
        body = Buffer.from(
          body.toString().replace(/<body([^>]*)>/, "<body$1>" + previewBar),
        );
      res.writeHead(response.status, out);
      res.end(body);
    } catch (e) {
      console.error(e.message);
      res.writeHead(500);
      res.end("Local preview failed");
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log("GrowthHub http://127.0.0.1:" + port),
  );
