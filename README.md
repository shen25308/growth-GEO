# GrowthHub

面向增长从业者的邀请试用社区。公开发现增长方法、实践经验和工具，受邀成员可以收藏、发布、讨论、复用并贡献改进。

- 当前测试网站：[GrowthHub](https://growthhub-community.alansun136607.chatgpt.site/)
- 上线状态与分工：[LAUNCH-CHECKLIST.md](./LAUNCH-CHECKLIST.md)
- 部署与交接：[DEPLOYMENT.md](./DEPLOYMENT.md)

## 当前功能

- 发现榜、标签筛选、资源详情、收藏、复用、编辑与版本记录。
- 邮箱与 Google 登录、邀请资格、首次建档、个人设置、退出与内容导出。
- 云端草稿、默认私有的实践记录、主动分享复盘。
- 讨论与改进建议、站内通知、作者下架/恢复、举报审核与管理员记录。
- 桌面与手机布局；登录注册采用统一深绿色背景与内嵌卡片。

2026-10-10 已通过真实邮箱注册、验证、登录、首次建档，以及 Google 登录回跳与刷新保持登录。Apple 按产品决定暂缓，页面没有 Apple 登录入口。真实邀请成员的邮件投递、完整双账户/手机验收和生产恢复演练仍待完成；本项目不宣称已达到 GitHub 的规模或可用性等级。

## 本地开发

使用 Node.js 22.13 或更新版本（依赖内置 `node:sqlite`）。

```sh
npm ci
npm run dev
```

打开 `http://127.0.0.1:4177/`。顶部身份切换条仅存在于本地服务器，可切换访客、成员、管理员与未受邀账户。本地 SQLite 位于忽略目录 `.sites-runtime/`，与线上数据隔离。

本地预览默认使用测试身份，不连接真实 Supabase，也不会读取 `.env.example` 自动开通登录。因此本地邮箱登录提示未配置是预期行为；真实注册和 Google 登录请使用已配置的测试网站。

```sh
npm run check:release
npm run check:recovery
```

`check:release` 执行业务测试、语法检查、构建和编译产物检查。`check:recovery` 仅使用临时虚构数据验证备份与恢复，不代表生产数据库已备份。GitHub Actions 在提交和 PR 上执行这两组检查，不自动发布网站。

## 结构

| 目录 | 用途 |
| --- | --- |
| `public/` | 页面、样式、前端交互与展示资源 |
| `worker/` | 社区接口、身份验证与权限控制 |
| `db/`、`drizzle/` | D1 表结构、迁移及迁移记录 |
| `scripts/` | 本地预览、构建、发布检查与恢复演练 |
| `tests/` | 接口、身份和业务边界测试 |

生产社区数据保存在 Sites D1，Supabase 提供身份服务。会话令牌仅存于 HttpOnly、Secure、SameSite=Lax Cookie；OAuth 与邮件回跳使用 PKCE。不要将 Supabase service-role key、Google Client Secret 或 SMTP 凭据放入前端、仓库或日志。

原有 ChatGPT 账户入口仍保留。平台身份与 Supabase 使用不同稳定 ID，不按客户端提交的邮箱自动合并旧账户。托管环境必须正确保护平台身份请求头，迁移要求见部署文档。

## 源码交接

本次导入来自 2026-10-10 的已发布版本 15，源提交 `ed96c713fcca944f373a2c86f6ea7a9b48af8186`。产品代码与页面保留该版本；交接新增了文档、CI、忽略规则，以及不绑定托管项目也能本地构建的支持。

仓库不包含线上密钥、用户数据库、当前站点绑定或生成的 `dist/`。上传和合并源码不会自动迁移线上账户、数据库、域名或站点所有权，也不会触发生产部署。

新增迁移时运行 `npm run db:generate`，不要修改已部署迁移。代码回退与数据库恢复分别处理，不应因回退页面而删除生产数据表。
