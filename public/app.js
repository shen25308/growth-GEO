import { createViews } from "./views.js";
import { installMotion } from "./motion.js";
installMotion();
import {
  routeHash,
  routeURL,
  cleanLinks,
  isPagePath,
  routeState,
} from "./routes.js";
import { createCommunity } from "./community.js";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)];

let state = {
  resources: [],
  stars: [],
  practices: [],
  user: null,
  route: "explore",
  q: "",
  type: "all",
  topic: "all",
  sort: "featured",
  level: "all",
  id: null,
  tab: "guide",
  detail: null,
  loading: false,
  error: null,
  ready: false,
};
let lastListing = "#explore",
  toastTimer,
  loadVersion = 0,
  editor = null,
  editorStep = "write";
function toast(s) {
  $("#toast").textContent = s;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 3500);
}
let sessionEpoch = 0,
  refreshFlight = null;
const requests = new Set(),
  detailCache = new Map(),
  detailFlights = new Map(),
  starPending = new Set();
const views = createViews({
  state,
  starPending,
  get lastListing() {
    return lastListing;
  },
});
const {
  icon,
  esc,
  types,
  topics,
  levels,
  colors,
  av,
  date,
  href,
  authorKey,
  repo,
  isOwn,
  markdown,
  filtered,
  starButton,
  tags,
  resourceRow,
  filterBar,
  empty,
  sidebar,
  rankingModes,
  rankingRow,
  detailTabs,
  guideView,
  discussionView,
  proposalView,
  diffView,
  historyView,
  outcomes,
  evidencePanel,
  practiceInline,
  practiceCallout,
  reportsView,
} = views;
async function api(path, method = "GET", body) {
  const epoch = sessionEpoch,
    controller = new AbortController();
  requests.add(controller);
  const timer = setTimeout(() => controller.abort("timeout"), 15000);
  try {
    const res = await fetch("/api/" + path, {
      method,
      signal: controller.signal,
      headers: body ? { "content-type": "application/json" } : {},
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await res.json().catch(() => {
      throw Error("无法连接数据服务，请稍后重试");
    });
    if (epoch !== sessionEpoch)
      throw Object.assign(Error("账户状态已更新，请重试"), { cancelled: true });
    if (!res.ok) {
      if (res.status === 401 && state.user && !path.startsWith("auth/")) {
        const next = routeHash();
        clearSession();
        go("#login?error=expired&next=" + encodeURIComponent(next));
      }
      throw Object.assign(Error(data.error || "操作失败"), {
        status: res.status,
      });
    }
    return data;
  } catch (e) {
    if (epoch !== sessionEpoch)
      throw Object.assign(Error("账户状态已更新，请重试"), { cancelled: true });
    if (controller.signal.aborted)
      throw Error("连接超时，输入已保留。请重试。");
    if (e instanceof TypeError)
      throw Error("连接中断，输入已保留。请恢复网络后重试。");
    throw e;
  } finally {
    clearTimeout(timer);
    requests.delete(controller);
  }
}
async function refresh() {
  if (refreshFlight) return refreshFlight;
  const epoch = sessionEpoch;
  const flight = api("bootstrap")
    .then((b) => {
      if (epoch !== sessionEpoch) return;
      Object.assign(state, {
        resources: b.resources,
        stars: b.stars,
        user: b.user,
        auth: b.auth,
        practices: b.practices || [],
        ready: true,
      });
      detailCache.clear();
    })
    .finally(() => {
      if (refreshFlight === flight) refreshFlight = null;
    });
  refreshFlight = flight;
  return flight;
}
function clearSession({ discardDrafts = false, broadcast = false } = {}) {
  const userId = state.user?.id;
  if ($("#modal").open) closeModal();
  else saveDraft();
  $("#modal").innerHTML = "";
  document.body.classList.remove("modal-open", "nav-open");
  editor = null;
  restoreFocus = null;
  sessionEpoch++;
  loadVersion++;
  for (const controller of requests) controller.abort();
  requests.clear();
  clearTimeout(prefetchTimer);
  refreshFlight = null;
  detailCache.clear();
  detailFlights.clear();
  starPending.clear();
  community.reset();
  Object.assign(state, {
    user: null,
    stars: [],
    practices: [],
    detail: null,
    loading: false,
    error: null,
    resources: state.resources.filter(
      (r) => !r.status || r.status === "published",
    ),
  });
  if (discardDrafts && userId) {
    try {
      for (const key of Object.keys(localStorage))
        if (key.startsWith("growthhub-draft-v4-" + userId + "-"))
          localStorage.removeItem(key);
    } catch {}
  }
  if (broadcast) {
    try {
      localStorage.setItem(
        "growthhub-session-event",
        JSON.stringify({ event: "logout", at: Date.now() }),
      );
    } catch {}
  }
}
function finishLogout() {
  clearSession({ discardDrafts: true, broadcast: true });
  go("#explore");
  shell();
  toast("已退出登录");
}
window.addEventListener("storage", (event) => {
  if (event.key === "growthhub-session-event" && event.newValue) {
    clearSession({ discardDrafts: true });
    go("#explore");
    shell();
  }
});

function shell() {
  $("#app").innerHTML = views.renderShell();
  renderMain();
}
function go(hash) {
  if ($("#modal").open) closeModal();
  const url = routeURL(hash);
  if (location.pathname + location.search !== url)
    history.pushState(null, "", url);
  route();
  document.body.classList.remove("nav-open");
}
async function route() {
  if ($("#modal").open) closeModal();
  const previous = state.id;
  Object.assign(state, routeState(location), { error: null, loading: false });
  if (state.route === "home" && state.user) {
    history.replaceState(null, "", "/discover");
    Object.assign(state, routeState(location));
  }
  if (location.hash && location.hash !== "#main")
    history.replaceState(null, "", routeURL(routeHash()));
  const cached = detailCache.get(state.id);
  state.detail =
    state.route === "repo" && cached && Date.now() - cached.at < 60000
      ? cached.data
      : null;
  if (state.route !== "repo") lastListing = routeHash();
  shell();
  if (previous !== state.id || state.route !== "repo") window.scrollTo(0, 0);
  if (state.route === "repo" && state.ready) await loadDetail(false);
  schedulePrefetch();
}
async function loadDetail(force = true) {
  const token = ++loadVersion,
    id = state.id,
    epoch = sessionEpoch,
    cached = detailCache.get(id);
  if (!force && cached && Date.now() - cached.at < 60000) {
    state.detail = cached.data;
    state.loading = false;
    state.error = null;
    renderMain();
    return;
  }
  state.loading = true;
  state.error = null;
  renderMain();
  try {
    let flight = detailFlights.get(id);
    if (!flight) {
      flight = api("resources/" + encodeURIComponent(id));
      detailFlights.set(id, flight);
      flight
        .finally(() => {
          if (detailFlights.get(id) === flight) detailFlights.delete(id);
        })
        .catch(() => {});
    }
    const data = await flight;
    if (epoch !== sessionEpoch) return;
    detailCache.set(id, { data, at: Date.now() });
    if (detailCache.size > 12)
      detailCache.delete(detailCache.keys().next().value);
    if (token !== loadVersion || state.route !== "repo" || state.id !== id)
      return;
    state.detail = data;
    state.loading = false;
    renderMain();
  } catch (e) {
    if (e.cancelled || token !== loadVersion) return;
    state.error = e.message;
    state.loading = false;
    renderMain();
  }
}
function updateQuery() {
  const p = new URLSearchParams();
  for (const k of ["q", "type", "topic", "level", "sort"])
    if (
      state[k] &&
      state[k] !==
        {
          q: "",
          type: state.route === "explore" ? "skill" : "all",
          topic: "all",
          level: "all",
          sort:
            state.route === "explore"
              ? "popular"
              : state.route === "trending"
                ? "practiced"
                : "featured",
        }[k]
    )
      p.set(k, state[k]);
  history.replaceState(
    null,
    "",
    routeURL("#" + state.route + (p.size ? "?" + p : "")),
  );
  lastListing = routeHash();
  renderMain();
}
function toggleTopic(topic) {
  if ($("#modal").open) closeModal();
  if (
    ["explore", "trending", "stars", "profile", "author"].includes(state.route)
  ) {
    state.topic = state.topic === topic ? "all" : topic;
    updateQuery();
  } else {
    go("#explore?type=all&topic=" + encodeURIComponent(topic));
  }
}

function syncShell() {
  const count = $('.global-nav a[href="/stars"] .counter');
  if (count) count.textContent = state.stars.length;
  $$(".global-nav>a,.mobile-nav>a").forEach((a) => {
    if (a.getAttribute("href") === routeURL("#" + state.route))
      a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  const context = $(".header-context");
  if (context)
    context.textContent =
      state.route === "repo" ? repo(state.id)?.owner || "资源" : "探索";
  if (state.route !== "repo")
    document.title =
      ({
        home: "增长，从分享开始",
        explore: "发现",
        trending: "实践榜",
        collections: "话题",
      }[state.route] || "GrowthHub") + " · GrowthHub";
}
function renderMain() {
  if (!$("#main")) return;
  syncShell();
  document.body.dataset.page = state.route;
  if (!state.ready) {
    $("#main").innerHTML =
      '<div class="page-loading" role="status" aria-label="正在加载社区"><div class="loading-skeleton skeleton-heading"></div><div class="loading-skeleton skeleton-row"></div><div class="loading-skeleton skeleton-row"></div></div>';
    return;
  }
  if (community.render()) return;
  if (state.route === "home") {
    $("#main").innerHTML = cleanLinks(views.renderLanding());
    return;
  }
  if (state.route === "repo") {
    renderRepo();
    return;
  }
  if (state.route === "collections") {
    renderCollections();
    return;
  }
  if (state.route === "journey") {
    renderJourney();
    return;
  }
  if (state.route === "practice") {
    renderPractices();
    return;
  }
  if (["explore", "trending"].includes(state.route)) {
    renderDiscovery();
    return;
  }
  const list = filtered(),
    personal = state.route === "profile" || state.route === "author";
  const name =
    state.route === "author"
      ? state.resources.find((r) => authorKey(r) === state.id)?.owner ||
        "社区成员"
      : state.user?.name;
  const title =
    state.route === "trending"
      ? "社区实践趋势"
      : state.route === "stars"
        ? "我的收藏"
        : personal
          ? name
          : "发现下一种增长可能。";
  $("#main").innerHTML =
    `<div class="explore-layout">${sidebar()}<div class="explore-content"><div class="page-heading"><div>${personal ? `<div class="profile-heading">${av(name, "large")}<div><h1>${esc(title)}</h1><p>${state.route === "profile" ? esc(state.user?.bio || "") : ""}</p></div></div>` : `<h1>${title}</h1><p>${state.route === "stars" ? "" : state.route === "trending" ? "按已分享的实践记录数排序。记录包含成功与失败，不代表效果保证。" : ""}</p>`}</div>${state.route === "profile" ? '<a class="btn" href="#drafts">云端草稿</a><a class="btn" href="#settings">账户设置</a>' : ""}</div><div class="content-columns"><section class="resource-feed"><div class="feed-title"><h2>${personal ? "资源" : state.route === "stars" ? "已收藏" : "探索资源"}<span class="counter">${list.length}</span></h2>${state.route === "profile" ? '<button class="btn primary btn-sm" data-action="publish">新建资源</button>' : '<span class="muted"></span>'}</div>${filterBar()}${state.q || state.topic !== "all" || state.level !== "all" ? `<div class="filter-summary"><span>${state.q ? "“" + esc(state.q) + "” · " : ""}${state.topic !== "all" ? esc(state.topic) + " · " : ""}${list.length} 个结果</span><button data-action="clear-filters">${icon("x")}清除筛选</button></div>` : ""}<div class="resource-list">${list.length ? list.map(resourceRow).join("") : empty(state.route === "stars" ? "暂无收藏" : personal ? "暂无资源" : "没有找到匹配资源", state.q || state.type !== "all" || state.topic !== "all" || state.level !== "all" ? "试试其他关键词，或清除筛选条件。" : "分享一个方法、一次复盘，或保存一份值得实践的资源。", personal ? "publish" : "reset", personal ? "发布资源" : "浏览全部资源")}</div><div class="list-end">${list.length ? "已展示 " + list.length + " 个资源" : ""}</div></section></div>${state.route === "profile" ? `<a class="practice-profile-link" href="#practice">${icon("check-circle")}我的实践 · ${state.practices.length} 项，继续记录结果 ${icon("chevron-right")}</a>` + legacyNotice() : ""}</div></div>`;
}

function renderDiscovery() {
  $("#main").innerHTML = cleanLinks(views.renderDiscovery());
}
function legacyNotice() {
  try {
    const old = JSON.parse(localStorage.getItem("growthhub-v1") || "{}");
    if (old.custom?.length)
      return `<div class="notice">${icon("info")}此浏览器还有 ${old.custom.length} 份旧版资源。<button data-action="export-legacy">下载备份</button>，原内容仍保留。</div>`;
  } catch {}
  return "";
}
function renderCollections() {
  $("#main").innerHTML = cleanLinks(views.renderCollections());
}

function renderRepo() {
  $("#main").innerHTML = cleanLinks(views.renderRepo());
  if (state.detail?.resource)
    document.title = state.detail.resource.title + " · GrowthHub";
}

let restoreFocus = null;
function openModal(title, body, footer = "") {
  const m = $("#modal");
  if (!m.open) restoreFocus = document.activeElement;
  m.className =
    title === "导航"
      ? "nav-dialog"
      : title === "我的账户"
        ? "account-dialog"
        : "";
  m.innerHTML = `<div class="dialog-head"><h2 id="dialog-title">${esc(title)}</h2><button class="icon-btn" data-action="close" aria-label="关闭弹窗">${icon("x")}</button></div>${body}${footer ? `<div class="dialog-footer">${footer}</div>` : ""}`;
  if (!m.open) m.showModal();
  m.scrollTop = 0;
  document.body.classList.add("modal-open");
}
function closeModal() {
  saveDraft();
  $("#modal").close();
  $("#modal").innerHTML = "";
  document.body.classList.remove("modal-open");
  restoreFocus?.isConnected && restoreFocus.focus();
  restoreFocus = null;
  editor = null;
}
function draftKey() {
  return (
    "growthhub-draft-v4-" +
    state.user?.id +
    "-" +
    (editor?.draftId || editor?.mode + "-" + (editor?.id || "new"))
  );
}
function saveDraft() {
  if (!editor) return;
  const f = $("#resource-form");
  if (f) {
    for (const [k, v] of new FormData(f)) editor[k] = String(v);
  }
  try {
    localStorage.setItem(draftKey(), JSON.stringify(editor));
    const s = $("#draft-status");
    if (s) s.textContent = "草稿已保存在此设备";
  } catch {
    const s = $("#draft-status");
    if (s) s.textContent = "无法保存草稿，请保持页面打开";
  }
}
function publish(mode = "new") {
  if (!community.gate()) return;
  const r = state.detail?.resource || repo(state.id);
  editor = {
    mode,
    requestId: crypto.randomUUID(),
    id: mode === "new" ? null : r?.id,
    name: mode === "new" ? "" : r.name,
    title: mode === "new" ? "" : r.title,
    desc: mode === "new" ? "" : r.desc,
    readme: mode === "new" ? "" : r.readme,
    type: r && mode !== "new" ? r.type : "skill",
    topic: r && mode !== "new" ? r.topic : "GEO",
    audience: r && mode !== "new" ? r.audience || "" : "",
    difficulty: r && mode !== "new" ? r.difficulty : "beginner",
    url: r && mode !== "new" ? r.url || "" : "",
    disclosure: mode === "new" ? "unspecified" : r?.disclosure || "unspecified",
    evidenceStatus:
      mode === "new" ? "untested" : r?.evidenceStatus || "untested",
    evidence: mode === "new" ? "" : r?.evidence || "",
    limits: mode === "new" ? "" : r?.limits || "",
    effort: mode === "new" ? "" : r?.effort || "",
    version: mode === "new" ? undefined : r?.version,
    changeTitle: "",
    message: "",
  };
  try {
    const d = JSON.parse(localStorage.getItem(draftKey()) || "null");
    if (d && d.version === editor.version) {
      editor = { ...editor, ...d };
      toast("已恢复未完成的草稿");
    }
  } catch {}
  editorStep = "write";
  renderEditor();
}
function renderEditor() {
  const e = editor,
    proposal = e.mode === "proposal";
  if (editorStep === "preview") {
    openModal(
      proposal ? "检查你的改进建议" : "预览资源",
      `<div class="editor-steps"><span>1 填写内容</span><strong>2 检查并提交</strong></div><div class="dialog-body preview-document">${proposal ? `<h3>${esc(e.changeTitle)}</h3><p>${esc(e.message)}</p>${diffView((state.detail?.resource || repo(state.id)).readme, e.readme)}` : `<span class="badge">${types[e.type]} · ${esc(e.topic)}</span><h2>${esc(e.title)}</h2><p>${esc(e.desc)}</p>${evidencePanel(e)}<div class="markdown">${markdown(e.readme)}</div>`}<p class="form-error" role="alert" id="editor-error"></p></div>`,
      `<button class="btn" data-action="editor-back">返回编辑</button><span class="muted">发布后可被访客浏览</span><button class="btn primary" data-action="editor-submit">${proposal ? "提交改进建议" : e.mode === "edit" ? "保存新版本" : "发布资源"}</button>`,
    );
    return;
  }
  openModal(
    proposal ? "提出改进建议" : e.mode === "edit" ? "编辑资源" : "发布增长资源",
    `<div class="editor-steps"><strong>1 填写内容</strong><span>2 检查并提交</span></div><form id="resource-form" novalidate><div class="dialog-body">${
      proposal
        ? `<div class="notice">${icon("git-branch")}基于 v${e.version} 提出修改，由资源作者审查后采纳。</div><div class="field"><label for="change-title">你想改进什么？ <span>*</span></label><input id="change-title" name="changeTitle" value="${esc(e.changeTitle)}" maxlength="100" placeholder="例如：补充内容更新后的复测步骤"></div><div class="field"><label for="change-message">为什么这样改？ <span>*</span></label><textarea id="change-message" name="message" maxlength="3000" placeholder="说明改动依据、适用条件或你的实践发现。">${esc(e.message)}</textarea></div>`
        : `<div class="field"><label>资源类型</label><div class="type-options">${Object.entries(
            types,
          )
            .map(
              ([k, n]) =>
                `<button type="button" data-editor-type="${k}" aria-pressed="${e.type === k}">${icon(k === "skill" ? "book" : k === "tool" ? "tools" : "comment-discussion")}<strong>${n}</strong></button>`,
            )
            .join(
              "",
            )}</div></div><div class="field"><label for="resource-title">资源标题 <span>*</span></label><input id="resource-title" name="title" maxlength="80" value="${esc(e.title)}" placeholder="用一句话说清楚，它能解决什么问题"></div><div class="field"><label for="resource-desc">简单介绍 <span>*</span></label><textarea id="resource-desc" name="desc" maxlength="300" placeholder="背景、主要方法，以及适用场景。">${esc(e.desc)}</textarea></div><div class="form-grid"><div class="field"><label for="resource-topic">所属话题</label><select id="resource-topic" name="topic">${topics.map((t) => `<option ${e.topic === t ? "selected" : ""}>${t}</option>`).join("")}</select></div><div class="field"><label for="resource-level">使用门槛</label><select id="resource-level" name="difficulty">${Object.entries(
            levels,
          )
            .map(
              ([k, n]) =>
                `<option value="${k}" ${e.difficulty === k ? "selected" : ""}>${n}</option>`,
            )
            .join(
              "",
            )}</select></div></div><div class="field"><label for="resource-audience">适合谁 <small>选填</small></label><input id="resource-audience" name="audience" maxlength="100" value="${esc(e.audience)}" placeholder="例如：负责内容增长的市场团队"></div>`
    }<div class="field"><div class="editor-label"><label for="resource-body">${proposal ? "修改后的完整指南" : "使用指南"} <span>*</span></label><button type="button" data-action="template">使用写作提纲</button></div><div class="write-toolbar"><span>${icon("file")}直接输入文字，也支持 Markdown</span><span id="word-count">${e.readme.length} 字</span></div><textarea id="resource-body" name="readme" class="body-editor" maxlength="150000" placeholder="从适用场景、准备事项和具体步骤开始…">${esc(e.readme)}</textarea></div>${!proposal ? `${qualityFields(e)}<details class="import-options"><summary>已有文档或项目链接？</summary><div class="field"><label for="resource-file">导入文本文件</label><input id="resource-file" type="file" accept=".md,.txt"><small>最大 150 KB，导入后仍可编辑。</small></div><div class="field"><label for="resource-url">项目链接 <small>选填</small></label><input id="resource-url" name="url" value="${esc(e.url)}" type="url" placeholder="https://" maxlength="2000"></div></details>${e.mode === "edit" ? `<div class="field"><label for="change-message">更新说明</label><input id="change-message" name="message" value="${esc(e.message)}" placeholder="这次补充或修正了什么？" maxlength="120"></div>` : ""}` : ""}<p class="form-error" role="alert" id="editor-error"></p></div><div class="dialog-footer"><span class="muted" id="draft-status">本机自动保存 · 可同步到云端</span><button class="btn" type="button" data-action="save-cloud-draft">保存云端草稿</button><button class="btn primary" type="submit">预览${proposal ? "改进" : "内容"} ${icon("chevron-right")}</button></div></form>`,
  );
}
function validateEditor() {
  saveDraft();
  $("#field-error")?.remove();
  const e = editor;
  let error = "",
    target = "";
  for (const [key, label, id] of e.mode === "proposal"
    ? [
        ["changeTitle", "改进标题", "change-title"],
        ["message", "改进说明", "change-message"],
        ["readme", "修改后的指南", "resource-body"],
      ]
    : [
        ["title", "资源标题", "resource-title"],
        ["desc", "简单介绍", "resource-desc"],
        ["readme", "使用指南", "resource-body"],
      ]) {
    if (!e[key].trim()) {
      error = "请填写" + label;
      target = id;
      break;
    }
  }
  if (
    !error &&
    e.mode !== "proposal" &&
    e.evidenceStatus !== "untested" &&
    !e.evidence.trim()
  ) {
    error = "请说明观察周期、样本和结果，或选择尚未验证";
    target = "resource-evidence";
  }
  if (!error && e.url) {
    try {
      const u = new URL(e.url);
      if (!["http:", "https:"].includes(u.protocol) || u.username || u.password)
        throw Error();
    } catch {
      error = "请填写完整的 http 或 https 链接";
      target = "resource-url";
    }
  }
  if (
    !error &&
    e.mode === "proposal" &&
    e.readme === (state.detail?.resource || repo(state.id)).readme
  ) {
    error = "请先修改指南内容，再提交改进建议";
    target = "resource-body";
  }
  if (error) {
    $("#editor-error").textContent = error;
    $("#" + target)?.setAttribute("aria-invalid", "true");
    const input = $("#" + target);
    if (input) {
      input.setAttribute("aria-describedby", "field-error");
      const hint = document.createElement("small");
      hint.id = "field-error";
      hint.className = "field-error";
      hint.textContent = error;
      input.after(hint);
      input.focus();
    }
    return false;
  }
  return true;
}
async function commitEditor(button) {
  if (!editor) return;
  button.disabled = true;
  button.textContent = "正在保存…";
  const e = { ...editor };
  let result;
  try {
    if (e.mode === "proposal")
      result = await api("resources/" + e.id + "/proposals", "POST", {
        title: e.changeTitle,
        body: e.message,
        data: { readme: e.readme },
        baseVersion: e.version,
      });
    else
      result = await api(
        e.mode === "edit" ? "resources/" + e.id : "resources",
        e.mode === "edit" ? "PUT" : "POST",
        e,
      );
  } catch (error) {
    $("#editor-error").textContent = error.message;
    button.disabled = false;
    button.textContent = "重试保存";
    return;
  }
  try {
    localStorage.removeItem(draftKey());
    if (e.draftId) await api("drafts/" + e.draftId, "DELETE", {});
  } catch {}
  editor = null;
  closeModal();
  const target =
    href(e.mode === "proposal" ? e.id : result.id) +
    (e.mode === "proposal" ? "?tab=proposals" : "");
  try {
    await refresh();
    go(target);
    toast(
      e.mode === "proposal"
        ? "改进建议已提交，原文保持不变"
        : e.mode === "edit"
          ? "新版本已保存"
          : "资源已发布到社区",
    );
  } catch {
    go(target);
    toast("内容已保存。列表暂时未刷新，可重新连接后查看。");
  }
}
async function fork(id, button) {
  button.disabled = true;
  try {
    const r =
      state.detail?.resource?.id === id
        ? state.detail.resource
        : (await api("resources/" + id)).resource;
    const result = await api("resources", "POST", {
      ...r,
      requestId:
        button.dataset.requestId ||
        (button.dataset.requestId = crypto.randomUUID()),
      forkedFrom: id,
    });
    await refresh();
    go(href(result.id));
    toast("副本已保存，可开始编辑你的实践");
  } catch (e) {
    toast(e.message);
    button.disabled = false;
  }
}
function discussionModal() {
  openModal(
    "发起讨论",
    `<form id="discussion-form"><div class="dialog-body"><div class="field"><label for="discussion-title">讨论标题</label><input id="discussion-title" name="title" maxlength="100" required placeholder="一个具体的问题或发现"></div><div class="field"><label for="discussion-body">背景与内容</label><textarea id="discussion-body" class="body-editor" name="body" maxlength="5000" required placeholder="描述你的场景、已经尝试的方法和需要帮助的地方。"></textarea></div><p class="form-error" id="discussion-error" role="alert"></p></div><div class="dialog-footer"><button class="btn primary" type="submit">发表讨论</button></div></form>`,
  );
}
function guide() {
  openModal(
    "使用指南",
    `<div class="dialog-body"><div class="guide-step"><span>1</span><div><h3>发现一个方法</h3><p>按话题和使用门槛筛选，先读清适用条件与步骤。</p></div></div><div class="guide-step"><span>2</span><div><h3>开始一次小实验</h3><p>记录场景、基线与观察周期。计划默认仅自己可见，在“我的实践”继续。</p></div></div><div class="guide-step"><span>3</span><div><h3>记录结果，也记录失败</h3><p>完成复盘后，可以主动分享到资源页。没有改善和结果不明确同样有价值；文档改进仍由作者审查。</p></div></div><div class="notice">资源、收藏、讨论和版本记录保存在社区中。草稿可保存到云端，并在“我的账户 → 云端草稿”继续编辑。</div></div>`,
    `<button class="btn" data-action="close">开始探索</button><button class="btn primary" data-action="publish">发布第一个资源</button>`,
  );
}
function download(name, body, type = "text/markdown;charset=utf-8") {
  const u = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
function checklist(r) {
  return (
    "# " +
    r.title +
    " · 实践检查清单\n\n- 确认目标用户与适用场景\n- 记录当前基线\n- 写清本次实验假设\n- 确定步骤、负责人和时间\n- 记录结果、局限与下一步\n- 保留原作者与引用来源\n\n来源：" +
    location.href
  );
}
async function share() {
  try {
    await navigator.clipboard.writeText(location.href);
    toast("链接已复制，公开资源无需登录即可查看");
  } catch {
    openModal(
      "分享资源",
      `<div class="dialog-body"><p>公开资源可以直接查看；已下架的资源仅作者和管理员可见。</p><input class="share-input" aria-label="资源链接" readonly value="${esc(location.href)}"></div>`,
    );
  }
}
async function start() {
  const initial = document.getElementById("initial-state");
  if (initial) {
    try {
      const model = JSON.parse(initial.textContent);
      initial.remove();
      Object.assign(state, model);
      if (model.detail)
        detailCache.set(model.id, { data: model.detail, at: Date.now() });
      const target = routeState(location);
      if (
        model.ready &&
        target.route === model.route &&
        target.id === model.id &&
        !location.hash
      ) {
        if (!model.serverRendered) renderMain();
        schedulePrefetch();
        return;
      }
    } catch {
      initial.remove();
    }
  }
  try {
    if (!state.ready) {
      await route();
      await refresh();
    }
    await route();
  } catch (e) {
    $("#app").innerHTML = views.renderShell(
      empty("暂时无法连接", esc(e.message), "retry", "重试"),
    );
  }
}
let prefetchTimer;
async function prefetchDetail(id) {
  const connection = navigator.connection;
  if (
    !id ||
    connection?.saveData ||
    /2g/.test(connection?.effectiveType || "") ||
    detailFlights.has(id) ||
    detailFlights.size >= 2
  )
    return;
  const cached = detailCache.get(id);
  if (cached && Date.now() - cached.at < 60000) return;
  const epoch = sessionEpoch;
  const flight = api("resources/" + encodeURIComponent(id));
  detailFlights.set(id, flight);
  try {
    const data = await flight;
    if (epoch !== sessionEpoch) return;
    detailCache.set(id, { data, at: Date.now() });
    if (detailCache.size > 12)
      detailCache.delete(detailCache.keys().next().value);
  } catch {
  } finally {
    if (detailFlights.get(id) === flight) detailFlights.delete(id);
  }
}
function schedulePrefetch() {
  clearTimeout(prefetchTimer);
  if (!["explore", "trending"].includes(state.route)) return;
  prefetchTimer = setTimeout(() => {
    const links = [
      ...document.querySelectorAll('.ranking-list a[href^="/resources/"]'),
    ];
    for (const a of links
      .filter((a) => {
        const r = a.getBoundingClientRect();
        return r.top < innerHeight && r.bottom > 0;
      })
      .slice(0, 2))
      prefetchDetail(routeState(new URL(a.href)).id);
  }, 600);
}
for (const event of ["pointerover", "focusin", "touchstart"])
  document.addEventListener(
    event,
    (e) => {
      const link = e.target.closest('a[href^="/resources/"]');
      if (link) prefetchDetail(routeState(new URL(link.href)).id);
    },
    { passive: true },
  );
document.addEventListener("click", async (ev) => {
  const b = ev.target.closest("button,a");
  if (!b) return;
  if (
    b.tagName === "A" &&
    (b.getAttribute("href")?.startsWith("#") ||
      (b.origin === location.origin && isPagePath(b.pathname))) &&
    !ev.metaKey &&
    !ev.ctrlKey &&
    !ev.shiftKey &&
    !ev.altKey &&
    !b.target &&
    ev.button === 0
  ) {
    if (b.getAttribute("href") === "#main") {
      $("#main").focus();
      return;
    }
    ev.preventDefault();
    go(b.getAttribute("href"));
    return;
  }
  const a = b.dataset.action;
  try {
    if (await community.click(b)) return;
  } catch (e) {
    const out = $("#modal .form-error");
    if (out) out.textContent = e.message;
    else toast(e.message);
    return;
  }
  if (a === "inbox") {
    go("#inbox");
    return;
  }
  if (a === "download-draft") {
    saveDraft();
    download(
      "GrowthHub-草稿备份.json",
      JSON.stringify(editor, null, 2),
      "application/json",
    );
    return;
  }
  if (a === "save-cloud-draft") {
    await saveCloudDraft(b);
    return;
  }
  if (
    (["publish", "edit", "propose", "new-discussion", "edit-profile"].includes(
      a,
    ) ||
      b.dataset.star ||
      b.dataset.fork ||
      b.dataset.practice ||
      b.dataset.discussion ||
      b.dataset.proposal) &&
    !community.gate()
  )
    return;
  if (a === "close") closeModal();
  if (a === "menu")
    openModal(
      "导航",
      `<div class="dialog-body mobile-menu-links">${[
        ["explore", "发现 Skills"],
        ["trending", "实践排行榜"],
        ["collections", "话题"],
        ["practice", "我的实践"],
        ["stars", "我的收藏"],
        ["profile", "我的资源"],
      ]
        .map(([p, n]) => `<a href="#${p}">${n}${icon("chevron-right")}</a>`)
        .join(
          "",
        )}<h3>增长话题</h3>${topics.map((t) => `<button data-topic="${esc(t)}" aria-pressed="${state.topic === t}">${esc(t)}${icon("chevron-right")}</button>`).join("")}</div>`,
    );
  if (b.dataset.practice)
    practiceModal(b.dataset.practice, b.dataset.complete === "true");
  if (a === "profile") go("#profile");
  if (a === "retry") start();
  if (a === "retry-detail") loadDetail();
  if (a === "publish") publish();
  if (a === "edit") publish("edit");
  if (a === "propose") publish("proposal");
  if (a === "guide") guide();
  if (a === "routes") go("#collections");
  if (a === "reset") go("#explore");
  if (a === "clear-filters") {
    state.q = "";
    state.topic = "all";
    state.level = "all";
    state.type = "all";
    $("#search").value = "";
    updateQuery();
  }
  if (a === "share") share();
  if (b.dataset.sort) {
    state.sort = b.dataset.sort;
    updateQuery();
  }
  if (b.dataset.filterType) {
    state.type = b.dataset.filterType;
    updateQuery();
  }
  if (b.dataset.topic) {
    toggleTopic(b.dataset.topic);
  }
  if (b.dataset.star) {
    const id = b.dataset.star;
    if (starPending.has(id)) return;
    const active = !state.stars.includes(id),
      r = repo(id),
      epoch = sessionEpoch;
    starPending.add(id);
    const before = r?.stars || 0;
    state.stars = active
      ? [...state.stars, id]
      : state.stars.filter((x) => x !== id);
    if (r) r.stars = Math.max(0, before + (active ? 1 : -1));
    renderMain();
    try {
      await api("resources/" + id + "/star", "PUT", { active });
      if (epoch === sessionEpoch) toast(active ? "已加入收藏" : "已取消收藏");
    } catch (e) {
      if (epoch !== sessionEpoch) return;
      state.stars = active
        ? state.stars.filter((x) => x !== id)
        : [...state.stars, id];
      if (r) r.stars = before;
      toast(e.message);
    } finally {
      if (epoch === sessionEpoch) {
        starPending.delete(id);
        renderMain();
      }
    }
  }
  if (b.dataset.fork) fork(b.dataset.fork, b);
  if (a === "download") {
    const r = state.detail?.resource || repo(state.id);
    download(r.name + ".md", r.readme);
  }
  if (b.dataset.doc) {
    const r = state.detail?.resource || repo(state.id);
    if (b.dataset.doc === "readme")
      $(".readme-panel")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    else
      openModal(
        "实践检查清单",
        `<div class="dialog-body markdown">${markdown(checklist(r))}</div>`,
        `<button class="btn" data-action="close">返回</button><button class="btn primary" data-action="download-checklist">下载清单</button>`,
      );
  }
  if (a === "download-checklist")
    download(
      "实践检查清单.md",
      checklist(state.detail?.resource || repo(state.id)),
    );
  if (b.dataset.editorType) {
    saveDraft();
    editor.type = b.dataset.editorType;
    renderEditor();
  }
  if (a === "template") {
    saveDraft();
    editor.readme +=
      (editor.readme ? "\n\n" : "") +
      "## 适用场景\n\n## 开始前的准备\n\n## 具体步骤\n\n- 第一步：\n- 第二步：\n- 第三步：\n\n## 结果与限制\n\n## 下一步\n";
    renderEditor();
    saveDraft();
    $("#resource-body").focus();
  }
  if (a === "editor-back") {
    editorStep = "write";
    renderEditor();
  }
  if (a === "editor-submit") commitEditor(b);
  if (a === "new-discussion") discussionModal();
  if (b.dataset.discussion) {
    b.disabled = true;
    try {
      await api(
        "resources/" + state.id + "/discussions/" + b.dataset.discussion,
        "PATCH",
        { status: b.dataset.status },
      );
      await loadDetail();
      toast("讨论状态已更新");
    } catch (e) {
      toast(e.message);
      b.disabled = false;
    }
  }
  if (b.dataset.proposal) {
    b.disabled = true;
    try {
      await api(
        "resources/" + state.id + "/proposals/" + b.dataset.proposal,
        "PATCH",
        { action: b.dataset.decision },
      );
      await refresh();
      await loadDetail();
      toast(
        b.dataset.decision === "merge"
          ? "改进已采纳，新版本已保存"
          : "改进建议已关闭",
      );
    } catch (e) {
      toast(e.message);
      b.disabled = false;
    }
  }
  if (b.dataset.version) {
    const v = state.detail.revisions.find((v) => v.id === b.dataset.version);
    openModal(
      "版本 v" + v.version + " · " + v.message,
      `<div class="dialog-body markdown">${markdown(v.data.readme)}</div>`,
      `<button class="btn" data-action="close">返回版本记录</button>`,
    );
  }
  if (a === "edit-profile")
    openModal(
      "编辑个人资料",
      `<form id="profile-form"><div class="dialog-body"><div class="field"><label for="profile-name">显示名称</label><input id="profile-name" name="name" value="${esc(state.user.name)}" maxlength="50" required></div><div class="field"><label for="profile-bio">个人介绍</label><textarea id="profile-bio" name="bio" maxlength="200">${esc(state.user.bio || "")}</textarea></div><p class="form-error" id="profile-error" role="alert"></p></div><div class="dialog-footer"><span></span><button class="btn primary" type="submit">保存资料</button></div></form>`,
    );
  if (a === "export-legacy")
    download(
      "GrowthHub-旧版资源备份.json",
      localStorage.getItem("growthhub-v1"),
      "application/json",
    );
  if (a === "about")
    openModal(
      "关于 GrowthHub",
      `<div class="dialog-body markdown"><h2>让增长经验可以被复用与改进。</h2><p>分享具体的场景、方法、结果与限制。资源保留作者与派生关系，改进在作者审查后生成新版本。</p><h3>社区约定</h3><ul><li>标注来源，尊重原创与授权。</li><li>不上传客户隐私、账号凭据或未经许可的数据。</li><li>区分事实、假设和假设，说明结论适用边界。</li></ul><div class="notice">当前为邀请试用版。可公开浏览资源；受邀成员可参与贡献。可通过资源页举报不当内容，处理结果会出现在消息通知中。</div></div>`,
      `<button class="btn primary" data-action="close">了解了</button>`,
    );
});

function renderJourney() {
  renderCollections();
}

function qualityFields(e) {
  return `<section class="quality-fields"><h3>让别人判断：这个方法适不适合我？</h3><p>如实填写观察与边界。尚未验证、失败或结果不明确，都可以分享。</p><div class="form-grid"><div class="field"><label for="resource-evidence-status">你实践过吗？</label><select id="resource-evidence-status" name="evidenceStatus">${["untested", "improved", "no-improvement", "mixed"].map((v) => `<option value="${v}" ${e.evidenceStatus === v ? "selected" : ""}>${outcomes[v]}</option>`).join("")}</select></div><div class="field"><label for="resource-effort">时间与成本 <small>选填</small></label><input id="resource-effort" name="effort" value="${esc(e.effort)}" maxlength="100" placeholder="例如：2 人，每周 3 小时，无额外预算"></div></div><div class="field"><label for="resource-evidence">结果依据</label><textarea id="resource-evidence" name="evidence" maxlength="1500" placeholder="做了多久、样本多少、前后发生什么变化？未验证可以留空。">${esc(e.evidence)}</textarea><small>选择已实践的结论时必填；请勿只写百分比而省略基线。</small></div><div class="field"><label for="resource-limits">不适用的场景 / 失败经验 <small>选填</small></label><textarea id="resource-limits" name="limits" maxlength="1000" placeholder="哪些条件下没用？有什么干扰因素或尚未确认的假设？">${esc(e.limits)}</textarea></div><div class="field"><label for="resource-disclosure">你与提到的项目是什么关系？</label><select id="resource-disclosure" name="disclosure">${Object.entries(
    {
      unspecified: "暂未说明",
      independent: "无商业关联",
      creator: "我是项目 / 工具的参与者",
      sponsored: "包含赞助或推广关系",
    },
  )
    .map(
      ([v, t]) =>
        `<option value="${v}" ${e.disclosure === v ? "selected" : ""}>${t}</option>`,
    )
    .join(
      "",
    )}</select></div><p class="quality-reminder">在站内写清可执行步骤和与你的项目的关系。只有外链、广告语或无法解释的增长数字，不能帮助别人复用。</p></section>`;
}

function renderPractices() {
  $("#main").innerHTML = cleanLinks(views.renderPractices());
}

function practiceModal(rid, complete = false) {
  const r = repo(rid),
    p = state.practices.find((p) => p.resource_id === rid);
  if (!r) return;
  complete = complete || p?.stage === "complete";
  const d = p?.data || {};
  const field = (
    key,
    label,
    placeholder,
    max = 1000,
    area = false,
    required = true,
  ) =>
    `<div class="field"><label for="practice-${key}">${label}${required ? " <span>*</span>" : " <small>选填</small>"}</label>${area ? `<textarea id="practice-${key}" name="${key}" maxlength="${max}" placeholder="${placeholder}" ${required ? "required" : ""}>${esc(d[key] || "")}</textarea>` : `<input id="practice-${key}" name="${key}" maxlength="${max}" placeholder="${placeholder}" value="${esc(d[key] || "")}" ${required ? "required" : ""}>`}</div>`;
  openModal(
    complete ? "记录这次实践的结果" : "开始一次实践",
    `<form id="practice-form" data-resource-id="${rid}" data-version="${p?.version || 0}" data-stage="${complete ? "complete" : "running"}"><div class="dialog-body"><div class="notice">${icon("book")} ${esc(r.title)} · 基于 v${p?.resource_version || r.version}</div>${field("context", "用在什么场景", "例如：两人内容团队，每周产出一篇文章", 1000, true)}<div class="form-grid">${field("metric", "观察什么指标", "例如：每篇内容投入的小时数", 120)}${field("baseline", "开始前是什么情况", "例如：每篇约 6 小时；若没有数据，写明待测量", 200)}</div>${field("timeframe", "观察周期 / 样本", "例如：10 月 7–21 日，4 篇文章", 100)}${complete ? `<div class="field"><label for="practice-outcome">观察结论 <span>*</span></label><select id="practice-outcome" name="outcome" required><option value="">请选择，不需要都是成功</option>${["improved", "no-improvement", "mixed"].map((v) => `<option value="${v}" ${d.outcome === v ? "selected" : ""}>${outcomes[v]}</option>`).join("")}</select></div>${field("result", "实际发生了什么", "记录具体结果；没有变化、变差或样本不足也可以。", 1500, true)}${field("limits", "有哪些局限或干扰", "例如：样本只有 4 篇，选题难度不同，不能直接归因。", 1000, true)}` : ""}${field("nextStep", "下一步准备做什么", "一个具体行动，例如：下周用相近难度的选题再试一次", 500, true, false)}${complete ? `<label class="share-choice"><input type="checkbox" name="share" ${p?.visibility === "community" ? "checked" : ""}><span><strong>把这份复盘分享到社区</strong><small>内容会出现在资源的实践记录中。未勾选时只有自己可见，请先去掉客户隐私等敏感信息。</small></span></label>` : '<p class="muted">计划保存到你的账户。你可以稍后回来补充结果，再决定是否分享。</p>'}<p class="form-error" role="alert"></p></div><div class="dialog-footer"><span class="muted">不以成功论贡献</span><button class="btn primary" type="submit">${complete ? "保存复盘" : "保存实践计划"}</button></div></form>`,
  );
}

let searchTimer;
document.addEventListener("input", (ev) => {
  if (ev.target.id === "search") {
    state.q = ev.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      if (
        !["explore", "trending", "stars", "profile", "author"].includes(
          state.route,
        )
      ) {
        state.route = "explore";
        state.id = null;
        state.type = "all";
        state.sort = "popular";
      }
      updateQuery();
    }, 120);
  }
  if (ev.target.closest("#resource-form")) {
    ev.target.removeAttribute("aria-invalid");
    ev.target.removeAttribute("aria-describedby");
    $("#field-error")?.remove();
    $("#editor-error").textContent = "";
    saveDraft();
    if ($("#word-count"))
      $("#word-count").textContent = editor.readme.length + " 字";
  }
});
document.addEventListener("change", async (ev) => {
  if (ev.target.id === "sort-filter") {
    state.sort = ev.target.value;
    updateQuery();
  }
  if (ev.target.id === "level-filter") {
    state.level = ev.target.value;
    updateQuery();
  }
  if (ev.target.id === "discovery-type") {
    state.type = ev.target.value;
    updateQuery();
  }
  if (ev.target.id === "discovery-topic") {
    state.topic = ev.target.value;
    updateQuery();
  }
  if (ev.target.closest("#resource-form")) saveDraft();
  if (ev.target.id === "resource-file") {
    const f = ev.target.files[0];
    if (!f) return;
    if (f.size > 150000 || !/\.(txt|md)$/i.test(f.name)) {
      $("#editor-error").textContent =
        "请选择不超过 150 KB 的 .txt 或 .md 文件";
      return;
    }
    editor.readme = await f.text();
    $("#resource-body").value = editor.readme;
    saveDraft();
    toast("文档已导入，原草稿已更新");
  }
});
document.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const f = ev.target;
  if (await community.submit(f)) return;
  if (!community.gate()) return;
  if (f.id === "resource-form") {
    if (validateEditor()) {
      editorStep = "preview";
      renderEditor();
    }
    return;
  }
  const button = f.querySelector("[type=submit]");
  if (!button) return;
  button.disabled = true;
  try {
    const body = Object.fromEntries(new FormData(f));
    if (f.id === "practice-form") {
      const { stage, ...data } = body;
      const rid = f.dataset.resourceId;
      await api("resources/" + rid + "/practice", "PUT", {
        stage: f.dataset.stage,
        visibility: body.share === "on" ? "community" : "private",
        version: Number(f.dataset.version),
        data,
      });
      closeModal();
      await refresh();
      if (state.route === "repo") await loadDetail();
      else renderMain();
      toast(
        body.share === "on"
          ? "实践复盘已分享，失败经验同样有价值"
          : "实践已保存，仅自己可见",
      );
    }
    if (f.classList.contains("reply-form")) {
      const id = f.dataset.discussionId;
      await api(
        "resources/" + state.id + "/discussions/" + id + "/replies",
        "POST",
        body,
      );
      state.openDiscussion = id;
      await loadDetail();
      toast("回复已发表");
    }
    if (f.id === "discussion-form") {
      await api("resources/" + state.id + "/discussions", "POST", body);
      closeModal();
      await loadDetail();
      toast("讨论已发表");
    }
    if (f.id === "profile-form") {
      await api("profile", "PUT", body);
      closeModal();
      await refresh();
      shell();
      toast("资料已保存");
    }
  } catch (e) {
    const out = f.querySelector(".form-error");
    if (out) out.textContent = e.message;
    button.disabled = false;
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") document.body.classList.remove("nav-open");
  if (
    (e.key === "/" && !["INPUT", "TEXTAREA"].includes(e.target.tagName)) ||
    ((e.metaKey || e.ctrlKey) && e.key === "k")
  ) {
    e.preventDefault();
    $("#search")?.focus();
  }
});
$("#modal").addEventListener("cancel", (e) => {
  e.preventDefault();
  closeModal();
});
$("#modal").addEventListener("click", (e) => {
  if (e.target === $("#modal")) {
    const r = e.target.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      closeModal();
  }
});
window.addEventListener("hashchange", route);
window.addEventListener("popstate", route);
window.addEventListener("beforeunload", saveDraft);
window.addEventListener("pageshow", async (event) => {
  if (!event.persisted) return;
  clearSession();
  state.ready = false;
  shell();
  try {
    await refresh();
    await route();
  } catch (e) {
    state.ready = true;
    $("#main").innerHTML = empty(
      "暂时无法连接",
      esc(e.message),
      "retry",
      "重试",
    );
  }
});
if (document.modelContext?.registerTool) {
  try {
    Promise.resolve(
      document.modelContext.registerTool({
        name: "search_growth_resources",
        description: "搜索 GrowthHub 增长资源并在界面展示结果。",
        inputSchema: {
          type: "object",
          properties: { query: { type: "string", maxLength: 100 } },
          required: ["query"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute(input) {
          if (typeof input?.query !== "string" || input.query.length > 100)
            throw Error("query must be a string of at most 100 characters");
          state.route = "explore";
          state.q = input.query;
          state.type = "all";
          state.topic = "all";
          state.level = "all";
          state.sort = "popular";
          shell();
          updateQuery();
          return {
            results: filtered().map((r) => ({
              id: r.id,
              title: r.title,
              type: r.type,
            })),
          };
        },
      }),
    ).catch(() => {});
  } catch {}
}
async function saveCloudDraft(button) {
  if (!editor) return;
  saveDraft();
  button.disabled = true;
  try {
    const previousKey = draftKey(),
      key = editor.draftId || crypto.randomUUID(),
      data = { ...editor, draftId: key };
    const result = await api("drafts/" + key, "PUT", {
      data,
      version: editor.cloudVersion || 0,
    });
    try {
      localStorage.removeItem(previousKey);
    } catch {}
    editor.draftId = key;
    editor.cloudVersion = result.version;
    saveDraft();
    $("#draft-status").textContent = "云端已保存 · 仅自己可见";
    toast("草稿已保存，可在其他设备继续编辑");
  } catch (e) {
    $("#editor-error").textContent = e.message;
    $("#editor-error").insertAdjacentHTML(
      "beforeend",
      ' <button type="button" class="btn btn-sm" data-action="download-draft">下载本机草稿</button>',
    );
    toast("云端未保存，本机草稿仍在");
  } finally {
    button.disabled = false;
  }
}
async function resumeDraft(d) {
  if (!d) return;
  if (d.data.mode !== "new") {
    const detail = await api("resources/" + d.data.id);
    if (detail.resource.version !== d.data.version) {
      openModal(
        "原资源已有新版本",
        `<div class="dialog-body"><p>为了保留你的修改，请先下载这份草稿，再基于最新资源重新编辑。</p><button class="btn" data-action="close">返回草稿箱</button></div>`,
      );
      download("GrowthHub-草稿.md", d.data.readme);
      return;
    }
    state.detail = detail;
    state.id = d.data.id;
  }
  editor = { ...d.data, draftId: d.id, cloudVersion: d.version };
  editorStep = "write";
  renderEditor();
}
const community = createCommunity({
  state,
  esc,
  icon,
  av,
  api,
  go,
  toast,
  refresh,
  shell,
  openModal,
  closeModal,
  download,
  href,
  resumeDraft,
  loadDetail,
  finishLogout,
});
start();
