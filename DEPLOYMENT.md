# GrowthHub 独立部署

## 目标与当前进度

目标域名 `https://growthhub.dev`，公司 Cloudflare 账号 Natively Labs, Inc.。网站程序使用 Workers Static Assets + Worker，社区数据使用独立 D1，邮箱及 Google 登录继续使用原 Supabase 项目。

截至 2026-10-12：独立站已部署至公司 Cloudflare，14 张业务表迁移及远端恢复核对完成。Dynadot 名称服务器已保存为公司 Cloudflare 分配的地址，注册局 RDAP 已确认；旧 Sites 自定义域名绑定已移除并通过列表为空核实。独立 Worker 已关闭维护模式。用户确认电脑端可打开；已在 Safari 看见正式域名下的真实资源列表。

当前 Worker 版本：`06f5dc42-10e0-495d-8c12-b8cd9799a391`（精简未登录首页）。上一可回退版本：`dc4c3b4e-ab62-4058-a69e-7b4d53c569da`（拱门配图版本）。已验证迁移快照 SHA-256：`b34cdc1a9a6e6bf2b6456b753c14fc4e93092722f6df9a4ff482d296686770d3`。私有快照及 SQL 保存在工作区 `outputs/growthhub-migration/verified/`，不提交仓库。

新权威解析地址的 HTTPS 检查通过：首页、初始化接口、真实资源详情均返回 200；Skill 下载包 47,390 字节，与仓库文件 SHA-256 一致；未登录账户导出返回 401，源码及环境文件路径返回 404。Google 入口返回 303 至原 Supabase 授权地址，回跳为 `https://growthhub.dev/api/auth/callback`，PKCE cookie 为 Secure / HttpOnly / SameSite=Lax。用户随后确认电脑访问正常、手机 Google 登录成功。邮箱流程、两账户私有写入与完整业务验收仍待完成。使用电脑现有代理正常访问正式域名的初始化接口也返回 200。直连命令行递归 DNS 仍缓存旧 A 记录；定点检查使用新权威记录且正常验证 TLS，没有关闭证书校验。

旧站冻结版本为 Sites v17，提交 `f810415b33dcabde717777ca44c20f75ea39136a`，环境修订 4（`MIGRATION_READ_ONLY=true`），2026-10-12 00:27（Asia/Shanghai）部署成功。公开读取及已有会话的数据导出仍可用；新增写入和认证请求返回迁移提示。冻结核对报告在 `outputs/growthhub-migration/`。如取消切换，可将该开关改回 `false` 并重新部署同一旧站版本；若新库已接收写入，必须先核对增量。

## 域名切换记录

- 原名称服务器：`ns1.dyna-ns.net`、`ns2.dyna-ns.net`；已备份原完整 DNS。
- 现名称服务器：`leland.ns.cloudflare.com`、`mary.ns.cloudflare.com`。用户明确确认后保存；注册局记录的变更时间为 2026-10-12 00:32:30（Asia/Shanghai）。
- 公司区域已移除导入的旧 A `172.66.3.26`、`162.159.143.30`；现由 `growthhub.dev → growthhub` Worker 绑定生成解析。核验时权威 A 为 `104.21.57.22`、`172.67.140.157`，不要将这些动态地址硬编码为部署配置。
- 原 Sites 自定义域名 `appgdom_6acb3c91cce88191beada51a6b4e7b38` 已移除；旧网站及数据库保留用于恢复，但禁止写入。
- 原 Dynadot 无邮箱、其他子域名或 DNSSEC 配置。旧 `_cf-custom-hostname` TXT 暂留待清理，不再存在对应 Sites 域名绑定。
- 本轮没有变更网站域名或 Supabase 项目，所以 Google / Supabase 登录回跳地址保持不变。用户已确认真实手机 Google 登录成功。

## 配置

