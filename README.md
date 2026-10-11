# GrowthHub

面向增长从业者的邀请试用社区。公开发现增长方法、实践经验和工具，受邀成员可以收藏、发布、讨论、复用并贡献改进。

- 正式域名：[growthhub.dev](https://growthhub.dev/)
- 独立部署与迁移：[DEPLOYMENT.md](./DEPLOYMENT.md)
- 试用上线事项：[LAUNCH-CHECKLIST.md](./LAUNCH-CHECKLIST.md)

## 独立部署

这条分支将已发布的 v16 迁移至 Natively Labs, Inc. 的 Cloudflare Workers + D1。Supabase 继续提供邮箱与 Google 登录。网站运行不依赖 ChatGPT Sites 的身份请求头、托管绑定或代理服务器；GitHub 保存源码，Cloudflare 承载程序与社区数据库。

迁移尚未完成域名切换与生产验收。上传源码、创建数据库或通过本地测试都不代表完成上线，实际进度见部署文档。

## 当前功能

- 发现榜、可取消的标签筛选、资源详情、收藏、复用、编辑与版本记录。
- 邮箱与 Google 登录、邀请资格、首次建档、个人设置、退出与账户内容导出。
- 云端草稿、默认私有的实践记录、主动分享复盘。
- 讨论与改进建议、站内通知、作者下架/恢复、举报审核与管理员记录。
- 桌面与手机布局；Apple 登录已按产品决定移除。

## 本地开发

使用 Node.js 22.13 或更新版本。

```sh
npm ci
npm run dev
```

访问 `http://127.0.0.1:4177/`。身份切换条和测试身份只存在于本地预览；SQLite 位于忽略目录 `.sites-runtime/`，不连接真实 Supabase，不包含线上用户数据。

在 Cloudflare 本地运行时验证真实入口：

```sh
npx wrangler d1 migrations apply DB --local
npm run dev:cloudflare
```

此模式默认没有真实登录配置。如需测试真实 Supabase，按 `.env.example` 填入被忽略的 `.dev.vars`，并在 Supabase 配置相应测试回调。

```sh
npm run check:release
npm run check:recovery
npm run check:cloudflare
```

发布检查覆盖业务权限、认证边界、资源版本、二进制下载和编译产物；恢复演练仅使用合成数据。CI 自动检查代码，不自动部署生产。

## 目录

| 路径 | 用途 |
| --- | --- |
| `public/` | 静态页面、样式、脚本、公开 Skill 安装包 |
| `worker/index.js` | Cloudflare 独立入口、域名检查、维护开关 |
| `worker/api.js`、`worker/auth.js` | 社区业务与 Supabase 身份校验 |
| `db/`、`drizzle/` | D1 表结构及不可改写的历史迁移 |
| `wrangler.jsonc` | 公司账号、数据库、静态资源与运行配置 |
| `scripts/`、`tests/` | 开发、构建、迁移核对、自动检查 |

会话使用 HttpOnly、Secure、SameSite=Lax Cookie，OAuth 与邮件回跳使用 PKCE。历史 ChatGPT 身份不再作为登录入口，原始数据 ID 保留；绝不按邮箱擅自合并旧账户。Google 密钥和 SMTP 凭据只放在 Supabase，不放在前端或仓库。
