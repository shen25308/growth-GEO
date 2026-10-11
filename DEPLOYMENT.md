# GrowthHub 独立部署

## 目标与当前进度

目标域名 `https://growthhub.dev`，公司 Cloudflare 账号 Natively Labs, Inc.。网站程序使用 Workers Static Assets + Worker，社区数据使用独立 D1，邮箱及 Google 登录继续使用原 Supabase 项目。

截至 2026-10-12：Wrangler 公司授权已验证，凭据加密并使用 macOS 钥匙串；`growthhub-production` 已创建并完成四个数据库迁移；独立入口和本地检查通过。已导入 14 张业务表并将远端导出恢复至隔离数据库，逐行核对一致；Worker 和登录配置已发布，维护开关仍开启。`growthhub.dev` 已绑定独立 Worker，但 Cloudflare 域名状态仍为 Pending，注册商的 nameserver 尚未切换。旧站写入冻结、增量复核、域名切换和真实登录验收仍需完成。不要把此记录理解为已经切换上线。

当前 Worker 版本：`bfe6161d-8789-40a4-b5e8-7fcf2a8a1992`。已验证迁移快照 SHA-256：`b34cdc1a9a6e6bf2b6456b753c14fc4e93092722f6df9a4ff482d296686770d3`。私有快照及 SQL 保存在工作区 `outputs/growthhub-migration/verified/`，不提交仓库。

## 域名切换记录

- 注册商现有 nameserver：`ns1.dyna-ns.net`、`ns2.dyna-ns.net`，尚未修改。
- 公司 Cloudflare 分配的 nameserver：`leland.ns.cloudflare.com`、`mary.ns.cloudflare.com`。
- 经用户确认，已删除公司 Cloudflare 新区域导入的两条旧 apex A：`172.66.3.26`、`162.159.143.30`；随后成功创建 `growthhub.dev → growthhub` Worker 绑定。此次没有修改 Dynadot 现有解析。
- 旧 `_cf-custom-hostname` TXT 暂时保留，待迁移验收后清理。切换前仍须登录注册商核对完整 DNS 和 DNSSEC 状态，避免遗漏邮箱或其他子域名。

## 配置

`wrangler.jsonc` 固定公司账号、Worker 名称、D1 数据库 ID，关闭 workers.dev 与预览网址。仅 `/api/*` 进入 Worker，其他请求由静态资源服务处理。`npm run deploy` 先校验目标，避免误发到公司其他项目。

| 配置 | 保存位置 | 用途 |
| --- | --- | --- |
| `PUBLIC_ORIGIN` | Wrangler vars | 固定 `https://growthhub.dev`，拒绝其他主机名的认证请求 |
| `INVITE_ONLY` | Wrangler vars | `true`，保持邀请试用 |
| `AUTH_PROVIDERS` | Wrangler vars | `google` |
| `MAINTENANCE` | Wrangler vars | 切换验收前保持 `true`，接口返回 503 |
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
