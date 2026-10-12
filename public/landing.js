// Minimal public entry; discovery and authentication have dedicated pages.
export function landingShell(content, icon) {
  return `<div class="landing-shell">
    <header class="landing-header">
      <a class="brand" href="#home" aria-label="GrowthHub 首页"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><strong>GrowthHub</strong></a>
      <nav class="landing-nav" aria-label="社区导航"><a href="#explore">发现</a><a href="#collections">话题</a><a href="#trending">实践榜</a></nav>
      <div class="landing-account"><a href="#login">登录</a><a class="landing-button landing-button-small" href="#signup">注册 ${icon("chevron-right")}</a></div>
    </header>
    <main id="main" tabindex="-1">${content}</main>
    <footer class="landing-footer"><a class="landing-wordmark" href="#home">GrowthHub</a><span>© 2026 GrowthHub</span><nav aria-label="社区信息"><a href="#terms">社区约定</a><a href="#privacy">隐私说明</a></nav></footer>
  </div>`;
}

export function landingContent({ icon }) {
  return `<section class="landing-hero" aria-labelledby="landing-title">
    <div class="landing-hero-copy"><h1 id="landing-title"><span class="landing-title-lead">和同行一起</span><span class="landing-title-main">做增长</span></h1><div class="landing-actions"><a class="landing-button" href="#signup">注册 GrowthHub ${icon("chevron-right")}</a><a class="landing-button landing-button-secondary" href="#explore">浏览社区 ${icon("chevron-right")}</a></div></div>
    <div class="landing-connections" aria-hidden="true"><svg viewBox="0 0 640 210" fill="none"><path d="M50 136H192Q250 136 250 82V70Q250 36 292 36H355Q395 36 395 79V94Q395 136 450 136H590"/><path class="connection-return" d="M185 136Q230 136 230 182H456Q500 182 500 136"/></svg><span class="connection-node connection-book">${icon("book")}</span><span class="connection-node connection-practice">${icon("check-circle")}</span><span class="connection-node connection-fork">${icon("git-branch")}</span></div>
  </section>`;
}
