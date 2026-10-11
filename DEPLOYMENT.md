# GrowthHub 独立部署

## 目标与当前进度

目标域名 `https://growthhub.dev`，公司 Cloudflare 账号 Natively Labs, Inc.。网站程序使用 Workers Static Assets + Worker，社区数据使用独立 D1，邮箱及 Google 登录继续使用原 Supabase 项目。

截至 2026-10-12：独立站已部署至公司 Cloudflare，14 张业务表迁移及远端恢复核对完成。Dynadot 名称服务器已保存为公司 Cloudflare 分配的地址，注册局 RDAP 已确认；旧 Sites 自定义域名绑定已移除并通过列表为空核实。独立 Worker 已关闭维护模式。用户确认电脑端可打开；已在 Safari 看见正式域名下的真实资源列表。

当前 Worker 版本：`a9683096-7051-4f06-a103-f1b7eec2c4d8`。已验证迁移快照 SHA-256：`b34cdc1a9a6e6bf2b6456b753c14fc4e93092722f6df9a4ff482d296686770d3`。私有快照及 SQL 保存在工作区 `outputs/growthhub-migration/verified/`，不提交仓库。

新权威解析地址的 HTTPS 检查通过：首页、初始化接口、真实资源详情均返回 200；Skill 下载包 47,390 字节，与仓库文件 SHA-256 一致；未登录账户导出返回 401，源码及环境文件路径返回 404。Google 入口返回 303 至原 Supabase 授权地址，回跳为 `https://growthhub.dev/api/auth/callback`，PKCE cookie 为 Secure / HttpOnly / SameSite=Lax。以上仅证明入口及配置正确，迁移后的真实 Google 授权回跳、邮箱流程、私有写入及手机验收仍待完成。使用电脑现有代理正常访问正式域名的初始化接口也返回 200。直连命令行递归 DNS 仍缓存旧 A 记录；定点检查使用新权威记录且正常验证 TLS，没有关闭证书校验。

旧站冻结版本为 Sites v17，提交 `f810415b33dcabde717777ca44c20f75ea39136a`，环境修订 4（`MIGRATION_READ_ONLY=true`），2026-10-12 00:27（Asia/Shanghai）部署成功。公开读取及已有会话的数据导出仍可用；新增写入和认证请求返回迁移提示。冻结核对报告在 `outputs/growthhub-migration/`。如取消切换，可将该开关改回 `false` 并重新部署同一旧站版本；若新库已接收写入，必须先核对增量。

## 域名切换记录

- 原名称服务器：`ns1.dyna-ns.net`、`ns2.dyna-ns.net`；已备份原完整 DNS。
- 现名称服务器：`leland.ns.cloudflare.com`、`mary.ns.cloudflare.com`。用户明确确认后保存；注册局记录的变更时间为 2026-10-12 00:32:30（Asia/Shanghai）。
- 公司区域已移除导入的旧 A `172.66.3.26`、`162.159.143.30`；现由 `growthhub.dev → growthhub` Worker 绑定生成解析。核验时权威 A 为 `104.21.57.22`、`172.67.140.157`，不要将这些动态地址硬编码为部署配置。
- 原 Sites 自定义域名 `appgdom_6acb3c91cce88191beada51a6b4e7b38` 已移除；旧网站及数据库保留用于恢复，但禁止写入。
- 原 Dynadot 无邮箱、其他子域名或 DNSSEC 配置。旧 `_cf-custom-hostname` TXT 暂留待清理，不再存在对应 Sites 域名绑定。
- 本轮没有变更网站域名或 Supabase 项目，所以 Google / Supabase 登录回跳地址保持不变。真实手机登录验收已交给用户，不能以配置检查代替登录成功。

## 配置

`wrangler.jsonc` 固定公司账号、Worker 名称、D1 数据库 ID，关闭 workers.dev 与预览网址。仅 `/api/*` 进入 Worker，其他请求由静态资源服务处理。`npm run deploy` 先校验目标，避免误发到公司其他项目。

| 配置 | 保存位置 | 用途 |
| --- | --- | --- |
| `PUBLIC_ORIGIN` | Wrangler vars | 固定 `https://growthhub.dev`，拒绝其他主机名的认证请求 |
| `INVITE_ONLY` | Wrangler vars | `true`，保持邀请试用 |
| `AUTH_PROVIDERS` | Wrangler vars | `google` |
| `MAINTENANCE` | Wrangler vars | 当前 `false`；设为 `true` 并部署可暂停 API |
| `SUPABASE_URL` | Worker secret | 原有 Supabase 项目 HTTPS 地址 |
| `SUPABASE_PUBLISHABLE_KEY` | Worker secret | 对应项目 publishable key，不能用 service-role key |
| `ADMIN_EMAILS` | Worker secret | 公司指定管理员的已验证邮箱 |

通过 `wrangler secret put` 的标准输入配置值；不要把值拼入命令参数、提交仓库或输出日志。Google Client Secret 与 SMTP 密钥仍只保存在 Supabase。

`/api/auth/callback` 回调路径和 growthhub.dev 均不变，因此此次托管迁移无需修改 Google 的 Supabase 回调。仍须在真实浏览器验证 Cookie、邮件回跳与 Google 回跳。

## 发布

```sh
npm ci
npm run check:release
npm run check:recovery
npm run check:cloudflare
npx wrangler d1 migrations apply DB --remote
npm run deploy
```

`npm run build` 生成自包含 Worker，仅用于兼容性回归检查。Cloudflare 实际发布入口是 `worker/index.js` 与 `public/`，不使用 Sites 绑定。

域名切换前必须完成：

1. 冻结旧站写入，保存原 DNS、运行配置及旧站版本，留出恢复窗口。
2. 完整导出全部业务表；截断的数据不能作为完整备份。账户导出和资源详情可补齐内容，但须逐字段与原记录核对并记录来源。
3. 保留全部稳定 ID、作者归属、版本、私有草稿及实践权限；不按邮箱合并历史账户。
4. 在本地隔离数据库恢复并校验全部表、JSON、版本关系和内容校验和，再导入空的公司 D1；不得使用 `INSERT OR REPLACE` 覆盖已有数据。
5. 核对远端数据库和本地快照；备份原始导出，文件权限 0600，不入 Git。
6. 配置独立 Worker 域名，保持新站维护模式；确认注册商原记录备份及旧站冻结后，切换 nameserver。等待 Cloudflare 域名激活和 HTTPS 证书生效。
7. 再次核对旧站与新站数据；关闭新站维护模式，验证浏览、下载、邮箱及 Google 登录、写入和两账户隔离。保持旧站禁止写入，避免两个站点分别接收新内容。

## 数据备份与回退

上线后使用公司 D1 导出与 Cloudflare Time Travel；具体保留期以公司套餐为准。导出到忽略的 `backups/` 目录：

```sh
npx wrangler d1 export DB --remote --output backups/growthhub.sql
```

备份包含非公开数据，只在公司批准的存储中保存。代码回退使用经验证的 Worker 版本，数据库回退是单独的操作；不得为了回退页面删除数据表。完成新站写入后，不应直接把 DNS 切回旧数据库，否则会遗漏新内容，必须先核对和同步增量。

`check:recovery` 只是合成数据恢复演练，不是生产备份证明。生产快照、导入和线上检查应另外记录时间、表行数、校验和、Worker 版本及验证结果。

## 访问与费用

按用户选择先使用 Cloudflare 免费额度，不自动购买或升级套餐。免费限额达到后可能出现请求失败；关注 Workers 请求量和 D1 读写/存储指标。迁移后的入口不指向北京 ECS，不影响 Natively 现有服务器业务。
