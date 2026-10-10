# 部署与交接

## 当前部署关系

网站目前运行在 Sites，社区业务数据使用绑定名为 `DB` 的 D1 数据库，身份服务使用 Supabase Auth。GitHub 是本次交接的源码仓库，没有配置自动部署，也没有保存生产凭据。

当前网站：https://growthhub-community.alansun136607.chatgpt.site/

## 本地构建与托管绑定

运行 `npm run build` 生成 `dist/server/index.js`。没有 `.openai/hosting.json` 时，只生成用于本地验证的 Worker，不生成可发布的站点绑定。构建会删除旧的输出绑定，避免沿用过期项目配置。

由拥有站点权限的维护者在 Sites 中打开现有项目，使用 Sites 源码工作流同步该项目后，再应用本仓库经审查的变更。站点工具返回的实际 `project_id` 必须原样保留，数据库绑定为 `DB`。不要猜测 ID，也不要在接手时另建站点而误以为已迁移原有数据。

`.openai/hosting.json` 是本地忽略文件；发布包需要包含它，GitHub 仓库不需要。托管工作流在构建、校验、同步源码后保存匹配的版本并发布；GitHub 提交本身不触发这一步。

## 环境配置

`.env.example` 仅是填写清单，不是生效的线上配置。由站点维护者在托管环境保存：

| 名称 | 值与要求 |
| --- | --- |
| `INVITE_ONLY` | `true`，仅受邀成员或管理员具有贡献资格 |
| `ADMIN_EMAILS` | 公司指定且已验证的管理员邮箱，在托管平台按秘密配置保存 |
| `SUPABASE_URL` | 已确认的 Supabase 项目 HTTPS 地址 |
| `SUPABASE_PUBLISHABLE_KEY` | 对应项目的 publishable key，不能使用 service-role key |
| `AUTH_PROVIDERS` | 当前为 `google`；Apple 暂缓 |

Google Client Secret 与 SMTP 凭据只放入 Supabase 对应配置，不放入 Sites 前端、GitHub、聊天或日志。仓库不包含用户资料、邀请名单、真实数据库或密码。

## 更换托管平台前的必要适配

此 Worker 目前依赖 Sites 可信入口提供的 `oai-authenticated-*` 请求头支持历史 ChatGPT 账户。若直接放在允许客户端自行传入这些头的普通服务器上，会破坏身份信任边界。迁移时必须禁用平台身份回退或实现受信任入口的验证/剥离策略，并重新完成权限检查，不能仅将 `dist/` 上传至另一平台。

迁移还需要重新绑定数据库、执行兼容迁移、配置环境变量与认证回调，并验证真实身份及数据。源码导入不执行这些生产操作。

## 发布与恢复

1. 在独立分支完成修改、代码审查及 `npm run check:release`。
2. 确认目标站点、权限、数据库绑定及已保存的环境配置。
3. 使用 Sites 工作流构建并发布匹配源码的版本，核对成功状态。
4. 检查公开浏览、邮箱/Google 登录、草稿归属及核心成员流程。
5. 如需代码回退，重新部署已成功的旧版本；不逆向删除数据库表。

`npm run check:recovery` 使用临时虚构数据，不能作为生产备份证明。生产备份和隔离恢复途径仍需与托管平台及账号负责人落实。
