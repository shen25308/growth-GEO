// Original brand entrance. Real community records remain public and server-rendered.
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

export function landingContent(
  state,
  { esc, icon, href, resourceCover, types },
) {
  const featured = state.resources
    .filter((r) => !r.status || r.status === "published")
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
  return `<section class="landing-hero" aria-labelledby="landing-title">
    <div class="landing-hero-art" data-tilt aria-hidden="true"><picture><source media="(max-width: 640px)" srcset="/growth-cover-mobile-v1.jpg"><img src="/growth-cover-v1.jpg" width="1254" height="1254" fetchpriority="high" alt=""></picture></div>
    <div class="landing-hero-copy"><p class="landing-intro">增长实践者的开放社区</p><h1 id="landing-title">增长，<br>从分享开始。</h1><p class="landing-description">发现增长 Skills、实战经验与开源工具。<br>和同行一起，把好方法做得更好。</p><div class="landing-actions"><a class="landing-button" href="#explore">探索社区 ${icon("chevron-right")}</a><a class="landing-text-link" href="#signup">分享我的方法 ${icon("plus")}</a></div></div>
  </section>
  <nav class="landing-topics" aria-label="按增长问题探索">${["GEO", "SEO", "AI 自动化", "用户获取", "内容增长", "产品增长"].map((topic) => `<a href="#explore?type=all&topic=${encodeURIComponent(topic)}">${esc(topic)} ${icon("chevron-right")}</a>`).join("")}</nav>
  <section class="landing-community" aria-labelledby="landing-community-title"><div class="landing-section-heading"><h2 id="landing-community-title">好方法，值得被看见。</h2><p>从一份可以上手的资源，开始下一次实践。</p></div>
    ${featured ? `<article class="landing-featured"><a class="landing-featured-art" href="${href(featured.id)}" aria-label="查看 ${esc(featured.title)}">${resourceCover(featured)}</a><div class="landing-featured-copy"><div class="landing-resource-meta"><span>${esc(featured.topic)}</span><span>${types[featured.type] || "社区资源"}</span></div><h3><a href="${href(featured.id)}">${esc(featured.title)}</a></h3><p>${esc(featured.desc)}</p><div class="landing-resource-footer"><a href="#author/${encodeURIComponent(featured.ownerId)}">${esc(featured.owner)}</a><a class="landing-text-link" href="${href(featured.id)}">查看资源 ${icon("chevron-right")}</a></div></div></article>` : `<div class="landing-first-contribution"><h3>把你的实践，变成同行的起点。</h3><a class="landing-button" href="#signup">发布第一份资源 ${icon("plus")}</a></div>`}
  </section>`;
}
