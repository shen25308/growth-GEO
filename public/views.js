import { landingContent, landingShell } from "./landing.js";
import { ICONS } from "./icons.js";
import { cleanLinks } from "./routes.js";
export function createViews(ctx) {
  const { state } = ctx;
  const starPending = ctx.starPending || new Set();
  const icon = (n) => ICONS[n] || ICONS.repo;
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const types = { skill: "增长方法", experience: "实战心得", tool: "开源工具" };
  const topics = [
    "GEO",
    "SEO",
    "AI 自动化",
    "用户获取",
    "内容增长",
    "产品增长",
  ];
  const levels = {
    beginner: "无需编程",
    manual: "需要配置工具",
    technical: "需要技术协助",
  };
  const colors = ["#365744", "#5d6856", "#716853", "#526d66", "#777156"];
  const av = (name, size = "") =>
    `<span class="avatar ${size}" style="--av:${colors[[...String(name)].reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length]}">${esc(String(name).slice(0, 2).toUpperCase())}</span>`;
  const date = (t) =>
    new Date(t).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  const href = (id) => "#repo/" + encodeURIComponent(id);
  const authorKey = (r) => r.ownerId;
  const repo = (id) => state.resources.find((r) => r.id === id);
  const isOwn = (r) => r?.ownerId === state.user?.id;
  function markdown(input, anchors = false) {
    let section = 0;
    let code = false,
      lines = [],
      out = [],
      list = false;
    const end = () => {
      if (list) {
        out.push("</ul>");
        list = false;
      }
    };
    String(input)
      .split("\n")
      .forEach((raw) => {
        if (raw.startsWith("```")) {
          end();
          if (code) {
            out.push("<pre><code>" + esc(lines.join("\n")) + "</code></pre>");
            lines = [];
          }
          code = !code;
          return;
        }
        if (code) {
          lines.push(raw);
          return;
        }
        let s = esc(raw)
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          .replace(/`([^`]+)`/g, "<code>$1</code>");
        if (raw.startsWith("- ")) {
          if (!list) {
            out.push("<ul>");
            list = true;
          }
          out.push("<li>" + s.slice(2) + "</li>");
          return;
        }
        end();
        if (/^#{1,3} /.test(raw)) {
          const n = raw.indexOf(" ");
          out.push(
            `<h${n}${anchors && n === 2 ? ` id="guide-section-${section++}" tabindex="-1"` : ""}>${s.slice(n + 1)}</h${n}>`,
          );
        } else if (raw.startsWith("> "))
          out.push("<blockquote>" + s.slice(5) + "</blockquote>");
        else if (raw.trim()) out.push("<p>" + s + "</p>");
      });
    end();
    if (code) out.push("<pre><code>" + esc(lines.join("\n")) + "</code></pre>");
    return out.join("");
  }
  function renderLanding() {
    return landingContent({ icon });
  }
  function renderShell(content = "") {
    if (state.route === "home" && !state.user)
      return cleanLinks(landingShell(content, icon));
    const r = repo(state.id);
    return cleanLinks(
      `<header class="global-header"><button class="icon-btn menu-toggle" data-action="menu" aria-label="打开导航" aria-expanded="false">${icon("three-bars")}</button><a href="${state.user ? "#explore" : "#home"}" class="brand" aria-label="GrowthHub 首页"><span class="brand-mark"><i></i><i></i><i></i></span><strong>GrowthHub</strong></a><label class="global-search">${icon("search")}<input id="search" aria-label="搜索增长资源" placeholder="搜索资源…" value="${esc(state.q)}" maxlength="100"><kbd>/</kbd></label><button class="btn primary header-new" data-action="publish" aria-label="发布资源">${icon("plus")}<span>发布资源</span></button>${state.user ? `<button class="icon-btn header-inbox" data-action="inbox" aria-label="消息通知">${icon("comment-discussion")}</button><button class="avatar-button" data-action="account-menu" aria-label="账户菜单">${av(state.user.name)}</button>` : '<button class="btn header-signin" data-action="login">登录 / 注册</button>'}</header><nav class="global-nav" aria-label="主导航">${[
        ["explore", "globe", "发现"],
        ["trending", "flame", "实践榜"],
        ["collections", "bookmark", "话题"],
        ["practice", "check-circle", "我的实践"],
        ["stars", "star", "我的收藏"],
        ["profile", "repo", "我的资源"],
      ]
        .map(
          ([p, i, t]) =>
            `<a href="#${p}" ${state.route === p ? 'aria-current="page"' : ""}>${icon(i)}${t}${p === "stars" ? `<span class="counter">${state.stars.length}</span>` : ""}</a>`,
        )
        .join(
          "",
        )}</nav><main id="main" tabindex="-1">${content}</main><footer class="site-footer"><span class="footer-brand">${icon("repo")}GrowthHub</span><button data-action="guide">使用指南</button><a href="#terms">社区约定</a><a href="#privacy">隐私说明</a><span>© 2026</span></footer><nav class="mobile-nav" aria-label="手机导航">${[
        ["explore", "globe", "发现"],
        ["collections", "bookmark", "话题"],
        ["publish", "plus", "发布"],
        ["stars", "star", "收藏"],
        ["profile", "person", "我的"],
      ]
        .map(([p, i, t]) =>
          p === "publish"
            ? `<button data-action="publish">${icon(i)}${t}</button>`
            : `<a href="#${p}" ${state.route === p ? 'aria-current="page"' : ""}>${icon(i)}${t}</a>`,
        )
        .join("")}</nav>`,
    );
  }
  function filtered() {
    let a = state.resources.filter(
      (r) =>
        !r.status ||
        r.status === "published" ||
        (state.route === "profile" && isOwn(r)),
    );
    if (state.route === "stars")
      a = a.filter((r) => state.stars.includes(r.id));
    if (state.route === "profile") a = a.filter(isOwn);
    if (state.route === "author")
      a = a.filter((r) => authorKey(r) === state.id);
    a = a.filter(
      (r) =>
        (state.type === "all" || r.type === state.type) &&
        (state.topic === "all" ||
          r.topic === state.topic ||
          r.tags.includes(state.topic)) &&
        (state.level === "all" || r.difficulty === state.level) &&
        (!state.q ||
          [r.title, r.desc, r.owner, r.name, ...r.tags]
            .join(" ")
            .toLowerCase()
            .includes(state.q.toLowerCase())),
    );
    if (state.sort === "popular")
      a.sort(
        (a, b) =>
          b.stars - a.stars ||
          b.forks - a.forks ||
          b.updatedAt - a.updatedAt ||
          a.id.localeCompare(b.id),
      );
    if (state.sort === "practiced")
      a.sort(
        (a, b) =>
          (b.practiceCount || 0) - (a.practiceCount || 0) ||
          b.updatedAt - a.updatedAt ||
          a.id.localeCompare(b.id),
      );
    if (state.sort === "updated")
      a.sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
    return a;
  }
  function starButton(r) {
    const on = state.stars.includes(r.id);
    return `<button class="btn btn-sm ${on ? "starred" : ""}" data-star="${esc(r.id)}" aria-label="${on ? "取消收藏" : "收藏"} ${esc(r.title)}" aria-pressed="${on}" ${starPending.has(r.id) ? 'disabled aria-busy="true"' : ""}>${icon(on ? "star-fill" : "star")}<span>${on ? "已收藏" : "收藏"}</span><span class="button-count">${r.stars || 0}</span></button>`;
  }
  function tags(r) {
    return `<div class="tags">${r.tags.map((t) => `<button data-topic="${esc(t)}" aria-pressed="${state.topic === t}">${esc(t)}</button>`).join("")}</div>`;
  }
  function resourceRow(r) {
    return `<article class="resource-row"><div class="row-body"><div class="card-category"><a class="card-author" href="#author/${encodeURIComponent(authorKey(r))}">${av(r.owner)}${esc(r.owner)}</a><span>${types[r.type]}</span>${r.status === "archived" ? '<span class="badge">已下架</span>' : r.status === "hidden" ? '<span class="badge">审核隐藏</span>' : ""}</div><h3><a href="${href(r.id)}">${esc(r.title)}</a></h3><p class="resource-desc">${esc(r.desc)}</p>${tags(r)}<div class="card-footer"><div class="resource-meta"><span>${levels[r.difficulty] || "无需编程"}</span><span>${date(r.updatedAt)}更新</span></div>${starButton(r)}</div></div></article>`;
  }
  function filterBar() {
    return `<div class="filter-bar"><div class="segmented" aria-label="资源类型">${[["all", "全部"], ...Object.entries(types)].map(([v, t]) => `<button data-filter-type="${v}" aria-pressed="${state.type === v}">${t}</button>`).join("")}</div><div class="select-filters"><label><span class="sr-only">使用门槛</span><select id="level-filter"><option value="all">所有门槛</option>${Object.entries(
      levels,
    )
      .map(
        ([k, v]) =>
          `<option value="${k}" ${state.level === k ? "selected" : ""}>${v}</option>`,
      )
      .join(
        "",
      )}</select></label><label><span class="sr-only">资源排序</span><select id="sort-filter">${[
      ["featured", "精选排序"],
      ["practiced", "最多实践记录"],
      ["popular", "最多收藏"],
      ["updated", "最近更新"],
    ]
      .map(
        ([k, v]) =>
          `<option value="${k}" ${state.sort === k ? "selected" : ""}>${v}</option>`,
      )
      .join("")}</select></label></div></div>`;
  }
  function empty(title, body, action = "reset", button = "浏览全部资源") {
    return `<div class="empty-state">${icon("repo")}<h2>${title}</h2><p>${body}</p><button class="btn" data-action="${action}">${button}</button></div>`;
  }
  function sidebar() {
    return `<aside class="explore-sidebar"><h2>资源</h2><nav aria-label="资源分类">${[
      ["all", "globe", "全部资源"],
      ["skill", "book", "增长方法"],
      ["experience", "comment-discussion", "实战心得"],
      ["tool", "tools", "开源工具"],
    ]
      .map(
        ([k, i, v]) =>
          `<button data-filter-type="${k}" aria-pressed="${state.type === k}" ${state.type === k ? 'class="active"' : ""}>${icon(i)}${v}<span>${state.resources.filter((r) => (!r.status || r.status === "published") && (k === "all" || r.type === k)).length}</span></button>`,
      )
      .join(
        "",
      )}</nav><h3>话题</h3><nav aria-label="增长话题">${topics.map((t) => `<button data-topic="${t}" aria-pressed="${state.topic === t}" ${state.topic === t ? 'class="active"' : ""}>${icon("hash")}${t}</button>`).join("")}</nav></aside>`;
  }
  const rankingModes = {
    popular: "最多收藏",
    practiced: "最多实践",
    updated: "最近更新",
  };
  const topicIcons = {
    GEO: "globe",
    SEO: "search",
    "AI 自动化": "workflow",
    用户获取: "people",
    内容增长: "book",
    产品增长: "goal",
  };
  function resourceCover(r, compact = false) {
    const tone =
      r.type === "tool" ? "slate" : r.type === "experience" ? "sand" : "forest";
    // A native, animated publication cover, derived from real resource metadata.
    // This is artwork, not an imitation screenshot or a claim of measured results.
    return `<div class="resource-cover cover-${tone} ${compact ? "cover-compact" : ""}" data-tilt aria-hidden="true"><div class="cover-orbit orbit-one"></div><div class="cover-orbit orbit-two"></div><div class="cover-stage"><div class="cover-sheet sheet-back">${icon("file")}</div><div class="cover-sheet sheet-middle">${icon("check-circle")}</div><div class="cover-book"><div class="book-spine"></div><div class="book-face"><span class="book-brand">GrowthHub</span><span class="book-topic">${esc(r.topic || types[r.type])}</span><span class="book-format">${r.type === "skill" ? "SKILL" : r.type === "tool" ? "TOOLKIT" : "FIELD NOTES"}</span><span class="book-symbol">${icon(topicIcons[r.topic] || "book")}</span><span class="book-author">${esc(r.owner)}</span></div></div><span class="cover-token token-one">${icon("workflow")}</span><span class="cover-token token-two">${icon("book")}</span></div><span class="cover-open">${icon("chevron-right")}</span></div>`;
  }
  function rankingRow(r, index) {
    return `<li class="ranking-row ${index === 0 ? "ranking-lead" : ""}"><a class="resource-cover-link" href="${href(r.id)}" aria-label="查看 ${esc(r.title)}">${resourceCover(r, index > 0)}</a><article class="ranking-body"><div class="ranking-byline"><a href="#author/${encodeURIComponent(authorKey(r))}">${av(r.owner)}${esc(r.owner)}</a><span class="ranking-type">${types[r.type]}</span>${state.route === "trending" ? `<span class="rank-position">#${index + 1}</span>` : ""}</div><h2><a href="${href(r.id)}">${esc(r.title)}</a></h2><p class="ranking-description">${esc(r.desc)}</p>${tags(r)}<div class="ranking-meta"><span>${icon("check-circle")}${levels[r.difficulty] || "无需编程"}</span><span>${icon("git-branch")}v${r.version || 1}</span>${r.practiceCount ? `<span>${icon("graph")}${r.practiceCount} 份实践</span>` : ""}<span>${date(r.updatedAt)} 更新</span></div></article><div class="ranking-actions"><a class="resource-read" href="${href(r.id)}">查看资源 ${icon("chevron-right")}</a>${starButton(r)}</div></li>`;
  }
  function discoveryContext() {
    const published = state.resources.filter(
      (r) => !r.status || r.status === "published",
    );
    const maintainers = [
      ...new Map(published.map((r) => [r.ownerId, r])).values(),
    ].slice(0, 5);
    return `<aside class="discovery-context"><section class="context-section context-topics"><h2>探索话题<a href="#collections" aria-label="查看全部话题">${icon("chevron-right")}</a></h2><div class="topic-tiles">${topics.map((t, i) => `<button class="topic-tile topic-tone-${i}" data-topic="${t}" aria-pressed="${state.topic === t}"><span class="topic-tile-icon">${icon(topicIcons[t])}</span><strong>${t}</strong></button>`).join("")}</div></section><section class="context-section context-makers"><h2>资源维护者</h2>${maintainers.map((r) => `<a class="context-person" href="#author/${encodeURIComponent(r.ownerId)}">${av(r.owner)}<span><strong>${esc(r.owner)}</strong><span>${published.filter((item) => item.ownerId === r.ownerId).length} 个公开资源</span></span>${icon("chevron-right")}</a>`).join("") || '<p class="muted">暂无公开资源</p>'}</section><section class="context-publish"><div class="publish-art" aria-hidden="true"><span>${icon("book")}</span><span>${icon("plus")}</span></div><h2>把你的方法，<br>变成下一个好资源。</h2><button class="btn full" data-action="publish">发布资源 ${icon("chevron-right")}</button></section></aside>`;
  }

  function renderDiscovery() {
    const list = filtered(),
      hasFilter = !!(state.q || state.topic !== "all" || state.level !== "all");
    const anyPublished = state.resources.some(
      (r) => !r.status || r.status === "published",
    );
    const title = state.route === "trending" ? "实践榜" : "发现";

    return `<div class="explore-layout discovery-layout">${sidebar()}<div class="explore-content"><header class="discovery-heading"><div><h1>${title}</h1><span class="ranking-total">${list.length} 个${state.type === "all" ? "资源" : types[state.type] || "资源"}</span></div></header><nav class="mobile-categories" aria-label="资源类型">${[["all", "全部"], ...Object.entries(types)].map(([key, label]) => `<button data-filter-type="${key}" aria-pressed="${state.type === key}">${label}</button>`).join("")}</nav><section class="ranking-feed" aria-label="增长资源排行榜"><div class="ranking-toolbar"><div class="ranking-tabs" aria-label="排行榜排序">${Object.entries(
      rankingModes,
    )
      .map(
        ([key, label]) =>
          `<button data-sort="${key}" aria-pressed="${state.sort === key}">${label}</button>`,
      )
      .join(
        "",
      )}</div><details class="discovery-filter-panel"><summary>${icon("three-bars")}筛选${hasFilter ? '<span class="filter-dot" aria-label="已启用筛选"></span>' : ""}</summary><div class="ranking-filters"><label>资源类型<select id="discovery-type">${[["all", "全部资源"], ...Object.entries(types)].map(([k, v]) => `<option value="${k}" ${state.type === k ? "selected" : ""}>${v}</option>`).join("")}</select></label><label>话题<select id="discovery-topic"><option value="all">全部话题</option>${state.topic !== "all" && !topics.includes(state.topic) ? `<option value="${esc(state.topic)}" selected>${esc(state.topic)}</option>` : ""}${topics.map((t) => `<option value="${t}" ${state.topic === t ? "selected" : ""}>${t}</option>`).join("")}</select></label><label>使用门槛<select id="level-filter"><option value="all">全部</option>${Object.entries(
      levels,
    )
      .map(
        ([k, v]) =>
          `<option value="${k}" ${state.level === k ? "selected" : ""}>${v}</option>`,
      )
      .join(
        "",
      )}</select></label></div></details></div>${hasFilter ? `<div class="filter-summary"><span>${state.q ? "“" + esc(state.q) + "” · " : ""}${state.topic !== "all" ? esc(state.topic) + " · " : ""}${state.level !== "all" ? levels[state.level] + " · " : ""}${list.length} 个结果</span><button data-action="clear-filters">${icon("x")}清除筛选</button></div>` : ""}${list.length ? `<ol class="ranking-list">${list.map(rankingRow).join("")}</ol>` : !anyPublished && !hasFilter ? empty("还没有发布的资源", "发布增长方法、实战心得或开源工具。", "publish", "发布资源") : empty("没有匹配的资源", "换一个关键词或筛选条件。", "clear-filters", "清除筛选")}</section></div>${discoveryContext()}</div>`;
  }
  function renderCollections() {
    const publicResources = state.resources.filter(
      (r) => !r.status || r.status === "published",
    );

    return `<div class="collections-page"><div class="page-heading"><h1>话题</h1></div><div class="collection-grid">${topics
      .map((t) => {
        const list = publicResources.filter(
          (r) => r.topic === t || r.tags.includes(t),
        );
        return `<a class="collection" href="#explore?type=all&topic=${encodeURIComponent(t)}"><span class="topic-mark">${icon("hash")}</span><h2>${t}</h2><span>${list.length} 个资源</span>${icon("chevron-right")}</a>`;
      })
      .join("")}</div></div>`;
  }
  function detailTabs(r) {
    return [
      ["guide", "book", "使用指南", null],
      [
        "reports",
        "check-circle",
        "实践记录",
        state.detail?.reports?.length || 0,
      ],
      [
        "discussions",
        "issue-opened",
        "讨论",
        state.detail?.discussions?.length || 0,
      ],
      [
        "proposals",
        "git-branch",
        "改进建议",
        state.detail?.proposals?.length || 0,
      ],
      ["history", "graph", "版本记录", state.detail?.revisions?.length || 1],
    ]
      .map(
        ([t, i, n, count]) =>
          `<a href="${href(r.id)}?tab=${t}" ${state.tab === t ? 'aria-current="page"' : ""}>${icon(i)}${n}${count !== null ? `<span class="counter">${count}</span>` : ""}</a>`,
      )
      .join("");
  }
  function renderRepo() {
    if (state.error) {
      return empty(
        "资源暂时无法打开",
        esc(state.error),
        "retry-detail",
        "重新加载",
      );
      return;
    }
    const r = state.detail?.resource;
    if (!r) {
      return '<div class="page-loading" role="status" aria-label="正在加载资源"><div class="loading-skeleton skeleton-heading"></div><div class="loading-skeleton skeleton-row"></div></div>';
      return;
    }
    const own = isOwn(r),
      summary = repo(r.id) || r;

    return `<div class="repo-page"><div class="repo-header"><a class="back-link" href="${esc(ctx.lastListing || "#explore")}">${icon("chevron-left")}返回资源库</a><div class="repo-title-row"><div class="repo-art">${resourceCover(r, true)}</div><div class="repo-identity"><div class="repo-byline"><a href="#author/${encodeURIComponent(authorKey(r))}">${av(r.owner)}${esc(r.owner)}</a><span>${types[r.type]} · ${esc(r.topic)}</span></div><h1>${esc(r.title)}</h1><p class="repo-subtitle">${esc(r.desc)}</p></div><div class="repo-actions">${starButton(summary)}<button class="btn btn-sm" data-action="share">${icon("copy")}分享</button><button class="btn btn-sm" data-fork="${esc(r.id)}">${icon("repo-forked")}保存副本<span class="button-count">${summary.forks || 0}</span></button></div></div>${r.forkedFrom ? `<p class="fork-source">派生自 <a href="${href(r.forkedFrom)}">${esc(repo(r.forkedFrom)?.owner || "原作者")} / ${esc(repo(r.forkedFrom)?.name || "原始资源")}</a></p>` : ""}${r.status && r.status !== "published" ? `<div class="notice">${r.status === "hidden" ? "此资源已被管理员隐藏，请查看消息中的处理说明。" : "此资源已下架，仅你和管理员可以查看。"}</div>` : ""}<nav class="repo-nav" aria-label="资源导航">${detailTabs(r)}</nav></div><div class="repo-content"><section class="repo-primary">${state.error ? `<div class="notice error">${esc(state.error)}<button data-action="retry-detail">重新加载</button></div>` : ""}${state.tab === "guide" ? guideView(r, own) : state.tab === "reports" ? reportsView(r) : state.tab === "discussions" ? discussionView(r) : state.tab === "proposals" ? proposalView(r) : historyView(r)}</section><aside class="repo-about">${guideContents(r)}${practiceCallout(r)}<h2>资源信息</h2>${tags(r)}<div class="about-facts"><span>${icon("book")}${types[r.type]}</span><span>${icon("check-circle")}${levels[r.difficulty] || "无需编程"}</span><span>${icon("star")}${summary.stars || 0} 次收藏</span><span>${icon("repo-forked")}${summary.forks || 0} 份副本</span><span>${icon("graph")}v${r.version} · ${date(r.updatedAt)}</span>${r.url ? `<a target="_blank" rel="noopener" href="${esc(r.url)}">${icon("link-external")}资源链接</a>` : ""}</div><section><h3>维护者</h3><a class="contributor" href="#author/${encodeURIComponent(authorKey(r))}">${av(r.owner)}<div><strong>${esc(r.owner)}</strong><span>资源作者</span></div></a></section><section><h3>协作</h3><button class="btn full" data-action="propose">${icon("git-branch")}提出改进</button></section><section class="resource-management">${own && r.status !== "hidden" ? `<button class="btn full" data-resource-status="${r.status === "archived" ? "published" : "archived"}">${r.status === "archived" ? "重新发布资源" : "下架资源"}</button>` : ""}<button class="text-link" data-action="report">举报此资源</button></section></aside></div></div>`;
  }
  function guideContents(r) {
    if (state.tab !== "guide") return "";
    let inCode = false;
    const headings = String(r.readme || "")
      .split("\n")
      .filter((line) => {
        if (line.startsWith("```")) inCode = !inCode;
        return !inCode && /^## /.test(line);
      });
    if (!headings.length) return "";
    return `<nav class="guide-contents" aria-label="本页目录"><h2>本页目录</h2>${headings.map((line, index) => `<button data-section="guide-section-${index}">${esc(line.slice(3))}</button>`).join("")}</nav>`;
  }
  function guideView(r, own) {
    return `<div class="resource-toolbar"><span class="version-pill">${icon("git-branch")}v${r.version}<span>当前版本</span></span><div>${own ? '<button class="btn" data-action="edit">' + icon("file-code") + "编辑资源</button>" : ""}<button class="btn primary" data-practice="${r.id}">${icon("check-circle")}${state.practices.some((p) => p.resource_id === r.id) ? "继续实践" : "开始实践"}</button><button class="btn" data-action="download">${icon("download")}下载指南</button>${r.url ? `<a class="btn" href="${esc(r.url)}" target="_blank" rel="noopener">${icon("link-external")}${/\.zip$/i.test(r.url) ? "下载 Skill" : "打开资源"}</a>` : ""}</div></div>${practiceInline(r)}<div class="file-browser"><div class="last-change">${av(r.owner)}<strong>${esc(r.owner)}</strong><span>${esc(state.detail?.revisions?.[0]?.message || "发布资源")}</span><time>${date(r.updatedAt)}</time></div>${[
      ["readme", "使用指南", "适用场景与完整执行步骤"],
      ["checklist", "实践检查清单", "目标、步骤与结果记录"],
    ]
      .map(
        ([f, n, d]) =>
          `<button class="file-item" data-doc="${f}">${icon("file")}<strong>${n}</strong><span>${d}</span>${icon("chevron-right")}</button>`,
      )
      .join(
        "",
      )}</div><article class="readme-panel"><div class="readme-top">${icon("book")}使用指南<span></span><button class="icon-btn" data-action="download" aria-label="下载使用指南">${icon("download")}</button>${own ? `<button class="icon-btn" data-action="edit" aria-label="编辑使用指南">${icon("file-code")}</button>` : ""}</div><div class="readme-content">${evidencePanel(r)}<div class="markdown">${markdown(r.readme.replace(/^# [^\n]+\n/, ""), true)}</div></div></article>`;
  }
  function discussionView(r) {
    const a = state.detail?.discussions || [];
    return `<div class="section-heading"><div><h2>讨论</h2><p>提出问题，分享实践结果，记录还没有答案的发现。</p></div><button class="btn primary" data-action="new-discussion">${icon("plus")}发起讨论</button></div><div class="issue-list"><div class="issue-list-head">${icon("issue-opened")}${a.filter((d) => d.status === "open").length} 个进行中<span>${a.filter((d) => d.status === "closed").length} 个已解决</span></div>${a.length ? a.map((d) => `<details class="issue-item" ${state.openDiscussion === d.id ? "open" : ""}><summary>${icon(d.status === "open" ? "issue-opened" : "check-circle")}<div><strong>${esc(d.title)}</strong><span>${esc(d.author_name)} · ${date(d.created_at)} · ${d.status === "open" ? "进行中" : "已解决"}</span></div>${icon("chevron-down")}</summary><div class="issue-body"><div class="markdown">${markdown(d.body)}</div>${(d.replies || []).map((reply) => `<div class="discussion-reply"><div>${av(reply.author_name)}<strong>${esc(reply.author_name)}</strong><time>${date(reply.created_at)}</time></div><p>${esc(reply.body).replace(/\n/g, "<br>")}</p></div>`).join("")}<form class="reply-form" data-discussion-id="${d.id}"><label for="reply-${d.id}">添加回复</label><textarea id="reply-${d.id}" name="body" maxlength="5000" required placeholder="分享你的方法或补充背景…"></textarea><p class="form-error" role="alert"></p><button class="btn primary btn-sm" type="submit">发表回复</button></form>${d.author_id === state.user?.id || isOwn(r) ? `<button class="btn" data-discussion="${d.id}" data-status="${d.status === "open" ? "closed" : "open"}">${d.status === "open" ? "标记为已解决" : "重新打开讨论"}</button>` : ""}</div></details>`).join("") : empty("暂无讨论", "还没有讨论。可以先写下使用场景或实验中遇到的阻碍。", "new-discussion", "发起第一条讨论")}</div>`;
  }
  function proposalView(r) {
    const a = state.detail?.proposals || [];
    return `<div class="section-heading"><div><h2>改进建议</h2><p>先说明为什么改，再对比内容。由作者决定是否采纳。</p></div><button class="btn primary" data-action="propose">提出改进</button></div>${a.length ? a.map((p) => `<details class="proposal-item"><summary><span class="status-label ${p.status}">${icon(p.status === "merged" ? "check" : "git-branch")}${{ open: "待审查", merged: "已采纳", closed: "已关闭" }[p.status]}</span><div><strong>${esc(p.title)}</strong><span>${esc(p.author_name)} · 基于 v${p.base_version} · ${date(p.created_at)}</span></div>${icon("chevron-down")}</summary><div class="issue-body"><p>${esc(p.body)}</p><div class="diff-heading"><strong>文档变更</strong><span>原内容 → 建议内容</span></div>${diffView(state.detail?.revisions.find((v) => v.version === p.base_version)?.data.readme || r.readme, p.data.readme)}${p.status === "open" ? `<div class="review-actions">${isOwn(r) ? `<button class="btn primary" data-proposal="${p.id}" data-decision="merge">${icon("check")}采纳并发布新版本</button>` : '<span class="muted">等待资源作者审查</span>'}${isOwn(r) || p.author_id === state.user?.id ? `<button class="btn" data-proposal="${p.id}" data-decision="close">关闭建议</button>` : ""}</div>` : ""}</div></details>`).join("") : empty("暂无改进建议", "补充遗漏的步骤、适用条件或实践发现。原文在作者采纳前保持原样。", "propose", "提交第一条改进")}`;
  }
  function diffView(before, after) {
    const a = String(before).split("\n"),
      b = String(after).split("\n");
    let start = 0;
    while (start < Math.min(a.length, b.length) && a[start] === b[start])
      start++;
    let endA = a.length - 1,
      endB = b.length - 1;
    while (endA >= start && endB >= start && a[endA] === b[endB]) {
      endA--;
      endB--;
    }
    if (start === a.length && start === b.length)
      return '<div class="notice">文档内容没有变化。</div>';
    return `<div class="diff-block" aria-label="内容差异">${a
      .slice(Math.max(0, start - 2), start)
      .map((l) => `<div><i> </i>${esc(l) || " "}</div>`)
      .join("")}${a
      .slice(start, endA + 1)
      .map((l) => `<div class="removed"><i>−</i>${esc(l) || " "}</div>`)
      .join("")}${b
      .slice(start, endB + 1)
      .map((l) => `<div class="added"><i>+</i>${esc(l) || " "}</div>`)
      .join("")}${a
      .slice(endA + 1, endA + 3)
      .map((l) => `<div><i> </i>${esc(l) || " "}</div>`)
      .join("")}</div>`;
  }
  function historyView(r) {
    const a = state.detail?.revisions || [];
    return `<div class="section-heading"><div><h2>版本记录</h2><p>每次修改都留下记录，随时查看当时的完整内容。</p></div><span class="badge">当前 v${r.version}</span></div><div class="timeline">${a.length ? a.map((v) => `<article class="timeline-item"><span class="timeline-dot">${icon("git-branch")}</span><div><div class="timeline-title"><strong>${esc(v.message)}</strong><span class="badge">v${v.version}</span></div><p>${esc(v.author_name)} 更新于 ${new Date(v.created_at).toLocaleString("zh-CN")}</p><button class="btn btn-sm" data-version="${v.id}">查看此版本</button></div></article>`).join("") : `<article class="timeline-item"><span class="timeline-dot">${icon("git-branch")}</span><div><strong>暂无版本记录</strong></div></article>`}</div>`;
  }
  const outcomes = {
    pending: "尚未得出结论",
    untested: "尚未验证",
    improved: "观察到改善",
    "no-improvement": "未达预期",
    mixed: "结果不明确",
  };
  function evidencePanel(r) {
    return `<details class="evidence-panel"><summary><strong>实践依据与适用条件</strong><span class="badge">${outcomes[r.evidenceStatus] || "尚未验证"}</span>${icon("chevron-down")}</summary><dl><dt>时间与成本</dt><dd>${esc(r.effort || "未填写")}</dd><dt>结果依据</dt><dd>${esc(r.evidence || "未填写")}</dd><dt>适用边界</dt><dd>${esc(r.limits || "未填写")}</dd><dt>利益关系</dt><dd>${{ unspecified: "未填写", independent: "无商业关联", creator: "作者参与的项目 / 工具", sponsored: "包含赞助或推广关系" }[r.disclosure || "unspecified"]}</dd></dl></details>`;
  }
  function practiceInline(r) {
    const p = state.practices.find((p) => p.resource_id === r.id);
    return p
      ? `<div class="practice-inline"><span>${icon("check-circle")}${p.stage === "complete" ? "这次实践已复盘" : "你正在实践这个方法"} · ${p.visibility === "community" ? "已分享" : "仅自己可见"}</span><div><button data-practice="${r.id}" data-complete="true">${p.stage === "complete" ? "查看复盘" : "记录结果"}</button><a href="#practice">我的实践 ${icon("chevron-right")}</a></div></div>`
      : "";
  }
  function practiceCallout(r) {
    const p = state.practices.find((p) => p.resource_id === r.id);
    return `<section class="practice-callout"><h3>${p ? (p.stage === "complete" ? "回来看这次实践" : "继续你的实践") : "实践记录"}</h3><p>${p ? "基于 v" + p.resource_version + " · " + (p.visibility === "community" ? "已分享到社区" : "仅自己可见") : "记录默认仅自己可见。"}</p><button class="btn primary full" data-practice="${esc(r.id)}" ${p?.stage === "complete" ? 'data-complete="true"' : ""}>${icon("check-circle")}${p ? "打开实践记录" : "开始实践"}</button>${p?.stage === "running" ? `<button class="btn full" data-practice="${esc(r.id)}" data-complete="true">记录结果</button>` : ""}</section>`;
  }
  function renderPractices() {
    const running = state.practices.filter((p) => p.stage === "running"),
      done = state.practices.filter((p) => p.stage === "complete");
    return `<div class="practices-page"><div class="page-heading"><div><h1>我的实践</h1><p>把读过的方法，变成一次有起点、有结果的尝试。</p></div><a class="btn" href="#collections">选择话题</a></div><div class="practice-summary"><span>${icon("graph")}<strong>${running.length}</strong> 项正在实践</span><span>${icon("check-circle")}<strong>${done.length}</strong> 项已复盘</span><span>${icon("shield-check")}计划默认仅自己可见</span></div>${
      state.practices.length
        ? [
            ["正在实践", running],
            ["已经复盘", done],
          ]
            .map(([title, items]) =>
              items.length
                ? `<section class="practice-group"><h2>${title}</h2>${items
                    .map((p) => {
                      const r = repo(p.resource_id);
                      return `<article class="practice-row"><div><span class="overline">基于 v${p.resource_version} · ${p.visibility === "community" ? "已分享" : "仅自己可见"}</span><h3><a href="${href(p.resource_id)}">${esc(r?.title || "原资源")}</a></h3><p>${esc(p.data.metric)} · ${p.stage === "complete" ? esc(outcomes[p.data.outcome]) : "基线：" + esc(p.data.baseline)}</p><span class="muted">观察周期：${esc(p.data.timeframe)}</span>${p.data.nextStep ? `<p class="next-step">下一步：${esc(p.data.nextStep)}</p>` : ""}</div><div class="practice-row-actions"><button class="btn" data-practice="${p.resource_id}" ${p.stage === "complete" ? 'data-complete="true"' : ""}>${p.stage === "complete" ? "查看 / 编辑复盘" : "编辑计划"}</button>${p.stage === "running" ? `<button class="btn primary" data-practice="${p.resource_id}" data-complete="true">记录结果</button>` : ""}</div></article>`;
                    })
                    .join("")}</section>`
                : "",
            )
            .join("")
        : empty(
            "实践记录",
            "在资源详情中点击“开始实践”，记录计划与结果。",
            "routes",
            "选择一个增长问题",
          )
    }<p class="route-disclaimer">只有你主动勾选“分享到社区”的完整复盘，才会出现在资源的实践记录中。</p></div>`;
  }
  function reportsView(r) {
    const a = state.detail?.reports || [];
    return `<div class="section-heading"><div><h2>实践记录</h2><p>同一个方法，在不同条件下可能有不同结果。</p></div><button class="btn primary" data-practice="${r.id}">记录我的实践</button></div><div class="notice">实践结果由社区成员记录。</div>${a.length ? a.map((p) => `<article class="report-card"><div class="report-heading">${av(p.author_name)}<strong>${esc(p.author_name)}</strong><span class="outcome ${p.data.outcome}">${outcomes[p.data.outcome]}</span></div><p class="muted">基于资源 v${p.resource_version} · ${date(p.updated_at)}</p><dl><dt>场景</dt><dd>${esc(p.data.context)}</dd><dt>指标与基线</dt><dd>${esc(p.data.metric)} · ${esc(p.data.baseline)}</dd><dt>周期 / 样本</dt><dd>${esc(p.data.timeframe)}</dd><dt>实际结果</dt><dd>${esc(p.data.result)}</dd><dt>局限与干扰</dt><dd>${esc(p.data.limits)}</dd>${p.data.nextStep ? `<dt>下一步</dt><dd>${esc(p.data.nextStep)}</dd>` : ""}</dl></article>`).join("") : `<div class="empty-state">${icon("graph")}<h2>还没有人分享实践结果</h2><p>完成实践后，可在这里分享结果。</p></div>`}`;
  }
  function renderListing() {
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
    return `<div class="explore-layout">${sidebar()}<div class="explore-content"><div class="page-heading"><div>${personal ? `<div class="profile-heading">${av(name, "large")}<div><h1>${esc(title)}</h1><p>${state.route === "profile" ? esc(state.user?.bio || "") : ""}</p></div></div>` : `<h1>${title}</h1><p>${state.route === "stars" ? "" : state.route === "trending" ? "按已分享的实践记录数排序。记录包含成功与失败，不代表效果保证。" : ""}</p>`}</div>${state.route === "profile" ? '<a class="btn" href="#drafts">云端草稿</a><a class="btn" href="#settings">账户设置</a>' : ""}</div><div class="content-columns"><section class="resource-feed"><div class="feed-title"><h2>${personal ? "资源" : state.route === "stars" ? "已收藏" : "探索资源"}<span class="counter">${list.length}</span></h2>${state.route === "profile" ? '<button class="btn primary btn-sm" data-action="publish">新建资源</button>' : '<span class="muted"></span>'}</div>${filterBar()}${state.q || state.topic !== "all" || state.level !== "all" ? `<div class="filter-summary"><span>${state.q ? "“" + esc(state.q) + "” · " : ""}${state.topic !== "all" ? esc(state.topic) + " · " : ""}${list.length} 个结果</span><button data-action="clear-filters">${icon("x")}清除筛选</button></div>` : ""}<div class="resource-list">${list.length ? list.map(resourceRow).join("") : empty(state.route === "stars" ? "暂无收藏" : personal ? "暂无资源" : "没有找到匹配资源", state.q || state.type !== "all" || state.topic !== "all" || state.level !== "all" ? "试试其他关键词，或清除筛选条件。" : "分享一个方法、一次复盘，或保存一份值得实践的资源。", personal ? "publish" : "reset", personal ? "发布资源" : "浏览全部资源")}</div><div class="list-end">${list.length ? "已展示 " + list.length + " 个资源" : ""}</div></section></div>${state.route === "profile" ? `<a class="practice-profile-link" href="#practice">${icon("check-circle")}我的实践 · ${state.practices.length} 项，继续记录结果 ${icon("chevron-right")}</a>` : ""}</div></div>`;
  }
  return {
    renderLanding,
    renderListing,
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
    renderDiscovery,
    renderCollections,
    detailTabs,
    renderRepo,
    guideView,
    discussionView,
    proposalView,
    diffView,
    historyView,
    outcomes,
    evidencePanel,
    practiceInline,
    practiceCallout,
    renderPractices,
    reportsView,
    renderShell,
  };
}