`wrangler.jsonc` 固定公司账号、Worker 名称、D1 数据库 ID，关闭 workers.dev 与预览网址。`/api/*` 与明确列出的页面路由进入 Worker；发现页、资源详情、话题、作者和认证页面输出完整 HTML。指纹静态资源直接由 Assets 服务处理。`npm run deploy` 先校验目标，避免误发到公司其他项目。

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

`npm run build` 生成带内容指纹的 JS/CSS 与 `dist/assets/`，并生成用于回归检查的独立 Worker 包。Cloudflare 实际发布入口是 `worker/index.js` 与 `dist/assets/`，发布前自动构建，不使用 Sites 绑定。`html_handling: none` 保证 Worker 可以读取 HTML 模板而不触发静态地址重定向。

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

## 2026-10-12 交互与渲染更新

- 退出成功后清空身份、弹窗、个人详情和请求缓存；中断旧请求，以会话版本阻止迟到响应恢复个人界面。跨标签退出事件与浏览器历史快照恢复也会重新核对身份。
- 页面首个响应包含真实内容和安全转义的初始化 JSON；页面 HTML 为 `private, no-store`，不对登录态做跨用户共享缓存。Supabase token 不进入页面数据。
- 新分享链接为 `/resources/:id`；旧 `#repo/:id` 链接仍兼容。旧链接的 fragment 不会发给服务器，首次打开旧链接仍可能需要一次详情请求。
- 详情在当前会话内保留 60 秒，最多 12 项；页面空闲时预加载前两个可见资源，指针、聚焦或触摸也可触发，最多两个并行预取。省流量或 2G 网络不预取。退出立即清空。
- 收藏使用即时反馈，一次写入，不再额外读取整份社区；失败回滚。详情标签切换复用一次读取的内容。
- 一个指纹 CSS 和一个 JS；长期缓存仅用于指纹资源。移除旧入口的多份样式/脚本网络请求。
- 本地检查：55 项测试、12 项发布产物检查、恢复演练、Cloudflare 构建通过。实际浏览器检查 320、390、1440 像素布局，手机账户退出、标签取消筛选、详情和登录页；未替用户执行新的真实账户注册或内容写入。

自评：页面结构、字号层级、退出一致性和请求数量已改善，主要页面可以在 JavaScript 执行前显示内容。当前只有一份公开资源，列表密度受真实内容数量限制；不以补造内容提升观感。仍需真实多地区网络和多成员使用反馈，不能把本地快速响应等同于所有网络下的速度保证。

发布后核验：正式域名首页、资源详情和登录页均返回 200，HTML 已带真实内容；指纹资产返回一年缓存策略。现有网络经代理单次测得首页约 1.60 秒、详情约 1.02 秒、登录页约 0.84 秒完成响应，仅是本次样本，未代表真实多地区统计。Skill 下载校验和一致，匿名账户导出为 401、环境文件路径为 404。Google 入口继续回跳 growthhub.dev 的原认证回调。


## 2026-10-12 visual and motion update

The community uses GitHub Explore's stable navigation and resource/actions hierarchy, Product Hunt's resource presentation, and DEV's cover-led content reading as references. The installed Notion DESIGN.md was also inspected for card geometry; GrowthHub retains its own green identity and Primer semantic foundations. Reference pages: https://github.com/explore, https://www.producthunt.com/, https://dev.to/.

Discovery now presents real resource metadata in a code-native publication cover with a spine, layered pages, topic icon, and author. Topics use tangible tinted tiles. Detail reuses the same artwork and provides a keyboard-accessible table of contents. No invented resource, author, count, endorsement, or results was added. Existing route and data contracts are unchanged.

Motion includes bounded pointer tilt, expanding cover sheets, 3px card hover lift, short entrance transitions, saved-star feedback, and a floating mobile navigation bar. Pointer handling coalesces events through requestAnimationFrame, disables tilt for touch/coarse pointers and reduced-motion, and resets on exit, preference change, and page hide. Cover float runs three short cycles, not indefinitely. All content is visible before JavaScript; no new external image/font request or animation dependency was introduced.

