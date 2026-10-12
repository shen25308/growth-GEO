// A public entrance built from the same published records as discovery.
export function landingShell(content, icon) {
  return `<div class="landing-shell">
    <header class="landing-header">
      <a class="brand" href="#home" aria-label="GrowthHub 首页"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><strong>GrowthHub</strong></a>
      <nav class="landing-nav" aria-label="社区导航"><a href="#explore">发现</a><a href="#collections">话题</a><a href="#trending">实践榜</a></nav>
      <div class="landing-account"><a href="#login">登录</a><a class="landing-button landing-button-small" href="#signup">加入社区 ${icon("chevron-right")}</a></div>
    </header>
    <main id="main" tabindex="-1">${content}</main>
    <footer class="landing-footer"><a class="landing-wordmark" href="#home">GrowthHub</a><span>© 2026 GrowthHub</span><nav aria-label="社区信息"><a href="#terms">社区约定</a><a href="#privacy">隐私说明</a></nav></footer>
  </div>`;
}

export function landingContent(state, { esc, icon, href, types, date }) {
  const featured = state.resources
    .filter((r) => !r.status || r.status === "published")
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
  const topics = [
    "GEO",
    "SEO",
    "AI 自动化",
    "用户获取",
    "内容增长",
    "产品增长",
  ];
  return `<section class="landing-hero" aria-labelledby="landing-title">
    <div class="landing-hero-copy"><h1 id="landing-title">增长从业者的<br><span>开放资源库</span></h1><p class="landing-description">发现和分享增长 Skills、实战心得与开源工具。</p><div class="landing-actions"><a class="landing-button" href="#explore">探索社区 ${icon("chevron-right")}</a><a class="landing-text-link" href="#signup">发布资源 ${icon("plus")}</a></div></div>
    <section class="landing-library" aria-label="社区最新资源">
      <div class="landing-library-bar"><h2>${icon("book")}社区资源</h2><a href="#explore?type=all">查看全部 ${icon("chevron-right")}</a></div>
      ${
        featured
          ? `<article class="landing-featured">
        <div class="landing-featured-main">
          <div class="landing-resource-meta"><span class="landing-resource-kind">${icon(featured.type === "tool" ? "code" : "file")} ${esc(types[featured.type] || "社区资源")}</span>${featured.topic ? `<a href="#explore?type=all&topic=${encodeURIComponent(featured.topic)}">${esc(featured.topic)}</a>` : ""}</div>
          <h3><a href="${href(featured.id)}">${esc(featured.title)}</a></h3>
          <p class="landing-resource-description">${esc(featured.desc)}</p>
          <div class="landing-resource-byline"><a href="#author/${encodeURIComponent(featured.ownerId || featured.owner)}"><span class="landing-avatar" aria-hidden="true">${esc((featured.owner || "G").slice(0, 1).toUpperCase())}</span>${esc(featured.owner)}</a>${featured.updatedAt ? `<span>${date(featured.updatedAt)} 更新</span>` : ""}</div>
        </div>
        <div class="landing-resource-entry"><div class="landing-entry-symbol" aria-hidden="true">${icon(featured.type === "tool" ? "repo" : "book")}</div><a class="landing-resource-open" href="${href(featured.id)}">查看完整资源 ${icon("chevron-right")}</a><a class="landing-resource-discuss" href="${href(featured.id)}?tab=discussions">${icon("comment-discussion")}参与讨论</a></div>
      </article>`
          : `<div class="landing-first-contribution"><h3>社区资源库</h3><p>分享你的增长方法、实践记录或工具。</p><a class="landing-button" href="#signup">发布第一份资源 ${icon("plus")}</a></div>`
      }
    </section>
  </section>
  <nav class="landing-topics" aria-label="按增长问题探索"><span>探索话题</span><div>${topics.map((topic) => `<a href="#explore?type=all&topic=${encodeURIComponent(topic)}">${esc(topic)} ${icon("chevron-right")}</a>`).join("")}</div></nav>`;
}
