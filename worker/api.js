import { resolveIdentity, authAPI, authConfiguration } from "./auth.js";
const json = (data, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const q = (db, sql, ...args) => db.prepare(sql).bind(...args);
const rows = async (stmt) => (await stmt.all()).results;
const decode = (r) =>
  r
    ? {
        ...JSON.parse(r.data),
        id: r.id,
        ownerId: r.owner_id,
        owner: r.owner_name,
        version: r.version,
        updatedAt: r.updated_at,
        forkedFrom: r.forked_from,
        sample: false,
        status: r.status || "published",
      }
    : null;
const fetchResource = async (db, id) =>
  decode(
    await q(
      db,
      "SELECT r.*, COALESCE(p.name,r.owner_name) AS owner_name FROM resources r LEFT JOIN profiles p ON p.id=r.owner_id WHERE r.id = ?",
      id,
    ).first(),
  );
function trim(v, max, label, required = true) {
  if (typeof v !== "string" || v.length > max || (required && !v.trim()))
    fail(400, `${label}不完整或超出长度限制`);
  return v.trim();
}
function resourceInput(b) {
  const d = {
    title: trim(b.title, 80, "资源标题"),
    desc: trim(b.desc, 300, "简单介绍"),
    readme: trim(b.readme, 150000, "使用指南"),
    type: b.type,
    topic: trim(b.topic, 30, "所属话题"),
    audience: trim(b.audience || "", 100, "适用人群", false),
    difficulty: b.difficulty || "beginner",
    url: trim(b.url || "", 2000, "项目链接", false),
  };
  if (
    !["skill", "experience", "tool"].includes(d.type) ||
    !["beginner", "manual", "technical"].includes(d.difficulty)
  )
    fail(400, "资源类型或使用门槛无效");
  if (d.url) {
    try {
      const u = new URL(d.url);
      if (!["https:", "http:"].includes(u.protocol) || u.username || u.password)
        throw Error();
    } catch {
      fail(400, "项目链接必须是完整的 http 或 https 地址");
    }
  }
  if (
    !d.readme
      .replace(/\[[^\]]*\]\(https?:\/\/[^)]+\)/g, "")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[#>*\-`\s]/g, "")
  )
    fail(400, "请在站内写清执行步骤，不能只提交外链");
  const disclosure = b.disclosure || "unspecified";
  if (
    !["unspecified", "independent", "creator", "sponsored"].includes(disclosure)
  )
    fail(400, "利益关系说明无效");
  const evidenceStatus = b.evidenceStatus || "untested";
  if (
    !["untested", "improved", "no-improvement", "mixed"].includes(
      evidenceStatus,
    )
  )
    fail(400, "实践状态无效");
  const evidence = trim(b.evidence || "", 1500, "结果说明", false),
    limits = trim(b.limits || "", 1000, "适用边界", false),
    effort = trim(b.effort || "", 100, "投入时间与成本", false);
  if (evidenceStatus !== "untested" && !evidence)
    fail(400, "请补充结果说明，未实践的方法请选择待验证");
  return {
    ...d,
    disclosure,
    evidenceStatus,
    evidence,
    limits,
    effort,
    tags: [d.topic],
    name: trim(b.name || d.title, 80, "资源名称"),
  };
}
export async function api(request, env) {
  let identity = { cookies: [] };
  try {
    if (!env.DB) fail(503, "数据服务暂不可用，请稍后重试");
    if (new URL(request.url).pathname.startsWith("/api/auth/"))
      return await authAPI(request, env);
    identity = await resolveIdentity(request, env);
    const response = await handleAPI(request, env, identity.user);
    for (const cookie of identity.cookies)
      response.headers.append("set-cookie", cookie);
    return response;
  } catch (e) {
    const response = e.status
      ? json({ error: e.message }, e.status)
      : json({ error: "服务暂时不可用。你的输入已保留，请稍后重试。" }, 503);
    for (const cookie of identity.cookies)
      response.headers.append("set-cookie", cookie);
    if (!e.status) console.error("GrowthHub API:", e.message);
    return response;
  }
}
async function handleAPI(request, env, user) {
  const db = env.DB;
  const url = new URL(request.url),
    parts = url.pathname.split("/").filter(Boolean),
    method = request.method;
  if (!["GET", "HEAD"].includes(method)) {
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin) fail(403, "请求来源无效");
    if (!request.headers.get("content-type")?.includes("application/json"))
      fail(415, "请使用 JSON 请求");
  }
  let b = {};
  if (!["GET", "HEAD"].includes(method)) {
    const raw = await request.text();
    if (raw.length > 180000) fail(413, "内容过大，请缩短后重试");
    try {
      b = JSON.parse(raw);
    } catch {
      fail(400, "内容格式无效");
    }
    if (!b || Array.isArray(b) || typeof b !== "object")
      fail(400, "内容格式无效");
  }
  const profile = user
    ? await q(
        db,
        "SELECT name,bio,accepted_at FROM profiles WHERE id = ?",
        user.id,
      ).first()
    : null;
  if (user) {
    if (profile) Object.assign(user, profile);
    user.admin =
      !!user.email &&
      (env.ADMIN_EMAILS || "")
        .toLowerCase()
        .split(",")
        .map((x) => x.trim())
        .includes(user.email);
    user.member =
      user.admin ||
      env.INVITE_ONLY !== "true" ||
      !!(
        user.email &&
        (
          await q(
            db,
            "SELECT active FROM invitations WHERE email=?",
            user.email,
          ).first()
        )?.active
      );
    user.onboarded = !!profile?.accepted_at;
  }
  const needMember = () => {
    if (!user) fail(401, "请登录后继续");
    if (!user.member) fail(403, "此账户尚未获得试用邀请，请联系社区管理员");
  };
  if (!["GET", "HEAD"].includes(method)) {
    needMember();
    if (
      env.INVITE_ONLY === "true" &&
      !user.onboarded &&
      parts[1] !== "profile" &&
      !user.admin
    )
      fail(428, "请先完善资料并同意社区约定");
  }
  const log = (action, target, detail) =>
    q(
      db,
      "INSERT INTO audit(id,actor_id,action,target,detail,created_at) VALUES (?,?,?,?,?,?)",
      crypto.randomUUID(),
      user.id,
      action,
      target,
      detail,
      Date.now(),
    );
  const notify = (uid, rid, message) =>
    uid && uid !== user.id && uid !== "sample"
      ? q(
          db,
          "INSERT INTO notifications(id,user_id,resource_id,message,created_at) VALUES (?,?,?,?,?)",
          crypto.randomUUID(),
          uid,
          rid,
          message,
          Date.now(),
        )
      : null;
  if (method === "POST" && ["resources", "flags"].includes(parts[1])) {
    const now = Date.now(),
      key = "write:" + user.id + ":" + Math.floor(now / 600000);
    const rate = await q(
      db,
      "INSERT INTO rate_limits(key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count",
      key,
      now + 600000,
    ).first();
    if (rate.count > 40) fail(429, "操作太频繁，请十分钟后再试");
    await q(
      db,
      "DELETE FROM rate_limits WHERE expires_at < ?",
      now - 600000,
    ).run();
  }

  if (parts[1] === "bootstrap" && method === "GET") {
    const uid = user?.member ? user.id : "";
    const [
      resourceRows,
      counts,
      ownPractices,
      practiceCounts,
      starRows,
      forkCounts,
    ] = await Promise.all([
      rows(
        q(
          db,
          "SELECT r.*, COALESCE(p.name,r.owner_name) AS owner_name FROM resources r LEFT JOIN profiles p ON p.id=r.owner_id WHERE r.status='published' OR r.owner_id=? ORDER BY r.updated_at DESC LIMIT 500",
          uid,
        ),
      ),
      rows(
        q(
          db,
          "SELECT resource_id, COUNT(*) AS total FROM stars GROUP BY resource_id",
        ),
      ),
      uid
        ? rows(
            q(
              db,
              "SELECT * FROM practices WHERE user_id=? ORDER BY updated_at DESC",
              uid,
            ),
          )
        : Promise.resolve([]),
      rows(
        q(
          db,
          "SELECT resource_id,COUNT(*) AS total FROM practices WHERE visibility='community' AND stage='complete' GROUP BY resource_id",
        ),
      ),
      uid
        ? rows(q(db, "SELECT resource_id FROM stars WHERE user_id = ?", uid))
        : Promise.resolve([]),
      rows(
        q(
          db,
          "SELECT forked_from, COUNT(*) AS total FROM resources WHERE forked_from IS NOT NULL AND status='published' GROUP BY forked_from",
        ),
      ),
    ]);
    const resources = resourceRows.map(decode),
      ownStars = starRows.map((s) => s.resource_id);
    return json({
      user,
      auth: authConfiguration(env),
      resources: resources.map(({ readme, ...r }) => ({
        ...r,
        practiceCount:
          practiceCounts.find((c) => c.resource_id === r.id)?.total || 0,
        stars: counts.find((c) => c.resource_id === r.id)?.total || 0,
        forks: forkCounts.find((c) => c.forked_from === r.id)?.total || 0,
      })),
      stars: ownStars,
      practices: ownPractices.map((p) => ({ ...p, data: JSON.parse(p.data) })),
    });
  }
  if (parts[1] === "profile" && method === "PUT") {
    if (!profile?.accepted_at && b.accepted !== true)
      fail(400, "请同意社区约定和隐私说明");
    const name = trim(b.name, 50, "显示名称"),
      bio = trim(b.bio || "", 200, "个人介绍", false);
    await q(
      db,
      "INSERT INTO profiles(id,name,bio,accepted_at) VALUES (?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,bio=excluded.bio,accepted_at=COALESCE(profiles.accepted_at,excluded.accepted_at)",
      user.id,
      name,
      bio,
      Date.now(),
    ).run();
    return json({ name, bio });
  }
  if (parts[1] === "drafts") {
    needMember();
    const key = parts[2];
    if (method === "GET")
      return json({
        drafts: (
          await rows(
            q(
              db,
              "SELECT id,data,version,updated_at FROM drafts WHERE user_id=? ORDER BY updated_at DESC",
              user.id,
            ),
          )
        ).map((d) => ({ ...d, data: JSON.parse(d.data) })),
      });
    if (!key || !/^[a-zA-Z0-9:_-]{1,100}$/.test(key)) fail(400, "草稿编号无效");
    if (method === "DELETE") {
      await q(
        db,
        "DELETE FROM drafts WHERE user_id=? AND id=?",
        user.id,
        key,
      ).run();
      return json({ deleted: true });
    }
    if (method === "PUT") {
      if (
        !b.data ||
        !["new", "edit", "proposal"].includes(b.data.mode) ||
        typeof b.data.title !== "string" ||
        typeof b.data.readme !== "string"
      )
        fail(400, "草稿格式无效");
      const old = await q(
        db,
        "SELECT version FROM drafts WHERE user_id=? AND id=?",
        user.id,
        key,
      ).first();
      if (b.version !== (old?.version || 0))
        fail(409, "另一处已保存了新草稿，请先下载本地副本再重新打开");
      if (
        !old &&
        (
          await q(
            db,
            "SELECT COUNT(*) AS n FROM drafts WHERE user_id=?",
            user.id,
          ).first()
        ).n >= 50
      )
        fail(400, "草稿已达 50 份，请先整理已有草稿");
      const saved = old
        ? await q(
            db,
            "UPDATE drafts SET data=?,version=version+1,updated_at=? WHERE user_id=? AND id=? AND version=?",
            JSON.stringify(b.data),
            Date.now(),
            user.id,
            key,
            old.version,
          ).run()
        : await q(
            db,
            "INSERT OR IGNORE INTO drafts(user_id,id,data,version,updated_at) VALUES (?,?,?,1,?)",
            user.id,
            key,
            JSON.stringify(b.data),
            Date.now(),
          ).run();
      if (!saved.meta.changes) fail(409, "草稿已在另一处更新");
      return json({ version: (old?.version || 0) + 1 });
    }
  }
  if (parts[1] === "notifications") {
    needMember();
    if (method === "GET")
      return json({
        notifications: await rows(
          q(
            db,
            "SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100",
            user.id,
          ),
        ),
      });
    if (method === "PUT") {
      await q(
        db,
        "UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL",
        Date.now(),
        user.id,
      ).run();
      return json({ ok: true });
    }
  }
  if (parts[1] === "account" && parts[2] === "export" && method === "GET") {
    if (!user) fail(401, "请登录后继续");
    const data = {
      profile,
      resources: [],
      drafts: [],
      practices: [],
      stars: [],
    };
    for (const table of ["resources", "drafts", "practices", "stars"])
      data[table] = await rows(
        q(
          db,
          "SELECT * FROM " +
            table +
            " WHERE " +
            (table === "resources" ? "owner_id" : "user_id") +
            "=?",
          user.id,
        ),
      );
    return json(data);
  }
  if (parts[1] === "admin") {
    needMember();
    if (!user.admin) fail(403, "此操作仅限管理员");
    if (method === "GET")
      return json({
        invitations: await rows(
          q(db, "SELECT * FROM invitations ORDER BY created_at DESC LIMIT 200"),
        ),
        flags: await rows(
          q(db, "SELECT * FROM flags ORDER BY created_at DESC LIMIT 200"),
        ),
        audit: await rows(
          q(db, "SELECT * FROM audit ORDER BY created_at DESC LIMIT 100"),
        ),
        hidden: (
          await rows(
            q(
              db,
              "SELECT * FROM resources WHERE status='hidden' ORDER BY updated_at DESC LIMIT 100",
            ),
          )
        ).map(decode),
      });
    if (parts[2] === "invitations" && method === "PUT") {
      const email = trim(b.email, 254, "邮箱").toLowerCase();
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        typeof b.active !== "boolean"
      )
        fail(400, "邮箱或邀请状态无效");
      await db.batch([
        q(
          db,
          "INSERT INTO invitations(email,created_by,created_at,active) VALUES (?,?,?,?) ON CONFLICT(email) DO UPDATE SET active=excluded.active",
          email,
          user.id,
          Date.now(),
          Number(b.active),
        ),
        log(b.active ? "invite" : "revoke-invite", email, ""),
      ]);
      return json({ ok: true });
    }
    if (parts[2] === "moderation" && method === "PUT") {
      if (!["hide", "restore", "dismiss"].includes(b.action))
        fail(400, "审核操作无效");
      const note = trim(b.note, 1000, "处理说明"),
        resource = await fetchResource(db, String(b.resourceId));
      if (!resource) fail(404, "资源不存在");
      const statements = [log(b.action, resource.id, note)];
      if (b.action !== "dismiss")
        statements.push(
          q(
            db,
            "UPDATE resources SET status=? WHERE id=?",
            b.action === "hide" ? "hidden" : "archived",
            resource.id,
          ),
        );
      if (b.flagId) {
        const flag = await q(
          db,
          "SELECT * FROM flags WHERE id=? AND resource_id=? AND status=?",
          b.flagId,
          resource.id,
          "open",
        ).first();
        if (!flag) fail(409, "这条举报已处理，请刷新");
        statements.push(
          q(
            db,
            "UPDATE flags SET status='resolved',resolution=?,resolved_at=? WHERE id=?",
            note,
            Date.now(),
            flag.id,
          ),
        );
        const n = notify(
          flag.reporter_id,
          resource.id,
          "你的举报已处理：" + note,
        );
        if (n) statements.push(n);
      }
      const n = notify(
        resource.ownerId,
        resource.id,
        b.action === "hide"
          ? "你的资源已被隐藏：" + note
          : b.action === "restore"
            ? "资源限制已解除，可在我的资源中重新发布。"
            : "",
      );
      if (n && b.action !== "dismiss") statements.push(n);
      await db.batch(statements);
      return json({ ok: true });
    }
    fail(404, "未找到管理操作");
  }
  if (parts[1] === "resources" && parts.length === 2 && method === "POST") {
    const data = resourceInput(b),
      id = b.requestId || crypto.randomUUID(),
      now = Date.now();
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      )
    )
      fail(400, "提交编号无效");
    const existing = await fetchResource(db, id);
    if (existing) {
      if (
        existing.ownerId !== user.id ||
        JSON.stringify(resourceInput(existing)) !== JSON.stringify(data)
      )
        fail(409, "这次提交已存在，请从我的资源查看");
      return json({ id }, 200);
    }
    let from = null;
    if (b.forkedFrom) {
      const source = await fetchResource(db, String(b.forkedFrom));
      if (!source || (source.status && source.status !== "published"))
        fail(404, "原始资源不存在或已下架");
      from = source.id;
    }
    await db.batch([
      q(
        db,
        "INSERT OR IGNORE INTO resources(id,owner_id,owner_name,data,version,updated_at,forked_from) VALUES (?,?,?,?,1,?,?)",
        id,
        user.id,
        user.name,
        JSON.stringify(data),
        now,
        from,
      ),
      q(
        db,
        "INSERT OR IGNORE INTO revisions(id,resource_id,author_name,data,version,message,created_at) VALUES (?,?,?,?,1,?,?)",
        crypto.randomUUID(),
        id,
        user.name,
        JSON.stringify(data),
        from ? "基于原资源创建副本" : "创建资源",
        now,
      ),
    ]);
    const persisted = await fetchResource(db, id);
    if (
      persisted.ownerId !== user.id ||
      JSON.stringify(resourceInput(persisted)) !== JSON.stringify(data)
    )
      fail(409, "此提交编号已被使用");
    return json({ id }, 201);
  }
  if (parts[1] !== "resources" || !parts[2]) fail(404, "未找到接口");
  const id = decodeURIComponent(parts[2]),
    r = await fetchResource(db, id);
  if (!r) fail(404, "资源不存在");
  const owner = !!user && r.ownerId === user.id;
  const inactive = r.status && r.status !== "published";
  if (inactive && !owner && !user?.admin) fail(404, "资源不存在或已下架");
  if (parts[3] === "status" && method === "PUT") {
    if (!owner) fail(403, "只有作者能调整发布状态");
    if (r.status === "hidden")
      fail(403, "资源已被管理员隐藏，请先联系管理员处理");
    if (!["published", "archived"].includes(b.status))
      fail(400, "发布状态无效");
    await db.batch([
      q(db, "UPDATE resources SET status=? WHERE id=?", b.status, id),
      log(b.status, id, "作者调整可见性"),
    ]);
    return json({ status: b.status });
  }
  if (parts[3] === "flags" && method === "POST") {
    const reason = trim(b.reason, 2000, "举报原因");
    const existing = await q(
      db,
      "SELECT id FROM flags WHERE resource_id=? AND reporter_id=? AND status='open'",
      id,
      user.id,
    ).first();
    if (existing) fail(409, "你已举报此资源，管理员正在处理");
    await q(
      db,
      "INSERT INTO flags(id,resource_id,reporter_id,reason,created_at) VALUES (?,?,?,?,?)",
      crypto.randomUUID(),
      id,
      user.id,
      reason,
      Date.now(),
    ).run();
    return json({ ok: true }, 201);
  }
  if (inactive && !["GET", "HEAD"].includes(method))
    fail(403, "请恢复发布后再修改或参与此资源");
  if (parts.length === 3 && method === "GET") {
    const [discussions, proposals, revisions, replies, practice, reports] =
      await Promise.all([
        rows(
          q(
            db,
            "SELECT id,author_id,author_name,title,body,status,created_at FROM discussions WHERE resource_id=? ORDER BY created_at DESC",
            id,
          ),
        ),
        rows(
          q(
            db,
            "SELECT * FROM proposals WHERE resource_id=? ORDER BY created_at DESC",
            id,
          ),
        ),
        rows(
          q(
            db,
            "SELECT * FROM revisions WHERE resource_id=? ORDER BY version DESC",
            id,
          ),
        ),
        rows(
          q(
            db,
            "SELECT r.* FROM replies r JOIN discussions d ON d.id=r.discussion_id WHERE d.resource_id=? ORDER BY r.created_at",
            id,
          ),
        ),
        user?.member
          ? q(
              db,
              "SELECT * FROM practices WHERE resource_id=? AND user_id=?",
              id,
              user.id,
            ).first()
          : Promise.resolve(null),
        rows(
          q(
            db,
            "SELECT a.*,COALESCE(p.name,a.author_name) AS author_name FROM practices a LEFT JOIN profiles p ON p.id=a.user_id WHERE a.resource_id=? AND a.visibility='community' AND a.stage='complete' ORDER BY a.updated_at DESC",
            id,
          ),
        ),
      ]);
    return json({
      resource: r,
      practice: practice
        ? { ...practice, data: JSON.parse(practice.data) }
        : null,
      reports: reports.map((p) => ({ ...p, data: JSON.parse(p.data) })),
      discussions: discussions.map((d) => ({
        ...d,
        replies: replies.filter((x) => x.discussion_id === d.id),
      })),
      proposals: proposals.map((p) => ({ ...p, data: JSON.parse(p.data) })),
      revisions: revisions.map((v) => ({ ...v, data: JSON.parse(v.data) })),
    });
  }
  if (parts.length === 3 && method === "PUT") {
    if (!owner)
      fail(403, "只有资源作者可以直接编辑，请先保存副本或提交改进建议");
    if (b.version !== r.version)
      fail(409, "资源已被更新，请重新打开编辑器后再保存");
    const data = resourceInput(b),
      now = Date.now(),
      version = r.version + 1;
    // Conditional insert/update in one transaction prevents stale overwrites.
    const result = await db.batch([
      q(
        db,
        "INSERT INTO revisions(id,resource_id,author_name,data,version,message,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM resources WHERE id=? AND version=?)",
        crypto.randomUUID(),
        id,
        user.name,
        JSON.stringify(data),
        version,
        trim(b.message || "更新资源内容", 120, "更新说明"),
        now,
        id,
        r.version,
      ),
      q(
        db,
        "UPDATE resources SET data=?,version=?,updated_at=? WHERE id=? AND owner_id=? AND version=?",
        JSON.stringify(data),
        version,
        now,
        id,
        user.id,
        r.version,
      ),
    ]);
    if (!result[1].meta.changes) fail(409, "资源已被更新，请刷新后重试");
    return json({ id, version });
  }
  if (parts[3] === "practice" && parts.length === 4 && method === "PUT") {
    const stage = b.stage || "running",
      visibility = b.visibility || "private";
    if (
      !["running", "complete"].includes(stage) ||
      !["private", "community"].includes(visibility)
    )
      fail(400, "实践状态无效");
    if (visibility === "community" && stage !== "complete")
      fail(400, "完成复盘后才能分享到社区");
    const input = b.data || {},
      data = {};
    for (const [key, max, label, required] of [
      ["context", 1000, "实践场景", true],
      ["metric", 120, "观察指标", true],
      ["baseline", 200, "当前基线", true],
      ["timeframe", 100, "观察周期", true],
      ["result", 1500, "实际结果", stage === "complete"],
      ["limits", 1000, "局限与干扰因素", stage === "complete"],
      ["nextStep", 500, "下一步", false],
    ])
      data[key] = trim(input[key] || "", max, label, required);
    data.outcome = input.outcome || "pending";
    if (
      !["pending", "improved", "no-improvement", "mixed"].includes(
        data.outcome,
      ) ||
      (stage === "complete" && data.outcome === "pending")
    )
      fail(400, "请选择观察结论");
    const old = await q(
        db,
        "SELECT version,resource_version FROM practices WHERE user_id=? AND resource_id=?",
        user.id,
        id,
      ).first(),
      now = Date.now();
    if (b.version !== (old?.version || 0))
      fail(409, "实践记录已更新，请关闭并重新打开后再保存");
    let saved;
    if (old)
      saved = await q(
        db,
        "UPDATE practices SET data=?,stage=?,visibility=?,version=version+1,updated_at=? WHERE user_id=? AND resource_id=? AND version=?",
        JSON.stringify(data),
        stage,
        visibility,
        now,
        user.id,
        id,
        old.version,
      ).run();
    else
      saved = await q(
        db,
        "INSERT OR IGNORE INTO practices(user_id,resource_id,author_name,resource_version,data,stage,visibility,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,1,?,?)",
        user.id,
        id,
        user.name,
        r.version,
        JSON.stringify(data),
        stage,
        visibility,
        now,
        now,
      ).run();
    if (!saved.meta.changes) fail(409, "实践记录已更新，请重新打开后再保存");
    return json({ saved: true, version: (old?.version || 0) + 1 });
  }
  if (parts[3] === "star" && method === "PUT") {
    if (typeof b.active !== "boolean") fail(400, "收藏状态无效");
    await (
      b.active
        ? q(
            db,
            "INSERT OR IGNORE INTO stars(user_id,resource_id) VALUES (?,?)",
            user.id,
            id,
          )
        : q(
            db,
            "DELETE FROM stars WHERE user_id=? AND resource_id=?",
            user.id,
            id,
          )
    ).run();
    return json({ active: b.active });
  }
  if (
    parts[3] === "discussions" &&
    parts[4] &&
    parts[5] === "replies" &&
    method === "POST"
  ) {
    const d = await q(
      db,
      "SELECT id,author_id FROM discussions WHERE id=? AND resource_id=?",
      parts[4],
      id,
    ).first();
    if (!d) fail(404, "讨论不存在");
    const rid = crypto.randomUUID();
    await db.batch(
      [
        q(
          db,
          "INSERT INTO replies(id,discussion_id,author_id,author_name,body,created_at) VALUES (?,?,?,?,?,?)",
          rid,
          d.id,
          user.id,
          user.name,
          trim(b.body, 5000, "回复内容"),
          Date.now(),
        ),
        notify(d.author_id, id, user.name + " 回复了你的讨论"),
      ].filter(Boolean),
    );
    return json({ id: rid }, 201);
  }
  if (parts[3] === "discussions" && parts.length === 4 && method === "POST") {
    const did = crypto.randomUUID();
    await db.batch(
      [
        q(
          db,
          "INSERT INTO discussions(id,resource_id,author_id,author_name,title,body,status,created_at) VALUES (?,?,?,?,?,?,?,?)",
          did,
          id,
          user.id,
          user.name,
          trim(b.title, 100, "讨论标题"),
          trim(b.body, 5000, "讨论内容"),
          "open",
          Date.now(),
        ),
        notify(r.ownerId, id, user.name + " 发起了讨论：" + b.title),
      ].filter(Boolean),
    );
    return json({ id: did }, 201);
  }
  if (parts[3] === "discussions" && parts[4] && method === "PATCH") {
    const d = await q(
      db,
      "SELECT * FROM discussions WHERE id=? AND resource_id=?",
      parts[4],
      id,
    ).first();
    if (!d) fail(404, "讨论不存在");
    if (!owner && d.author_id !== user.id)
      fail(403, "你没有修改这条讨论的权限");
    if (!["open", "closed"].includes(b.status)) fail(400, "状态无效");
    await q(
      db,
      "UPDATE discussions SET status=? WHERE id=?",
      b.status,
      d.id,
    ).run();
    return json({ status: b.status });
  }
  if (parts[3] === "proposals" && method === "POST") {
    const data = resourceInput({ ...r, ...b.data });
    if (b.baseVersion !== r.version)
      fail(409, "原资源已更新，请刷新后重新提交");
    const pid = crypto.randomUUID();
    await db.batch(
      [
        q(
          db,
          "INSERT INTO proposals(id,resource_id,author_id,author_name,title,body,data,base_version,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
          pid,
          id,
          user.id,
          user.name,
          trim(b.title, 100, "改进标题"),
          trim(b.body, 3000, "改进说明"),
          JSON.stringify(data),
          r.version,
          "open",
          Date.now(),
        ),
        notify(r.ownerId, id, user.name + " 提交了改进建议：" + b.title),
      ].filter(Boolean),
    );
    return json({ id: pid }, 201);
  }
  if (parts[3] === "proposals" && parts[4] && method === "PATCH") {
    const p = await q(
      db,
      "SELECT * FROM proposals WHERE id=? AND resource_id=?",
      parts[4],
      id,
    ).first();
    if (!p) fail(404, "改进建议不存在");
    if (p.status !== "open") fail(409, "这条建议已经处理");
    if (b.action === "close") {
      if (!owner && p.author_id !== user.id)
        fail(403, "你没有处理这条建议的权限");
      await db.batch(
        [
          q(
            db,
            "UPDATE proposals SET status='closed' WHERE id=? AND status='open'",
            p.id,
          ),
          notify(p.author_id, id, "你的改进建议已关闭：" + p.title),
        ].filter(Boolean),
      );
      return json({ status: "closed" });
    }
    if (b.action !== "merge") fail(400, "操作无效");
    if (!owner) fail(403, "只有资源作者可以合并改进");
    if (r.version !== p.base_version)
      fail(409, "资源已有新版本，请基于最新内容重新提交建议");
    const now = Date.now(),
      version = r.version + 1;
    const result = await db.batch(
      [
        q(
          db,
          "INSERT INTO revisions(id,resource_id,author_name,data,version,message,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM resources WHERE id=? AND version=?)",
          crypto.randomUUID(),
          id,
          p.author_name,
          p.data,
          version,
          "采纳改进：" + p.title,
          now,
          id,
          r.version,
        ),
        q(
          db,
          "UPDATE resources SET data=?,version=?,updated_at=? WHERE id=? AND version=?",
          p.data,
          version,
          now,
          id,
          r.version,
        ),
        q(
          db,
          "UPDATE proposals SET status='merged' WHERE id=? AND EXISTS (SELECT 1 FROM resources WHERE id=? AND version=? AND data=?)",
          p.id,
          id,
          version,
          p.data,
        ),
        notify(p.author_id, id, "你的改进建议已被采纳：" + p.title),
      ].filter(Boolean),
    );
    if (!result[1].meta.changes) fail(409, "内容已更新，未能合并");
    return json({ status: "merged", version });
  }
  fail(404, "接口不存在");
}

// A single verified identity is shared by this page's parallel queries only.
// Never persist credentials or personalised page data in a shared cache.
export async function pageData(request, env, resourceId) {
  const identity = await resolveIdentity(request, env);
  const read = async (path) => {
    const url = new URL(request.url);
    url.pathname = "/api/" + path;
    url.search = "";
    const response = await handleAPI(
      new Request(url, { headers: request.headers }),
      env,
      identity.user ? { ...identity.user } : null,
    );
    return response.json();
  };
  const [bootstrap, detail] = await Promise.all([
    read("bootstrap"),
    resourceId
      ? read("resources/" + encodeURIComponent(resourceId)).catch((e) => ({
          error: e.status ? e.message : "资源暂时无法打开",
          status: e.status || 503,
        }))
      : null,
  ]);
  return { bootstrap, detail, cookies: identity.cookies };
}
