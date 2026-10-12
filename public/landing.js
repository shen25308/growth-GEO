// Public brand introduction; published contributions live in discovery.
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
  const capabilities = [
    [
      "book",
      "发现可复用的方法",
      "按话题寻找增长 Skills、实战心得和工具。查看具体步骤、适用条件，再决定是否用到自己的项目中。",
      "#explore",
      "发现社区内容",
    ],
    [
      "check-circle",
      "记录自己的实践",
      "发布方法和项目复盘，也可以在已有内容下记录尝试的过程与结果，让后来的人了解什么有效、哪里需要调整。",
      "#signup",
      "注册并参与",
    ],
    [
      "git-branch",
      "参与讨论与改进",
      "向作者提问，补充遗漏的步骤，提出改进建议。作者采纳后会形成新版本，原有的内容与修改记录都可以查阅。",
      "#explore?type=all",
      "寻找感兴趣的内容",
    ],
  ];
  return `<section class="landing-hero" aria-labelledby="landing-title">
    <div class="landing-hero-top"><div class="landing-hero-copy"><h1 id="landing-title">和同行一起<br><span>研究增长</span></h1><p class="landing-description">GrowthHub 是一个围绕增长实践的社区。<br>分享 Skills、复盘项目、交流方法，也参与开源工具的改进。</p><div class="landing-actions"><a class="landing-button" href="#signup">加入 GrowthHub ${icon("chevron-right")}</a><a class="landing-text-link" href="#explore">先逛逛社区 ${icon("chevron-right")}</a></div></div>
    <figure class="landing-artwork"><img src="/cover-community.jpg" alt="" width="900" height="600" decoding="async" fetchpriority="high"></figure></div>
    <section class="landing-introduction" aria-labelledby="landing-introduction-title">
      <div class="landing-introduction-bar"><h2 id="landing-introduction-title">在 GrowthHub</h2><a href="#explore">探索社区 ${icon("chevron-right")}</a></div>
      <div class="landing-introduction-body">
        <div class="landing-capabilities">${capabilities.map(([symbol, title, description, url, label], i) => `<details class="landing-capability" name="community-capability"${i === 0 ? " open" : ""}><summary><span class="landing-capability-icon" aria-hidden="true">${icon(symbol)}</span><h3>${title}</h3><span class="landing-capability-toggle" aria-hidden="true">${icon("plus")}</span></summary><div class="landing-capability-content"><p>${description}</p><a href="${url}">${label} ${icon("chevron-right")}</a></div></details>`).join("")}</div>
        <nav class="landing-formats" aria-label="社区内容类型"><a href="#explore?type=skill"><span>${icon("file-code")}<strong>增长 Skills</strong></span>${icon("chevron-right")}<p>可复用的方法与执行步骤</p></a><a href="#explore?type=experience"><span>${icon("comment-discussion")}<strong>实战心得</strong></span>${icon("chevron-right")}<p>项目过程、结果与复盘</p></a><a href="#explore?type=tool"><span>${icon("code")}<strong>开源工具</strong></span>${icon("chevron-right")}<p>支持增长工作的产品与工具</p></a></nav>
      </div>
    </section>
    <p class="landing-access-note">公开内容可以直接浏览，登录后可收藏、发布并参与讨论。</p>
  </section>`;
}
