# Community 社群

一个优雅的社群分享平台，灵感源自小红书，让用户可以通过图文帖子分享生活、发现灵感、互动交流。

![Community 首页预览](https://d2xsxph8kpxj0f.cloudfront.net/310519663283085174/GJx6GEXgNVdeSYzcnkDLAv/community-preview_bd7f32ca.png)

---

## 项目简介

Community 是一个全栈社群平台，采用现代化的技术栈构建。平台以**瀑布流卡片布局**呈现图文内容，用户可以注册登录后发布帖子、上传图片、评论互动和点赞收藏。整体设计风格以温暖的玫瑰色为主色调，搭配 Playfair Display 衬线标题字体与 Inter 无衬线正文字体，营造出优雅精致的视觉体验。

项目前后端一体化开发，前端使用 React 19 + Tailwind CSS 4 构建响应式界面，后端基于 Express + tRPC 提供类型安全的 API，数据存储使用 MySQL，图片文件托管于 S3 兼容的对象存储服务。

---

## 功能特性

| 功能模块 | 说明 |
|---------|------|
| **用户认证** | 基于 OAuth 的登录注册系统，支持会话持久化，可替换为自建认证 |
| **图文发帖** | 支持上传最多 9 张图片，配合标题和正文内容发布帖子 |
| **瀑布流浏览** | 首页以响应式瀑布流卡片布局展示所有帖子，桌面端 4 列、移动端 2 列 |
| **帖子详情** | 图片轮播画廊、完整正文展示、作者信息与互动操作 |
| **评论系统** | 用户可以对帖子发表评论，支持 Ctrl+Enter 快捷发送 |
| **点赞功能** | 支持对帖子和评论分别点赞/取消点赞，实时更新计数 |
| **个人主页** | 展示用户头像、简介、所在地、个人网站和发布的帖子列表 |
| **资料编辑** | 用户可上传头像、修改昵称、填写个人简介等资料信息 |
| **管理功能** | 管理员和帖子作者可以删除帖子和评论 |

---

## 技术栈

### 前端

| 技术 | 用途 |
|-----|------|
| React 19 | UI 框架 |
| Tailwind CSS 4 | 原子化样式 |
| tRPC Client | 类型安全的 API 调用 |
| TanStack Query | 服务端状态管理与缓存 |
| Framer Motion | 页面过渡与微交互动效 |
| shadcn/ui | 基础 UI 组件库 |
| Wouter | 轻量路由 |
| date-fns | 日期格式化（中文本地化） |

### 后端

| 技术 | 用途 |
|-----|------|
| Express 4 | HTTP 服务器 |
| tRPC 11 | 类型安全的 RPC 框架 |
| Drizzle ORM | 数据库 ORM 与迁移管理 |
| MySQL / TiDB | 关系型数据库 |
| S3 兼容存储 | 图片文件存储 |
| Zod | 输入验证 |
| Vitest | 单元测试 |

---

## 项目结构

```
community/
├── client/                  # 前端代码
│   ├── src/
│   │   ├── components/      # 可复用组件（Navbar、shadcn/ui）
│   │   ├── pages/           # 页面组件
│   │   │   ├── Home.tsx     # 首页瀑布流
│   │   │   ├── PostDetail.tsx   # 帖子详情 + 评论
│   │   │   ├── CreatePost.tsx   # 发布帖子
│   │   │   ├── Profile.tsx      # 个人主页
│   │   │   └── EditProfile.tsx  # 编辑资料
│   │   ├── lib/trpc.ts      # tRPC 客户端绑定
│   │   ├── App.tsx          # 路由与布局
│   │   └── index.css        # 全局主题与配色
│   └── index.html
├── server/                  # 后端代码
│   ├── routers.ts           # tRPC 路由（帖子、评论、点赞、上传、资料）
│   ├── db.ts                # 数据库查询 helpers
│   ├── storage.ts           # S3 文件存储
│   └── community.test.ts    # 单元测试（19 个用例）
├── drizzle/                 # 数据库 Schema 与迁移
│   └── schema.ts            # 表定义（users, posts, comments, likes 等）
├── shared/                  # 前后端共享常量与类型
├── DEPLOY.md                # 自建服务器部署指南
└── package.json
```

---

## 数据库设计

项目包含以下核心数据表：

| 表名 | 说明 | 关键字段 |
|------|------|---------|
| `users` | 用户表 | id, openId, name, email, role |
| `user_profiles` | 用户资料扩展 | userId, avatar, bio, location, website |
| `posts` | 帖子表 | userId, title, content, coverImage, likesCount, commentsCount |
| `post_images` | 帖子图片 | postId, imageUrl, sortOrder |
| `comments` | 评论表 | postId, userId, content, likesCount |
| `likes` | 点赞表（多态） | userId, targetType(post/comment), targetId |

---

## 快速开始

### 环境要求

确保你的开发环境已安装 Node.js 18+ 和 pnpm，并且有一个可用的 MySQL 数据库实例。

### 安装与运行

```bash
# 克隆项目
git clone https://github.com/18and02/Community.git
cd Community

# 安装依赖
pnpm install

# 配置环境变量（参考 DEPLOY.md 中的说明）
cp .env.example .env
# 编辑 .env 填入数据库连接、JWT 密钥等配置

# 执行数据库迁移
mysql -u your_user -p your_database < drizzle/0000_bouncy_hardball.sql
mysql -u your_user -p your_database < drizzle/0001_robust_proemial_gods.sql

# 启动开发服务器
pnpm dev

# 运行测试
pnpm test
```

开发服务器启动后，访问 `http://localhost:3000` 即可看到社群首页。

### 生产构建

```bash
pnpm build
node dist/index.js
```

---

## 部署

项目附带了完整的自建服务器部署指南，详见 [DEPLOY.md](./DEPLOY.md)，涵盖以下内容：

| 章节 | 内容 |
|------|------|
| 环境准备 | Node.js、MySQL 安装与配置 |
| 认证替换 | 将 OAuth 替换为用户名/密码本地认证的完整方案 |
| 存储替换 | 接入 AWS S3 或自建 MinIO 对象存储 |
| Nginx 配置 | 反向代理与静态资源服务 |
| SSL 证书 | Let's Encrypt 免费 HTTPS 配置 |
| 域名绑定 | DNS 记录配置说明 |
| 运维监控 | PM2 守护进程、日志查看与数据库备份 |

---

## 测试

项目包含 19 个单元测试用例，覆盖所有核心后端 API：

```bash
pnpm test
```

测试覆盖范围包括帖子的创建与查询、评论的发布与列表、点赞的切换、用户资料的读写、图片上传的权限校验，以及未认证用户的访问拦截等场景。

---

## 许可证

MIT License