Browser verification: desktop 1440px; mobile 390px and 320px with no document overflow. Cover hover was observed in the real browser (3px lift and live perspective variables); detail TOC moved focus to the actual heading without changing routes; browser error/warning logs were empty. Tests include pointer batching/reset, reduced-motion and touch behavior, accessible TOC navigation, and headings inside fenced code blocks. Visual review found and fixed entrance animation fill overriding hover transforms. Current content volume remains one published resource; the design does not fill it with fabricated content.

Published Worker version: `8a7ba5b6-c16b-426e-a920-e3ec80b09004`. Post-deploy homepage and the real Skill detail returned 200; both contain the new SSR artwork/TOC and fingerprinted assets. The local preview bar is absent from production. 59 tests and 12 compiled release checks passed; Cloudflare dry run passed. Previous release for rollback: `05afa5ab-4c74-4e8d-934e-d80fec2979fb`.

## 登录前封面（2026-10-12）

访客访问 `/` 获取服务端直出的品牌封面；已登录用户访问 `/` 返回私有、不可缓存的 303 至 `/discover`。发现页保持免登录浏览。旧 `#explore`、`/?topic=…` 筛选以及全部资源 ID 链接保持兼容。

参考 Profound 的视觉留白与 GitHub、Product Hunt 的公共社区入口，使用原创绿色雕塑主视觉，下方仅展示已发布的真实资源。主视觉移动版约 104 KB、桌面版约 327 KB，带尺寸、优先加载和版本化缓存；减弱动态设置关闭入场与视差动效。生成说明和最终提示词保存在 `design/landing-art-direction.txt`。

验收：62 项 Node 测试、12 项编译产物检查及 Cloudflare dry-run 通过；桌面 1440、手机 390/320 无横向溢出，手机主按钮首屏可见，验证封面到发现/登录及分类跳转。正式 `/`、`/discover` 返回 200，新图片正确返回 image/jpeg 与 immutable 缓存；正式 HTML 已核对新指纹和真实 Skill。未改数据库、账号权限或第三方登录配置。


## 封面内容与层级调整（2026-10-12，第二版）

撤掉用户否定的原创雕塑与口号式文案，首页改为「增长从业者的开放资源库」。已发布资源的标题、简介、作者、话题、更新时间直接出现在服务端 HTML 中，完整资源和讨论入口连接真实记录；「查看全部」包含所有资源类型。删除原 327 KB 桌面主图与 104 KB 手机主图，封面不再加载图片。入场只做短距离位移，不将可读内容设为透明；悬停与减少动态设置均保留。

登录/注册继续使用用户选定的统一森林绿背景和内嵌卡片，与封面统一品牌字标、标题措辞、字号层级和按钮圆角；手机表单使用 16px 输入字号与 48px 主按钮。邮箱、Google、邀请权限及回调地址均保持原流程。

验证：62 项测试及 12 项编译产物检查通过，Cloudflare dry-run 与正式发布通过。本地实际浏览器检查 1440、390、320 宽度，未见横向溢出；核对封面到真实讨论页、返回首页、注册/登录的跳转，以及 Google/邮箱控件。浏览器错误/警告日志为空。正式首页、登录、注册通过 HTTP 核对新指纹和完整 HTML，线上 CSS 与发布产物逐字节一致，带一年缓存。内置浏览器的远程加载超时，视觉截图来自同版本本地构建；本次没有重新执行用户的第三方身份验证。

发布版本：`821a9b03-0acf-4e12-a01a-53871e3346fd`；上一版本：`ca9a9600-e9c1-496f-9c32-9c03da7e24b9`。没有数据库迁移或第三方认证配置变更。设计依据与自查见 `design/landing-art-direction.txt`。

## 社区首页与认证底纹（2026-10-12，第三版）

