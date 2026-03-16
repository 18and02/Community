# Community 社群平台 - 自建服务器部署指南

本文档详细说明如何将 Community 社群平台部署到你自己的服务器上，并绑定自定义域名。

---

## 一、服务器环境要求

| 项目 | 最低要求 | 推荐配置 |
|------|---------|---------|
| 操作系统 | Ubuntu 20.04+ / CentOS 8+ | Ubuntu 22.04 LTS |
| Node.js | 18.x | 22.x LTS |
| 内存 | 1GB | 2GB+ |
| 磁盘 | 10GB | 20GB+ |
| 数据库 | MySQL 8.0+ | MySQL 8.0 或 TiDB |

---

## 二、安装基础环境

### 2.1 安装 Node.js

```bash
# 使用 NodeSource 安装 Node.js 22.x
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 pnpm
npm install -g pnpm
```

### 2.2 安装 MySQL

```bash
sudo apt-get install -y mysql-server
sudo mysql_secure_installation

# 创建数据库和用户
sudo mysql -e "CREATE DATABASE community CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER 'community'@'localhost' IDENTIFIED BY 'your_secure_password';"
sudo mysql -e "GRANT ALL PRIVILEGES ON community.* TO 'community'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"
```

---

## 三、部署项目

### 3.1 克隆代码

```bash
cd /opt
git clone https://github.com/18and02/Community.git community
cd community
```

### 3.2 安装依赖

```bash
pnpm install
```

### 3.3 配置环境变量

创建 `.env` 文件：

```bash
cat > .env << 'EOF'
# 数据库连接（必填）
DATABASE_URL=mysql://community:your_secure_password@localhost:3306/community

# JWT 密钥（必填，请生成一个随机字符串）
JWT_SECRET=your_random_jwt_secret_at_least_32_chars

# 服务端口
PORT=3000

# 生产模式
NODE_ENV=production

# ===== 用户认证相关（需要自行实现或替换） =====
# 当前项目使用 Manus OAuth，如果你要在自己的服务器上运行，
# 你需要替换认证系统。以下是两种方案：

# 方案 A：保留 Manus OAuth（需要 Manus 平台支持）
# VITE_APP_ID=your_manus_app_id
# OAUTH_SERVER_URL=https://api.manus.im
# VITE_OAUTH_PORTAL_URL=https://manus.im

# 方案 B：替换为自建认证系统（推荐）
# 参见下方"自建认证系统"章节

# ===== 文件存储（需要替换） =====
# 当前使用 Manus 内置 S3 代理，自建部署需要配置自己的 S3
# BUILT_IN_FORGE_API_URL=your_s3_api_url
# BUILT_IN_FORGE_API_KEY=your_s3_api_key
# 或者替换 server/storage.ts 为直接使用 AWS S3 / MinIO
EOF
```

### 3.4 初始化数据库

将 `drizzle/` 目录下的 SQL 迁移文件按顺序执行：

```bash
# 执行初始迁移
mysql -u community -p community < drizzle/0000_bouncy_hardball.sql
mysql -u community -p community < drizzle/0001_robust_proemial_gods.sql
```

### 3.5 构建项目

```bash
pnpm build
```

### 3.6 启动服务

```bash
# 直接启动
node dist/index.js

# 或使用 PM2 守护进程（推荐）
npm install -g pm2
pm2 start dist/index.js --name community
pm2 save
pm2 startup
```

---

## 四、自建认证系统（替换 Manus OAuth）

当前项目使用 Manus OAuth 进行用户认证。要在自己的服务器上独立运行，你需要替换认证模块。以下是推荐方案：

### 4.1 方案：使用用户名/密码认证

你需要修改以下文件：

**1. 修改 `drizzle/schema.ts`**，给 users 表添加密码字段：

```typescript
// 在 users 表中添加
passwordHash: varchar("passwordHash", { length: 255 }),
```

**2. 创建 `server/localAuth.ts`**，实现注册和登录逻辑：

