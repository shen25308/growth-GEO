import { authView } from "./auth-view.js";
import { routeHash, cleanLinks } from "./routes.js";
export function createCommunity(ctx) {
  const {
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
  } = ctx;
  const $ = (s) => document.querySelector(s);
  const privatePages = [
    "profile",
    "stars",
    "practice",
    "settings",
    "drafts",
    "inbox",
    "admin",
  ];
  let adminData = null,
    drafts = [],
    viewToken = 0;
  const params = () => new URLSearchParams(routeHash().split("?")[1] || "");
  const next = () => {
    const p = params().get("next");
    return p?.startsWith("#") && !p.startsWith("#login") ? p : "#explore";
  };
  const field = (id, label, type = "text", value = "", extra = "") =>
    `<div class="field"><label for="${id}">${label}</label><input id="${id}" name="${id}" type="${type}" value="${esc(value)}" ${extra}></div>`;
  const policies = () =>
    `<label class="accept-policy"><input name="accepted" type="checkbox" required><span>我已阅读并同意 <a href="#terms">社区约定</a> 和 <a href="#privacy">隐私说明</a></span></label>`;
  function gate() {
    if (!state.user) {
      go("#login?next=" + encodeURIComponent(routeHash() || "#explore"));
      return false;
    }
    if (!state.user.member) {
      go("#settings");
      return false;
    }
    if (!state.user.onboarded) {
      go("#onboarding?next=" + encodeURIComponent(routeHash()));
      return false;
    }
    return true;
  }

  function authPage() {
    $("#main").innerHTML = authView(ctx, new URL(location.href));
    document.title = $("#auth-heading").textContent + " · GrowthHub";
  }
  function accountFrame(title, subtitle, body) {
    return `<div class="account-layout"><aside class="account-sidebar"><div class="account-person">${av(state.user?.name || "GH", "large")}<strong>${esc(state.user?.name || "访客")}</strong><span>${state.user?.admin ? "社区管理员" : "增长实践者"}</span></div><nav aria-label="账户导航">${[["profile", "repo", "我的资源"], ["drafts", "file", "云端草稿"], ["inbox", "comment-discussion", "消息通知"], ["settings", "person", "账户设置"], ...(state.user?.admin ? [["admin", "shield-check", "社区管理"]] : [])].map(([p, i, label]) => `<a href="#${p}" ${state.route === p ? 'aria-current="page"' : ""}>${icon(i)}${label}</a>`).join("")}</nav><button data-action="logout" class="btn full">退出登录</button></aside><section class="account-content"><header><h1>${title}</h1><p>${subtitle}</p></header>${body}</section></div>`;
  }
  function settingsPage() {
    const u = state.user;
    if (!u) {
      authPage();
      return;
    }
    $("#main").innerHTML = accountFrame(
      "账户设置",
      "你的公开资料与账户偏好。",
      `${!u.member ? '<div class="notice">你已完成登录，但当前邮箱尚未获得社区邀请。请让邀请你的管理员为这个邮箱开通试用资格。</div>' : ""}<section class="settings-card"><h2>公开资料</h2><p>名称和介绍会显示在你发布的资源旁。邮箱只用于账户识别。</p><form id="account-profile">${field("name", "显示名称", "text", u.name, 'required maxlength="50" autocomplete="nickname"')}<div class="field"><label for="bio">个人介绍</label><textarea id="bio" name="bio" maxlength="200" placeholder="你在研究什么增长问题？">${esc(u.bio || "")}</textarea></div>${!u.onboarded ? policies() : ""}<p class="form-error" role="alert"></p><button class="btn primary" type="submit" ${!u.member ? "disabled" : ""}>保存资料</button></form></section><section class="settings-card"><h2>登录与账户</h2><div class="settings-line"><span>当前邮箱</span><strong>${esc(u.email || "当前账户未提供邮箱")}</strong></div><div class="settings-line"><span>登录方式</span><strong>邮箱 / Google</strong></div>${u.provider === "supabase" ? '<a class="btn" href="#recover">通过邮箱重置密码</a>' : ""}</section><section class="settings-card"><h2>你的内容与隐私</h2><p>发布的资源和讨论可以公开浏览；草稿与未分享的实践记录仅自己可见。你可以下架自己的资源、撤回公开复盘，也可以下载账户内容。</p><button class="btn" data-action="export-account">${icon("download")}下载账户内容</button><a class="text-link" href="#privacy">查看隐私说明</a></section>`,
    );
  }
  function onboarding() {
    $("#main").innerHTML =
      `<div class="onboarding-page"><span class="eyebrow">欢迎加入 · 01 / 01</span><h1>完善资料。</h1><p>不需要技术背景。分享你擅长的事，或正在探索的问题。</p><form id="account-profile" data-onboarding="true">${field("name", "大家怎么称呼你？", "text", state.user?.name || "", 'required maxlength="50" autocomplete="nickname"')}<div class="field"><label for="bio">你正在关注什么？<small>选填</small></label><textarea id="bio" name="bio" maxlength="200" placeholder="例如：负责 SaaS 内容增长，最近在尝试 GEO。"></textarea></div>${policies()}<p class="form-error" role="alert"></p><button class="btn primary full" type="submit">完成设置，开始探索 ${icon("chevron-right")}</button></form></div>`;
  }
  async function remotePage(kind) {
    const token = ++viewToken;
    $("#main").innerHTML = accountFrame(
      { drafts: "云端草稿", inbox: "消息通知", admin: "社区管理" }[kind],
      {
        drafts: "先把想法留下，准备好再与社区分享。",
        inbox: "与你的资源和讨论有关的更新。",
        admin: "邀请合适的人，维护有价值的内容。",
      }[kind],
      '<div class="settings-card" role="status">正在加载…</div>',
    );
    try {
      const data = await api(kind === "inbox" ? "notifications" : kind);
      if (token !== viewToken || state.route !== kind || !state.user) return;
      let body = "";
      if (kind === "drafts") {
        drafts = data.drafts;
        body = `<div class="workspace-toolbar"><span>${drafts.length} 份草稿 · 仅自己可见</span><button class="btn primary" data-action="publish">新建资源</button></div>${drafts.length ? drafts.map((d) => `<article class="workspace-row"><div><span class="eyebrow">${d.data.mode === "edit" ? "编辑中的资源" : d.data.mode === "proposal" ? "改进建议" : "未发布"}</span><h2>${esc(d.data.title || "未命名草稿")}</h2><p>${esc(d.data.desc || "还没有简介")}</p><span class="muted">${new Date(d.updated_at).toLocaleString("zh-CN")} 保存 · v${d.version}</span></div><div class="workspace-actions"><button class="btn" data-resume-draft="${esc(d.id)}">继续编辑</button><button class="quiet-danger" data-delete-draft="${esc(d.id)}">删除</button></div></article>`).join("") : '<div class="account-empty"><h2>暂无草稿</h2><p>在编辑器点击“保存云端草稿”，就能换一台设备继续写。</p><button class="btn primary" data-action="publish">开始写作</button></div>'}`;
      }
      if (kind === "inbox")
        body = `<div class="workspace-toolbar"><span>${data.notifications.filter((n) => !n.read_at).length} 条未读</span><button class="btn" data-action="read-notifications">全部标为已读</button></div>${data.notifications.length ? data.notifications.map((n) => `<a class="notification-row ${n.read_at ? "" : "unread"}" href="${href(n.resource_id)}"><span>${icon("comment-discussion")}</span><div><strong>${esc(n.message)}</strong><p>${new Date(n.created_at).toLocaleString("zh-CN")}</p></div>${icon("chevron-right")}</a>`).join("") : '<div class="account-empty"><h2>暂时没有新消息</h2><p>收到讨论、回复、改进建议和审核结果时，会出现在这里。</p></div>'}`;
      if (kind === "admin") {
        adminData = data;
        body = `<div class="admin-stats"><div><strong>${data.invitations.filter((i) => i.active).length}</strong><span>有效邀请</span></div><div><strong>${data.flags.filter((f) => f.status === "open").length}</strong><span>待处理举报</span></div><div><strong>${data.hidden.length}</strong><span>已隐藏资源</span></div></div><section class="settings-card"><h2>邀请试用成员</h2><p>输入对方将用于登录的邮箱。这里只开通资格，不会自动发送邀请邮件。</p><form id="invitation-form" class="invite-form">${field("email", "成员邮箱", "email", "", 'required maxlength="254" placeholder="teammate@company.com"')}<button class="btn primary" type="submit">开通邀请</button><p class="form-error" role="alert"></p></form>${data.invitations.map((i) => `<div class="invitation-row"><span>${esc(i.email)}<small>${i.active ? "已开通" : "已撤销"}</small></span><button class="btn btn-sm" data-invitation="${esc(i.email)}" data-active="${!i.active}">${i.active ? "撤销资格" : "重新开通"}</button></div>`).join("")}</section><section class="settings-card"><h2>举报处理</h2>${data.flags.length ? data.flags.map((f) => `<article class="moderation-row"><div><a href="${href(f.resource_id)}">查看被举报的资源 ${icon("chevron-right")}</a><p>${esc(f.reason)}</p><small>${new Date(f.created_at).toLocaleString("zh-CN")} · ${f.status === "open" ? "待处理" : "已处理：" + esc(f.resolution)}</small></div>${f.status === "open" ? `<button class="btn" data-moderate="${f.id}">处理举报</button>` : ""}</article>`).join("") : '<p class="muted">目前没有举报。</p>'}</section><section class="settings-card"><h2>已隐藏的资源</h2>${data.hidden.map((r) => `<div class="moderation-row"><a href="${href(r.id)}">${esc(r.title)}</a><button class="btn" data-restore="${r.id}">解除限制</button></div>`).join("") || '<p class="muted">没有被隐藏的资源。</p>'}</section><details class="settings-card"><summary>最近的管理记录</summary>${data.audit.map((a) => `<p class="audit-entry"><strong>${esc({ invite: "开通邀请", "revoke-invite": "撤销邀请", hide: "隐藏内容", restore: "解除限制", dismiss: "驳回举报", published: "发布资源", archived: "下架资源" }[a.action] || a.action)}</strong> ${esc(a.target)}<br><small>${new Date(a.created_at).toLocaleString("zh-CN")} · ${esc(a.detail)}</small></p>`).join("") || "<p>暂无记录。</p>"}</details>`;
      }
      $(".account-content").insertAdjacentHTML("beforeend", body);
      $(".account-content>.settings-card[role=status]").remove();
    } catch (e) {
      if (
        token !== viewToken ||
        state.route !== kind ||
        !$(".account-content>.settings-card")
      )
        return;
      $(".account-content>.settings-card").innerHTML =
        `<p role="alert">${esc(e.message)}</p><button class="btn" data-action="retry-account">重试</button>`;
    }
  }
  function policyPage() {
    const privacy = state.route === "privacy";
    $("#main").innerHTML =
      `<article class="policy-page markdown"><a href="#explore">返回社区</a><h1>${privacy ? "隐私说明" : "社区约定"}</h1><p>邀请试用版 · 2026 年 10 月 8 日</p>${privacy ? `<h2>我们保存什么</h2><p>为了提供社区服务，保存公开资料、资源、版本、讨论、收藏、草稿、实践记录、举报和管理操作记录。身份服务负责验证邮箱和社交账户，GrowthHub 不保存你的密码。</p><h2>谁可以看见</h2><p>公开资源、作者名称、讨论和主动分享的完整复盘可被访客浏览。云端草稿、收藏列表和未分享的实践记录仅账户本人可访问。举报内容与邀请邮箱仅管理员可查看。</p><h2>你可以怎样管理</h2><p>可在账户设置修改公开资料、导出本人内容；在资源页下架自己的资源；将已分享的复盘改回私有。删除云端草稿后，其他设备不会再加载它。本机未同步的草稿会在退出时清理。</p><h2>账户与登录</h2><p>登录使用安全会话 Cookie；本机草稿按账户区分。邮箱和 Google 登录由 Supabase Auth 验证。网站不会将密码或会话令牌写入浏览器本地存储。</p><h2>试用期间的处理渠道</h2><p>内容违规可通过资源页举报。账户删除、个人信息更正或其他隐私请求，请联系邀请你的社区管理员。资源下架不会自动删除历史版本或其他成员已创建的副本，管理员需要根据具体请求处理。</p>` : `<h2>分享可执行的经验</h2><p>说明业务场景、具体步骤、投入、结果依据和适用边界。未验证的想法应明确标注；失败和不明确的结果同样有价值。</p><h2>保留来源与授权</h2><p>只发布你有权分享的内容，保留原作者和引用来源。保存副本会保留派生关系。贡献内容的权利仍属于原权利人；任何站外再利用应确认相应授权。</p><h2>尊重隐私与彼此</h2><p>不要上传客户隐私、账号凭据、商业机密或未经许可的数据。不骚扰、不刷量、不发布无关广告；介绍自有产品或赞助关系时明确说明。</p><h2>共同维护社区</h2><p>资源作者可编辑与下架内容，管理员可处理举报并隐藏违规内容，处理结果会保留记录。不同意见可以通过讨论或改进建议提出。</p><h2>对结果保持诚实</h2><p>收藏数量不是效果背书。社区内容用于交流与实践参考，不能保证在不同业务中得到相同结果。</p>`}</article>`;
  }
  function render() {
    ++viewToken;
    if (
      ["login", "signup", "recover", "reset-password", "verify"].includes(
        state.route,
      )
    ) {
      authPage();
      return true;
    }
    if (["terms", "privacy"].includes(state.route)) {
      policyPage();
      return true;
    }
    if (privatePages.includes(state.route) || state.route === "onboarding") {
      if (!state.user) {
        $("#main").innerHTML =
          `<div class="account-empty"><span class="eyebrow">你的增长工作台</span><h1>登录后，继续你的实践。</h1><p>收藏、草稿与实践记录会保存在你的账户中。</p><a class="btn primary" href="#login?next=${encodeURIComponent(routeHash())}">登录 / 创建账户</a><a class="text-link" href="#explore">先浏览公开资源</a></div>`;
        return true;
      }
      if (!state.user.member) {
        settingsPage();
        return true;
      }
      if (state.route === "onboarding" || !state.user.onboarded) {
        onboarding();
        return true;
      }
    }
    if (state.route === "settings") {
      settingsPage();
      return true;
    }
    if (["drafts", "inbox", "admin"].includes(state.route)) {
      remotePage(state.route);
      return true;
    }
    return false;
  }
  async function click(button) {
    const a = button.dataset.action;
    if (a === "toggle-password") {
      const input = document.getElementById(button.dataset.target);
      if (input) {
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        button.setAttribute("aria-pressed", String(show));
        button.setAttribute(
          "aria-label",
          (show ? "隐藏" : "显示") +
            (input.id === "confirm-password"
              ? "确认新密码"
              : state.route === "reset-password"
                ? "新密码"
                : "密码"),
        );
      }
      return true;
    }
    if (a === "login") {
      go("#login?next=" + encodeURIComponent(routeHash()));
      return true;
    }
    if (a === "account-menu") {
      openModal(
        "我的账户",
        `<div class="dialog-body account-menu"><p>${esc(state.user?.name)} <small>${esc(state.user?.email || "")}</small></p>${[["profile", "我的资源"], ["drafts", "云端草稿"], ["inbox", "消息通知"], ["settings", "账户设置"], ...(state.user?.admin ? [["admin", "社区管理"]] : [])].map(([p, label]) => `<a href="#${p}">${label}${icon("chevron-right")}</a>`).join("")}<button class="btn" data-action="logout">退出登录</button></div>`,
      );
      return true;
    }
    if (a === "logout") {
      button.disabled = true;
      button.textContent = "正在退出…";
      try {
        await api("auth/logout", "POST", {});
        ctx.finishLogout();
      } catch (e) {
        toast(e.message);
        button.disabled = false;
        button.textContent = "退出登录";
      }
      return true;
    }
    if (a === "retry-account") {
      render();
      return true;
    }
    if (a === "export-account") {
      button.disabled = true;
      try {
        download(
          "GrowthHub-我的内容.json",
          JSON.stringify(await api("account/export"), null, 2),
          "application/json",
        );
        toast("账户内容已下载");
      } catch (e) {
        toast(e.message);
      }
      button.disabled = false;
      return true;
    }
    if (a === "read-notifications") {
      await api("notifications", "PUT", {});
      remotePage("inbox");
      return true;
    }
    if (button.dataset.resumeDraft) {
      const d = drafts.find((d) => d.id === button.dataset.resumeDraft);
      await resumeDraft(d);
      return true;
    }
    if (button.dataset.deleteDraft) {
      openModal(
        "删除这份草稿？",
        `<div class="dialog-body"><p>只删除这份云端草稿，不影响已发布的资源。此操作无法撤销。</p><p class="form-error" role="alert"></p></div>`,
        `<button class="btn" data-action="close">保留草稿</button><button class="btn danger" data-confirm-delete="${esc(button.dataset.deleteDraft)}">删除草稿</button>`,
      );
      return true;
    }
    if (button.dataset.confirmDelete) {
      await api("drafts/" + button.dataset.confirmDelete, "DELETE", {});
      closeModal();
      remotePage("drafts");
      toast("云端草稿已删除");
      return true;
    }
    if (a === "report") {
      if (!gate()) return true;
      openModal(
        "举报资源",
        `<form id="report-form"><div class="dialog-body"><p>请说明侵权、隐私泄露、误导宣传或其他具体问题。举报仅管理员可见。</p><div class="field"><label for="reason">举报原因与相关位置</label><textarea id="reason" name="reason" maxlength="2000" required placeholder="请提供可以核查的信息，例如具体段落或讨论标题。"></textarea></div><p class="form-error" role="alert"></p></div><div class="dialog-footer"><button class="btn" type="button" data-action="close">取消</button><button class="btn primary" type="submit">提交举报</button></div></form>`,
      );
      return true;
    }
    if (button.dataset.resourceStatus) {
      openModal(
        button.dataset.resourceStatus === "archived"
          ? "下架这个资源？"
          : "重新发布资源？",
        `<div class="dialog-body"><p>${button.dataset.resourceStatus === "archived" ? "资源将从公开列表移除，访客不能再查看。历史内容保留，你可以稍后重新发布。" : "资源及其历史版本、讨论将恢复公开可见。"}</p><p class="form-error" role="alert"></p></div>`,
        `<button class="btn" data-action="close">取消</button><button class="btn primary" data-confirm-status="${button.dataset.resourceStatus}">确认${button.dataset.resourceStatus === "archived" ? "下架" : "发布"}</button>`,
      );
      return true;
    }
    if (button.dataset.confirmStatus) {
      await api("resources/" + state.id + "/status", "PUT", {
        status: button.dataset.confirmStatus,
      });
      closeModal();
      await refresh();
      await ctx.loadDetail();
      toast("发布状态已更新");
      return true;
    }
    if (button.dataset.invitation) {
      await api("admin/invitations", "PUT", {
        email: button.dataset.invitation,
        active: button.dataset.active === "true",
      });
      remotePage("admin");
      return true;
    }
    if (button.dataset.moderate || button.dataset.restore) {
      const flag = adminData?.flags.find(
        (f) => f.id === button.dataset.moderate,
      );
      openModal(
        flag ? "处理举报" : "解除内容限制",
        `<form id="moderation-form" data-resource-id="${esc(flag?.resource_id || button.dataset.restore)}" data-flag-id="${esc(flag?.id || "")}"><div class="dialog-body">${flag ? `<p>${esc(flag.reason)}</p><div class="field"><label for="decision">处理方式</label><select id="decision" name="action"><option value="hide">隐藏资源，等待作者处理</option><option value="dismiss">未发现违规，关闭举报</option></select></div>` : '<input name="action" type="hidden" value="restore"><p>解除限制后，资源进入已下架状态，由作者决定何时重新发布。</p>'}<div class="field"><label for="note">处理说明</label><textarea id="note" name="note" maxlength="1000" required placeholder="说明核查结果与处理依据"></textarea></div><p class="form-error" role="alert"></p></div><div class="dialog-footer"><button class="btn primary" type="submit">确认处理</button></div></form>`,
      );
      return true;
    }
    return false;
  }
  async function submit(form) {
    if (
      ![
        "auth-form",
        "resend-form",
        "account-profile",
        "invitation-form",
        "report-form",
        "moderation-form",
      ].includes(form.id)
    )
      return false;
    const b = Object.fromEntries(new FormData(form)),
      button = form.querySelector("[type=submit]");
    button.disabled = true;
    form.querySelector(".form-error").textContent = "";
    try {
      if (form.id === "auth-form") {
        const mode = form.dataset.mode;
        if (
          ["signup", "reset-password"].includes(mode) &&
          (typeof b.password !== "string" ||
            b.password.length < 6 ||
            b.password.length > 128 ||
            !/[A-Za-z]/.test(b.password) ||
            !/[0-9]/.test(b.password))
        )
          throw Error("密码需为 6–128 位，包含字母和数字");
        if (mode === "reset-password" && b.password !== b["confirm-password"])
          throw Error("两次输入的密码不一致");
        const result = await api(
          "auth/" +
            {
              signup: "signup",
              recover: "recover",
              "reset-password": "password",
              login: "login",
            }[mode],
          "POST",
          {
            email: b.email,
            password: b.password,
            accepted: b.accepted === "on",
            next: next(),
          },
        );
        form.reset();
        if (result.sent) {
          go("#verify" + (mode === "recover" ? "?mode=recover" : ""));
          toast(
            mode === "recover"
              ? "若该邮箱已注册，将收到重置邮件"
              : "请查收邮箱验证邮件",
          );
        } else {
          await refresh();
          go(state.user?.onboarded ? next() : "#onboarding");
          toast(mode === "reset-password" ? "密码已更新" : "登录成功");
        }
      }
      if (form.id === "resend-form") {
        await api(
          form.dataset.recovery === "true" ? "auth/recover" : "auth/resend",
          "POST",
          b,
        );
        toast("如果该邮箱需要验证，将收到新的验证邮件");
      }
      if (form.id === "account-profile") {
        await api("profile", "PUT", { ...b, accepted: b.accepted === "on" });
        await refresh();
        if (form.dataset.onboarding) go(next());
        else shell();
        toast("资料已保存");
      }
      if (form.id === "invitation-form") {
        await api("admin/invitations", "PUT", { email: b.email, active: true });
        remotePage("admin");
        toast("试用资格已开通，请将注册链接分享给对方");
      }
      if (form.id === "report-form") {
        await api("resources/" + state.id + "/flags", "POST", b);
        closeModal();
        toast("举报已提交，处理结果会出现在消息通知中");
      }
      if (form.id === "moderation-form") {
        await api("admin/moderation", "PUT", {
          ...b,
          resourceId: form.dataset.resourceId,
          flagId: form.dataset.flagId,
        });
        closeModal();
        await refresh();
        remotePage("admin");
        toast("处理结果已保存");
      }
    } catch (e) {
      form.querySelector(".form-error").textContent = e.message;
    } finally {
      button.disabled = false;
    }
    return true;
  }
  return {
    render,
    click,
    submit,
    gate,
    reset() {
      ++viewToken;
      adminData = null;
      drafts = [];
    },
  };
}
