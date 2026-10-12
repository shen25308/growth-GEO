import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { fixture } from "../scripts/sqlite-fixture.mjs";
import { fixtureAuth, fixtureCookie } from "../scripts/auth-fixture.mjs";
import worker from "../worker/index.js";
import { routeState, routeURL, routeHash } from "../public/routes.js";

const resource = {
  title: "An actual guide",
  name: "guide",
  desc: "A useful resource",
  readme:
    "# Guide\n## Install\nReal instructions </script><script>alert(1)</script>",
  tags: ["GEO"],
  topic: "GEO",
  type: "skill",
  difficulty: "beginner",
  evidenceStatus: "untested",
};
async function setup() {
  const data = await fixture();
  data.sqlite
    .prepare(
      "INSERT INTO resources(id,owner_id,owner_name,data,version,updated_at,status) VALUES(?,?,?,?,?,?,?)",
    )
    .run(
      "guide-id",
      "sb:owner",
      "Owner",
      JSON.stringify(resource),
      1,
      123,
      "published",
    );
  const template = await fs.readFile("public/index.html", "utf8");
  const env = {
    ...fixtureAuth,
    ...data,
    INVITE_ONLY: "true",
    PUBLIC_ORIGIN: "https://growthhub.test",
    ASSETS: { fetch: async () => new Response(template) },
  };
  return { ...data, env };
}
test("SSR discovery and detail contain real content before any browser JavaScript", async () => {
  const { env, sqlite } = await setup();
  try {
    for (const path of ["/", "/resources/guide-id"]) {
      const response = await worker.fetch(
        new Request("https://growthhub.test" + path),
        env,
      );
      assert.equal(response.status, 200);
      const html = await response.text();
      const app = html.split('<div id="app">')[1].split("<dialog")[0];
      assert.match(app, /An actual guide/);
      assert.match(app, /href="\/resources\/guide-id/);
      assert.doesNotMatch(app, /正在同步资源内容|loading-skeleton/);
      if (path !== "/") assert.match(app, /Real instructions &lt;\/script&gt;/);
      if (path !== "/") assert.match(html, /\\u003c\/script>/);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
    }
  } finally {
    sqlite.close();
  }
});
test("SSR login has working Google entry and email form, without waiting for bootstrap", async () => {
  const { env, sqlite } = await setup();
  try {
    const response = await worker.fetch(
      new Request("https://growthhub.test/login"),
      env,
    );
    const html = await response.text();
    assert.match(html, /id="auth-form"/);
    assert.match(html, /api\/auth\/oauth\?provider=google/);
    assert.doesNotMatch(html, /Apple/);
  } finally {
    sqlite.close();
  }
});
test("SSR resource visibility remains enforced and personal data is never shared-cacheable", async () => {
  const { env, sqlite } = await setup();
  try {
    sqlite.prepare("UPDATE resources SET status='archived'").run();
    const guest = await worker.fetch(
      new Request("https://growthhub.test/resources/guide-id"),
      env,
    );
    assert.equal(guest.status, 404);
    const text = await guest.text();
    assert.doesNotMatch(text, /Real instructions|An actual guide/);
    const owner = await worker.fetch(
      new Request("https://growthhub.test/resources/guide-id", {
        headers: { cookie: fixtureCookie("owner") },
      }),
      env,
    );
    assert.equal(owner.status, 200);
    assert.match(await owner.text(), /An actual guide/);
    assert.equal(owner.headers.get("vary"), "Cookie");
    assert.match(owner.headers.get("cache-control"), /no-store/);
  } finally {
    sqlite.close();
  }
});
test("old fragment and clean URLs resolve to the same resource, tab and filters", () => {
  for (const hash of [
    "#repo/guide-id?tab=discussions",
    "#explore?topic=GEO&type=all",
    "#signup?next=%23repo%2Fguide-id",
    "#author/sb%3Aowner",
  ]) {
    const legacy = new URL("https://growthhub.test/" + hash);
    const clean = new URL(routeURL(hash), "https://growthhub.test");
    assert.deepEqual(routeState(legacy), routeState(clean));
    assert.equal(routeHash(clean), hash);
  }
  assert.equal(routeURL("#main"), "#main");
});

test("guide contents link only to real sections and skip headings inside code blocks", async () => {
  const { env, sqlite } = await setup();
  try {
    sqlite
      .prepare("UPDATE resources SET data=? WHERE id=?")
      .run(
        JSON.stringify({
          ...resource,
          readme:
            "# Guide\n## Install\nDo this\n```markdown\n## Not a section\n```\n## Finish\nDone",
        }),
        "guide-id",
      );
    const response = await worker.fetch(
      new Request("https://growthhub.test/resources/guide-id"),
      env,
    );
    const html = await response.text();
    assert.match(html, /data-section="guide-section-0">Install/);
    assert.match(html, /data-section="guide-section-1">Finish/);
    assert.match(html, /id="guide-section-1" tabindex="-1">Finish/);
    assert.doesNotMatch(html, /data-section="guide-section-2"/);
    const toc = html.match(
      /<nav class="guide-contents"[^>]*>(.*?)<\/nav>/s,
    )?.[1];
    assert.doesNotMatch(toc, /Not a section/);
  } finally {
    sqlite.close();
  }
});