```typescript
import bcrypt from "bcryptjs";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { eq } from "drizzle-orm";

export async function registerUser(email: string, password: string, name: string) {
  const db = await getDb();
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await db.insert(users).values({
    openId: `local_${email}`, // 用 email 作为唯一标识
    email,
    name,
    passwordHash,
    loginMethod: "local",
  });
  return result[0].insertId;
}

export async function loginUser(email: string, password: string) {
  const db = await getDb();
  const [user] = await db.select().from(users)
    .where(eq(users.email, email)).limit(1);
  if (!user || !user.passwordHash) return null;
  const valid = await bcrypt.compare(password, user.passwordHash);
  return valid ? user : null;
}
```

**3. 修改 `server/_core/index.ts`**，添加本地认证路由：

```typescript
// 在 registerOAuthRoutes(app) 之后添加
app.post("/api/auth/register", async (req, res) => { /* ... */ });
app.post("/api/auth/login", async (req, res) => { /* ... */ });
```

**4. 修改前端登录页面**，将 OAuth 跳转替换为登录表单。

### 4.2 安装额外依赖

```bash
pnpm add bcryptjs
pnpm add -D @types/bcryptjs
```

---

## 五、替换文件存储（S3）

当前项目使用 Manus 内置的 S3 代理。自建部署需要替换为你自己的对象存储。

### 5.1 方案 A：使用 AWS S3

修改 `server/storage.ts`：

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_BUCKET || "community-uploads";

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
) {
  const key = relKey.replace(/^\/+/, "");
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: typeof data === "string" ? Buffer.from(data) : data,
    ContentType: contentType,
  }));
  const url = `https://${BUCKET}.s3.amazonaws.com/${key}`;
  return { key, url };
}

export async function storageGet(relKey: string) {
  const key = relKey.replace(/^\/+/, "");
  const url = await getSignedUrl(s3, new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }), { expiresIn: 3600 });
  return { key, url };
}
```

### 5.2 方案 B：使用 MinIO（自建 S3 兼容存储）

```bash
# 安装 MinIO
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
sudo mv minio /usr/local/bin/

# 启动 MinIO
MINIO_ROOT_USER=admin MINIO_ROOT_PASSWORD=password minio server /data/minio
```

环境变量配置：

```bash
AWS_ACCESS_KEY_ID=admin
AWS_SECRET_ACCESS_KEY=password
AWS_REGION=us-east-1
S3_BUCKET=community-uploads
S3_ENDPOINT=http://localhost:9000  # MinIO 地址
```

---

## 六、配置 Nginx 反向代理

```bash
sudo apt-get install -y nginx
```

创建 Nginx 配置文件 `/etc/nginx/sites-available/community`：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/community /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 七、配置 SSL 证书（HTTPS）

使用 Let's Encrypt 免费证书：

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

证书会自动续期。

---

## 八、域名绑定

1. 在你的域名注册商（如阿里云、Cloudflare）添加 DNS A 记录，指向你服务器的公网 IP
2. 将 Nginx 配置中的 `server_name` 改为你的域名
3. 运行 certbot 获取 SSL 证书

| DNS 记录类型 | 主机记录 | 记录值 |
|-------------|---------|-------|
| A | @ | 你的服务器 IP |
| A | www | 你的服务器 IP |

---

## 九、维护与监控

```bash
# 查看应用日志
pm2 logs community

# 重启应用
pm2 restart community

# 查看应用状态
pm2 status

# 数据库备份
mysqldump -u community -p community > backup_$(date +%Y%m%d).sql
```

---

## 十、常见问题

**Q: 如何修改网站标题和 Logo？**
修改 `client/index.html` 中的 `<title>` 标签，以及 `client/src/components/Navbar.tsx` 中的 Logo 文字。修改后重新执行 `pnpm build`。

**Q: 如何添加管理员？**
直接在数据库中修改用户的 role 字段：
```sql
UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';
```

**Q: 图片上传失败？**
检查 S3/MinIO 配置是否正确，确保存储桶已创建且有写入权限。

**Q: 如何更新代码？**
```bash
cd /opt/community
git pull origin main
pnpm install
pnpm build
pm2 restart community
```
