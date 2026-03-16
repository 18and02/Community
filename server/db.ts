import { eq, desc, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  posts,
  postImages,
  comments,
  likes,
  userProfiles,
  type InsertPost,
  type InsertPostImage,
  type InsertComment,
  type InsertUserProfile,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── User helpers ───────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── User Profile helpers ───────────────────────────────────────

export async function getProfileByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertProfile(data: InsertUserProfile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .insert(userProfiles)
    .values(data)
    .onDuplicateKeyUpdate({
      set: {
        avatar: data.avatar,
        bio: data.bio,
        location: data.location,
        website: data.website,
      },
    });
}

// ─── Post helpers ───────────────────────────────────────────────

export async function createPost(data: InsertPost) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(posts).values(data);
  return result[0].insertId;
}

export async function createPostImages(images: InsertPostImage[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (images.length === 0) return;
  await db.insert(postImages).values(images);
}

export async function getPostById(postId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getPostImages(postId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(postImages)
    .where(eq(postImages.postId, postId))
    .orderBy(postImages.sortOrder);
}

export async function getPostsFeed(limit: number, offset: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(posts).orderBy(desc(posts.createdAt)).limit(limit).offset(offset);
}

export async function getPostsByUserId(userId: number, limit: number, offset: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(posts)
    .where(eq(posts.userId, userId))
    .orderBy(desc(posts.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getPostsCountByUserId(userId: number) {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(posts)
    .where(eq(posts.userId, userId));
  return result[0]?.count ?? 0;
}

export async function deletePost(postId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Delete related data first
  await db.delete(postImages).where(eq(postImages.postId, postId));
  await db.delete(comments).where(eq(comments.postId, postId));
  await db.delete(likes).where(and(eq(likes.targetType, "post"), eq(likes.targetId, postId)));
  await db.delete(posts).where(eq(posts.id, postId));
}

// ─── Comment helpers ────────────────────────────────────────────

export async function createComment(data: InsertComment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(comments).values(data);
  // Increment post comment count
  await db
    .update(posts)
    .set({ commentsCount: sql`${posts.commentsCount} + 1` })
    .where(eq(posts.id, data.postId));
  return result[0].insertId;
}

export async function getCommentsByPostId(postId: number, limit: number, offset: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(comments)
    .where(eq(comments.postId, postId))
    .orderBy(desc(comments.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function deleteComment(commentId: number, postId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(likes).where(and(eq(likes.targetType, "comment"), eq(likes.targetId, commentId)));
  await db.delete(comments).where(eq(comments.id, commentId));
  // Decrement post comment count
  await db
    .update(posts)
    .set({ commentsCount: sql`GREATEST(${posts.commentsCount} - 1, 0)` })
    .where(eq(posts.id, postId));
}

// ─── Like helpers ───────────────────────────────────────────────

export async function toggleLike(userId: number, targetType: "post" | "comment", targetId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await db
    .select()
    .from(likes)
    .where(
      and(eq(likes.userId, userId), eq(likes.targetType, targetType), eq(likes.targetId, targetId))
    )
    .limit(1);

  if (existing.length > 0) {
    // Unlike
    await db.delete(likes).where(eq(likes.id, existing[0].id));
    // Decrement count
    if (targetType === "post") {
      await db
        .update(posts)
        .set({ likesCount: sql`GREATEST(${posts.likesCount} - 1, 0)` })
        .where(eq(posts.id, targetId));
    } else {
      await db
        .update(comments)
        .set({ likesCount: sql`GREATEST(${comments.likesCount} - 1, 0)` })
        .where(eq(comments.id, targetId));
    }
    return { liked: false };
  } else {
    // Like
    await db.insert(likes).values({ userId, targetType, targetId });
    if (targetType === "post") {
      await db
        .update(posts)
        .set({ likesCount: sql`${posts.likesCount} + 1` })
        .where(eq(posts.id, targetId));
    } else {
      await db
        .update(comments)
        .set({ likesCount: sql`${comments.likesCount} + 1` })
        .where(eq(comments.id, targetId));
    }
    return { liked: true };
  }
}

export async function getUserLikes(userId: number, targetType: "post" | "comment", targetIds: number[]) {
  const db = await getDb();
  if (!db) return [];
  if (targetIds.length === 0) return [];
  const result = await db
    .select()
    .from(likes)
    .where(
      and(
        eq(likes.userId, userId),
        eq(likes.targetType, targetType),
        sql`${likes.targetId} IN (${sql.join(
          targetIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      )
    );
  return result.map((l) => l.targetId);
}

export async function getTotalPostsCount() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` }).from(posts);
  return result[0]?.count ?? 0;
}