首页改为社区简介与注册入口，角色参考 GitHub 首页，样式保持 GrowthHub 自有配色。撤掉「开放资源库」标题和具体成员帖子，真实内容仅在发现页呈现。横向介绍区用原生 details 展开功能说明，右侧进入 Skills、心得与工具分类，手机自动堆叠；已登录用户仍直接进入发现页。

登录/注册沿用用户选择的统一森林绿背景与内嵌表单卡片。增加原创植物线描和细纸纹，压淡正文背后的细节，表单为不透明底色。电脑背景约 138 KB，手机约 55 KB，版本化图片长期缓存，不阻塞表单首屏。图片提示词、来源和文件路径记录在 design/landing-art-direction.txt。

验收：62 项测试、12 项编译产物检查、Cloudflare dry-run 通过。实际浏览器核对 1440、390、320 布局，无横向溢出，原生展开/键盘收起、注册/登录/首页/找回密码跳转正常；手机输入 16px，Google 和邮箱入口保留，Apple 不展示。浏览器错误/警告日志为空。本次没有重复第三方身份验证或生产数据写入。

正式首页、登录、注册均返回 200 并包含新服务端 HTML，正式 CSS 和两张背景图与本地发布产物逐字节一致；图片正确返回 image/jpeg 和一年 immutable 缓存。HTML 仍为 private, no-store。视觉截图来自同一发布版本的本地浏览器，不包含新认证成功声明。

发布版本：`52bf67a3-fbe1-4be7-bc61-86232087ef58`；上一版本：`821a9b03-0acf-4e12-a01a-53871e3346fd`。没有数据库迁移、DNS 或第三方登录配置变更。


## 恢复早期拱门与绿球配图（2026-10-12，第四版）

用户明确选回早期浅色拱门与绿球图片。首页改为社区介绍与原图并列，登录/注册在统一森林绿背景下展示原图和独立表单卡片；手机上下排列，并避免过度裁切拱门。复用现有 900×600 JPEG（109,424 字节），声明尺寸、启用缓存，没有增加图像生成或动画依赖。移除认证页植物底纹引用；未上线的增长线条方案仅留在忽略的 outputs 归档中。

62 项测试、12 项编译产物检查、Cloudflare dry-run 通过。实际浏览器检查 1440、390、320 宽度，图片加载、无横向溢出、首页/注册/登录跳转及介绍展开正常。CSS 调整后重新构建并复查窄屏裁切。线上首页、登录、注册返回完整新版 HTML；线上 CSS 与图片和本地发布产物逐字节相同，本地预览条不出现在生产。视觉截图保存于 outputs/growthhub-arches-*.png，来自同版本地构建。

发布版本：`dc4c3b4e-ab62-4058-a69e-7b4d53c569da`。无数据库、认证逻辑、域名或第三方登录配置变更；没有重复执行第三方身份验证。

## 2026-10-12 精简未登录首页

根据用户最新的 GitHub 首屏参考，移除主页拱门配图、社区介绍段落和功能展开区。保留居中标题、注册与浏览入口以及简洁导航；手机采用两行标题。认证页在本次修改中保持原样，历史版本 A–F 仅整理为本地对照图供选择。

- 62 项现有测试、12 项编译产物检查及 Cloudflare dry-run 通过。
- 实际浏览器核对 1440px 桌面、390px 和 320px 手机布局，未出现横向溢出；注册、登录、回首页和浏览入口正常。
- 生产网页已在浏览器呈现新版首页，错误与警告日志为空。线上完整 HTML 和指纹 CSS 与当前版本核对；登录、注册仍提供 Google 和邮箱入口。本次未重新执行第三方身份验证。
- 发布版本：`06f5dc42-10e0-495d-8c12-b8cd9799a391`；JS `/assets/app-ZZEO36Y5.js`；CSS `/assets/product-ffa05c6c0984.css`。
- 未修改数据库、账户配置或 DNS。线上截图与历史版本对照保存在忽略目录 `outputs/`。
