import { routeHash, cleanLinks } from "./routes.js";
export function authView(ctx, url) {
  const { state, esc, icon } = ctx;
  const params = () => new URLSearchParams(routeHash(url).split("?")[1] || "");
  const next = () => {
    const p = params().get("next");
    return p?.startsWith("#") && !p.startsWith("#login") ? p : "#explore";
  };
  const field = (id, label, type = "text", value = "", extra = "") =>
    `<div class="field"><label for="${id}">${label}</label><input id="${id}" name="${id}" type="${type}" value="${esc(value)}" ${extra}></div>`;
  const policies = () =>
    `<label class="accept-policy"><input name="accepted" type="checkbox" required><span>我已阅读并同意 <a href="#terms">社区约定</a> 和 <a href="#privacy">隐私说明</a></span></label>`;
  const authBrand = () =>
    `<a class="auth-brand" href="#home" aria-label="GrowthHub 首页"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><strong>GrowthHub</strong></a>`;
  const googleMark =
    '<svg class="google-mark" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M43.6 24.5c0-1.5-.1-2.9-.4-4.3H24v8.1h11a9.4 9.4 0 0 1-4.1 6.2v5.2h6.7c3.9-3.6 6-8.8 6-15.2Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.2c-1.8 1.2-4.1 1.9-6.8 1.9-5.3 0-9.7-3.6-11.3-8.4H5.8v5.3A20.4 20.4 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.7 27.4a12.2 12.2 0 0 1 0-7.8v-5.3H5.8a20 20 0 0 0 0 18.4l6.9-5.3Z"/><path fill="#EA4335" d="M24 11.2c3 0 5.6 1 7.7 3l5.8-5.8A19.4 19.4 0 0 0 24 4 20.4 20.4 0 0 0 5.8 15.3l6.9 5.3C14.3 15.8 18.7 11.2 24 11.2Z"/></svg>';
  const passwordField = (id, label, isNew) =>
    `<div class="field"><label for="${id}">${label}<span class="auth-required" aria-hidden="true">*</span></label><div class="password-control"><input id="${id}" name="${id}" type="password" required minlength="${isNew ? 6 : 1}" maxlength="128" autocomplete="${isNew ? "new-password" : "current-password"}" ${isNew ? 'pattern="(?=.*[A-Za-z])(?=.*[0-9]).{6,128}" title="密码需为 6–128 位，包含字母和数字" aria-describedby="password-hint"' : ""} placeholder="${isNew ? "设置你的密码" : "输入密码"}"><button class="password-toggle" type="button" data-action="toggle-password" data-target="${id}" aria-label="显示${label}" aria-pressed="false" aria-controls="${id}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path class="eye-slash" d="M3 3l18 18"/></svg></button></div>${isNew && id === "password" ? '<p id="password-hint" class="field-hint">至少 6 位，包含字母和数字。</p>' : ""}</div>`;
  function authPage() {
    const mode = state.route,
      signup = mode === "signup",
      recover = mode === "recover",
      reset = mode === "reset-password",
      verify = mode === "verify",
      ready = state.auth?.ready;
    const title = signup
      ? "加入 GrowthHub"
      : recover
        ? "重置你的密码"
        : reset
          ? "设置新的密码"
          : verify
            ? "查看你的收件箱"
            : "登录 GrowthHub";
    const subtitle = signup
      ? ""
      : recover
        ? "输入注册邮箱，我们会发送密码重置链接。"
        : reset
          ? "设置一个与其他网站不同的新密码。"
          : verify
            ? "请在当前浏览器打开邮件中的链接，完成验证。"
            : "";
    const redirect = encodeURIComponent(next()),
      recovery = params().get("mode") === "recover";
    const googleEnabled = state.auth?.providers?.includes("google");
    const switchLink = signup
      ? `<span>已有账户？</span><a href="#login?next=${redirect}">登录 ${icon("chevron-right")}</a>`
      : !recover && !reset && !verify
        ? `<span>第一次来？</span><a href="#signup?next=${redirect}">创建账户 ${icon("chevron-right")}</a>`
        : `<a href="#login">返回登录 ${icon("chevron-right")}</a>`;

    return `<div class="auth-layout auth-v2">
   <header class="auth-topbar">${authBrand()}<div class="auth-switch">${switchLink}</div></header>
   <aside class="auth-story"><div class="auth-story-copy"><h2 class="auth-story-title">增长方法与<br>实战经验</h2><p>发现和分享增长 Skills、实战心得与开源工具。</p><nav class="auth-categories" aria-label="浏览资源"><a href="#explore?type=skill">增长方法 ${icon("chevron-right")}</a><a href="#explore?type=experience">实战心得 ${icon("chevron-right")}</a><a href="#explore?type=tool">开源工具 ${icon("chevron-right")}</a></nav></div></aside>
   <section class="auth-panel" aria-labelledby="auth-heading">
    <div class="auth-form-wrap">
     <h1 id="auth-heading">${title}</h1>${subtitle ? `<p class="auth-subtitle">${subtitle}</p>` : ""}
     ${
       verify
         ? `<div class="auth-message">${icon("mail")}<div><strong>${recovery ? "密码重置邮件已请求发送" : "下一步，验证你的邮箱"}</strong><p>邮件可能需要几分钟。请同时检查垃圾邮件；链接过期后可重新发送。</p></div></div><form id="resend-form" data-recovery="${recovery}">${field("email", "注册邮箱", "email", "", 'required autocomplete="email" inputmode="email" placeholder="you@company.com"')}<p class="form-error" role="alert"></p><button class="btn primary full" type="submit" ${!ready ? "disabled" : ""}>重新发送验证邮件</button></form><a class="auth-bottom" href="#login">返回登录</a>`
         : `
      ${!recover && !reset && googleEnabled ? `<div class="social-auth"><a class="btn google-auth" href="/api/auth/oauth?provider=google&next=${redirect}" target="_top">${googleMark}<span>使用 Google 继续</span></a></div><div class="auth-divider"><span>或使用邮箱</span></div>` : ""}
      ${!ready ? '<div class="notice">邮箱登录暂未开通，你可以先浏览社区。</div>' : ""}
      <form id="auth-form" data-mode="${mode}">
       ${!reset ? field("email", '邮箱地址<span class="auth-required" aria-hidden="true">*</span>', "email", "", 'required autocomplete="email" inputmode="email" autocapitalize="none" spellcheck="false" maxlength="254" placeholder="you@company.com"') : ""}
       ${!recover ? passwordField("password", reset ? "新密码" : "密码", signup || reset) : ""}
       ${reset ? passwordField("confirm-password", "确认新密码", true) : ""}
       ${signup ? policies() : ""}
       ${!signup && !recover && !reset ? '<a class="forgot-link" href="#recover">忘记密码？</a>' : ""}
       <p class="form-error" role="alert">${params().get("error") === "expired" ? "登录已过期，请重新登录。本机草稿已保留。" : params().has("error") ? "验证链接已失效或登录被取消，请重新尝试。" : ""}</p>
       <button class="btn primary full auth-submit" type="submit" ${!ready ? "disabled" : ""}><span>${signup ? "创建账户" : recover ? "发送重置链接" : reset ? "保存新密码" : "登录"}</span>${icon("chevron-right")}</button>
      </form>
      ${signup ? `<p class="auth-invite-note">仅限已获邀请的邮箱。<a href="#explore">浏览社区</a></p>` : recover || reset ? '<a class="auth-bottom" href="#login">返回登录</a>' : ""}
     `
     }
    </div>
   </section>
   <footer class="auth-page-footer"><div class="auth-story-foot"><span>© 2026 GrowthHub</span></div><nav class="auth-footer" aria-label="社区信息"><a href="#explore">探索社区</a><span aria-hidden="true">·</span><a href="#terms">社区约定</a><span aria-hidden="true">·</span><a href="#privacy">隐私说明</a></nav></footer>
  </div>`;
  }
  return cleanLinks(authPage());
}
