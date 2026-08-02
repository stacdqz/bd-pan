# 技术架构与关键模块

## 1. 概览

- `src/app/page.tsx`：Next.js 客户端页面，用 React 状态管理完成登录、AList 文件浏览、上传、下载、预览、管理员面板和新加的“文件控制权限”弹窗；交互全部在浏览器端执行，向后端 API 拉取数据。
- `src/lib/users.ts`：Supabase 读写层，定义角色（`admin`、`manager`、`guest`）、默认权限、基于路径的文件权限规则、权限计算函数、以及用于判断谁有资格操作哪些规则。
- `src/app/api/*`：一组 API 路由代理 AList（阿里盘）操作，并植入权限检测：
  - `alist/route.ts`：代理所有目录列表、搜索、重命名、删除、创建等功能，先计算当前用户的路径权限再发起 AList 请求；搜索结果和目录列表都会过滤掉被屏蔽的项目。
  - `alist-download/route.ts`、`alist-upload/route.ts`：统一走后端代理，任何下载/预览/上传都要经过这里，权限规则在入口即拦。
  - `file-permissions/route.ts`：超级管理员/文件管理权限的用户通过这个接口管理规则，系统会自动只展示、保存 actor 有资格控制的用户和规则。
  - `users/route.ts`：管理用户 CRUD、角色、权限和文件规则（通过 `updateFilePermissionRules` 操作）。

## 2. 权限层级

1. `admin`（超级管理员）：拥有所有权限，能管理 `manager` 和 `guest` 角色的文件规则、设置全局状态。
2. `manager`（管理员）：具备上传/下载/管理权限（视 `users.ts` 里配置信息），只能为 `guest` 及 `guest` 账号设置路径级规则。
3. `guest`（游客）：仅浏览/下载（视原始权限），不能进入文件规则编辑界面。`guest` 包含显式注册的 `guest` 账号和匿名游客。
4. `controlFile` 是超级管理员可单独赋予的标记，控制某个用户是否能打开“文件控制权限”弹窗。

## 3. 文件权限规则

- 规则结构 `FilePermissionRule` 包含路径、类型（`file`或`dir`）、用户列表、以及禁止动作集合（view、download、preview、upload、rename、delete、search）。
- 路径规则在 `lib/users.ts` 通过 `getEffectivePermissionsForPath` 计算作用到某个文件/目录上的最终权限，管理接口使用 `ruleMatchesTarget` 做匹配。
- 前端“文件权限”弹窗：会区分单文件 vs 文件夹；选单个文件时只允许禁止视图/下载/预览/重命名/删除/搜索，上传选项仅在文件夹模式出现；还展示当前角色可管理的用户（按 `canAssignFilePermissionTarget` 限制）。
- 规则提交时，后端只保留当前操作者有资格管理的用户（例如 `manager` 不能篡改另一个 `manager`、`admin` 或其规则）。

## 4. 前后端交互

- 登录：页面向 `/api/login` 请求 token，缓存 `BDPAN_*` 本地状态；后续 AList 请求附带 token。
- 目录操作：`alist/route.ts` 先对路径加上用户 `basePath`，再进行权限校验（越过 `view`/`download`/`preview` 等 ）；列表和搜索结果在返回前显式去掉被禁止的项。
- 下载/预览：统一使用 `/api/alist-download`；窗口中所有按钮（直连、代理）都调用 `alistProxyDownload`，保证触发权限判断。
- 文件规则界面：打开时调用 `/api/file-permissions`（只返回当前角色可见的 users/rules），保存时调用同一路径同时过滤不符合条件的规则和用户。

## 5. 开发注意

1. 所有新增后端路由必须验证 `verifyToken`/`canManageFilePermissions` 并透明记录失败原因以便调试。
2. 文件权限的 `deny` 条目目前只会“禁止”操作，不做“授予”。需要新增权限时需从 `getUserPermissions` 里的默认权限扩展。
3. 若需支持“按分组批量规则”可在 `Group name` 字段中增加解释，并在前端展示“分组一览”。
4. 构建时请避开 `.next` 目录；`tech.md` 只需要描述核心逻辑即可，不要重复 README。

---  
更新于：2026 年 4 月 6 日  
