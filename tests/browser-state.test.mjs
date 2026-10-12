import { test } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { build } from "esbuild";
import { createViews } from "../public/views.js";
const bundle = (
  await build({
    entryPoints: ["public/app.js"],
    bundle: true,
    write: false,
    format: "iife",
  })
).outputFiles[0].text;
const resource = {
  id: "guide",
  ownerId: "sb:author",
  owner: "Author",
  name: "Guide",
  title: "Guide",
  desc: "Description",
  type: "skill",
  topic: "GEO",
  tags: ["GEO"],
  difficulty: "beginner",
  readme: "# Guide\n## Steps\nReal steps",
  version: 1,
  updatedAt: 100,
  stars: 0,
  status: "published",
};
const detail = {
  resource,
  discussions: [],
  reports: [],
  proposals: [],
  revisions: [],
};
const user = {
  id: "sb:reader",
  name: "Reader",
  email: "reader@example.test",
  member: true,
  onboarded: true,
};
const tick = () => new Promise((r) => setTimeout(r, 15));
async function app(options = {}) {
  const window = new Window({ url: "https://growthhub.test/" });
  const model = {
    resources: [{ ...resource }],
    stars: [],
    practices: [],
    user: options.guest ? null : { ...user },
    auth: { ready: true, providers: ["google"] },
    route: "explore",
    type: "skill",
    topic: "all",
    level: "all",
    q: "",
    sort: "popular",
    tab: "guide",
    id: "",
    ready: true,
    serverRendered: true,
  };
  const views = createViews({ state: model });
  window.document.body.innerHTML =
    '<div id="app">' +
    views.renderShell(views.renderDiscovery()) +
    '</div><dialog id="modal"></dialog><div id="toast"></div><script id="initial-state" type="application/json">' +
    JSON.stringify(model) +
    "</script>";
  window.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  window.scrollTo = () => {};
  const calls = [];
  window.fetch = async (url, init = {}) => {
    const path = String(url);
    calls.push({ path, method: init.method });
    if (options.fetch) return options.fetch(path, init, window);
    return new window.Response(
      JSON.stringify(
        path.endsWith("/logout")
          ? { ok: true }
          : path.endsWith("/guide")
            ? detail
            : { active: true },
      ),
      { headers: { "content-type": "application/json" } },
    );
  };
  window.eval(bundle);
  await tick();
  const click = async (selector) => {
    const element = window.document.querySelector(selector);
    assert.ok(element, selector);
    element.click();
    await tick();
  };
  return { window, calls, click, close: () => window.happyDOM.abort() };
}
test("logout closes and empties account dialog, removes identity, and returns to public discovery", async () => {
  const a = await app();
  try {
    await a.click('[data-action="account-menu"]');
    assert.equal(a.window.document.querySelector("#modal").open, true);
    await a.click('[data-action="logout"]');
    assert.equal(a.window.document.querySelector("#modal").open, false);
    assert.equal(a.window.document.querySelector("#modal").textContent, "");
    assert.equal(
      a.window.document.querySelector('[data-action="account-menu"]'),
      null,
    );
    assert.ok(a.window.document.querySelector('[data-action="login"]'));
    assert.equal(a.window.location.pathname, "/");
    assert.ok(a.window.document.querySelector(".ranking-list"));
    assert.deepEqual(
      a.calls.map((c) => c.path),
      ["/api/auth/logout"],
    );
  } finally {
    await a.close();
  }
});
test("logout remains correct when localStorage is unavailable", async () => {
  const a = await app();
  try {
    a.window.localStorage.setItem = () => {
      throw Error("Storage denied");
    };
    await a.click('[data-action="account-menu"]');
    await a.click('[data-action="logout"]');
    assert.equal(a.window.document.querySelector("#modal").open, false);
    assert.ok(a.window.document.querySelector('[data-action="login"]'));
  } finally {
    await a.close();
  }
});
test("detail navigation reuses data across tabs; initial SSR avoids a second bootstrap", async () => {
  const a = await app();
  try {
    assert.equal(a.calls.length, 0);
    await a.click(".ranking-body h2 a");
    await a.click('.repo-nav a[href$="tab=discussions"]');
    await a.click('.repo-nav a[href$="tab=history"]');
    await a.click('.repo-nav a[href$="tab=guide"]');
    assert.deepEqual(
      a.calls.map((c) => c.path),
      ["/api/resources/guide"],
    );
    assert.match(
      a.window.document.querySelector(".markdown").textContent,
      /Real steps/,
    );
    assert.equal(a.window.location.pathname, "/resources/guide");
  } finally {
    await a.close();
  }
});
test("collecting a resource performs one mutation and no full bootstrap; failures roll back", async () => {
  for (const failure of [false, true]) {
    const a = await app({
      fetch: async (path, init, w) =>
        new w.Response(
          JSON.stringify(
            failure ? { error: "Could not save" } : { active: true },
          ),
          { status: failure ? 503 : 200 },
        ),
    });
    try {
      await a.click('[data-star="guide"]');
      assert.equal(
        a.window.document
          .querySelector('[data-star="guide"]')
          .getAttribute("aria-pressed"),
        String(!failure),
      );
      assert.deepEqual(a.calls, [
        { path: "/api/resources/guide/star", method: "PUT" },
      ]);
    } finally {
      await a.close();
    }
  }
});
test("a late detail response cannot restore private UI after logout", async () => {
  let release;
  const a = await app({
    fetch: async (path, init, w) => {
      if (path.endsWith("/guide"))
        return new Promise(
          (r) => (release = () => r(new w.Response(JSON.stringify(detail)))),
        );
      return new w.Response('{"ok":true}');
    },
  });
  try {
    await a.click(".ranking-body h2 a");
    await a.click('[data-action="account-menu"]');
    await a.click('[data-action="logout"]');
    release();
    await tick();
    assert.ok(a.window.document.querySelector('[data-action="login"]'));
    assert.equal(a.window.document.querySelector("#modal").textContent, "");
    assert.equal(a.window.document.querySelector(".repo-page"), null);
  } finally {
    await a.close();
  }
});
test("a logout event from another tab closes the account card immediately", async () => {
  const a = await app();
  try {
    await a.click('[data-action="account-menu"]');
    a.window.dispatchEvent(
      new a.window.StorageEvent("storage", {
        key: "growthhub-session-event",
        newValue: '{"event":"logout"}',
      }),
    );
    await tick();
    assert.equal(a.window.document.querySelector("#modal").open, false);
    assert.ok(a.window.document.querySelector('[data-action="login"]'));
  } finally {
    await a.close();
  }
});
test("focusing a resource preloads it and navigation reuses the single request", async () => {
  const a = await app();
  try {
    a.window.document
      .querySelector(".ranking-body h2 a")
      .dispatchEvent(new a.window.FocusEvent("focusin", { bubbles: true }));
    await tick();
    await a.click(".ranking-body h2 a");
    assert.deepEqual(
      a.calls.map((c) => c.path),
      ["/api/resources/guide"],
    );
    assert.ok(a.window.document.querySelector(".readme-panel"));
  } finally {
    await a.close();
  }
});
test("restoring a browser history snapshot revalidates identity instead of displaying the old card", async () => {
  const a = await app({
    fetch: async (path, init, w) =>
      new w.Response(
        JSON.stringify({
          resources: [resource],
          stars: [],
          practices: [],
          user: null,
          auth: { ready: true, providers: ["google"] },
        }),
      ),
  });
  try {
    await a.click('[data-action="account-menu"]');
    const event = new a.window.Event("pageshow");
    Object.defineProperty(event, "persisted", { value: true });
    a.window.dispatchEvent(event);
    await tick();
    assert.equal(a.window.document.querySelector("#modal").open, false);
    assert.ok(a.window.document.querySelector('[data-action="login"]'));
    assert.equal(a.calls[0].path, "/api/bootstrap");
  } finally {
    await a.close();
  }
});
