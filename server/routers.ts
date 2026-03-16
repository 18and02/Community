import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { nanoid } from "nanoid";
import { storagePut } from "./storage";
import * as db from "./db";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Upload ─────────────────────────────────────────────────
  upload: router({
    image: protectedProcedure
      .input(
        z.object({
          base64: z.string(),
          mimeType: z.string().refine((v) => v.startsWith("image/"), "Must be an image"),
          fileName: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.base64, "base64");
        const ext = input.mimeType.split("/")[1] || "jpg";
        const fileKey = `community/${ctx.user.id}/${nanoid()}.${ext}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);
        return { url, key: fileKey };
      }),
  }),

  // ─── Posts ──────────────────────────────────────────────────
  post: router({
    create: protectedProcedure
      .input(
        z.object({
          title: z.string().min(1).max(200),
          content: z.string().optional(),
          images: z.array(z.string().url()).max(9),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const coverImage = input.images.length > 0 ? input.images[0] : null;
        const postId = await db.createPost({
          userId: ctx.user.id,
          title: input.title,
          content: input.content ?? null,
          coverImage,
        });
        if (input.images.length > 0) {
          await db.createPostImages(
            input.images.map((url, i) => ({
              postId,
              imageUrl: url,
              sortOrder: i,
            }))
          );
        }
        return { id: postId };
      }),

    feed: publicProcedure
      .input(
        z.object({
          limit: z.number().min(1).max(50).default(20),
          offset: z.number().min(0).default(0),
        })
      )
      .query(async ({ ctx, input }) => {
        const items = await db.getPostsFeed(input.limit, input.offset);
        const total = await db.getTotalPostsCount();

        // Enrich with user info and images
        const enriched = await Promise.all(
          items.map(async (post) => {
            const [user, images, profile] = await Promise.all([
              db.getUserById(post.userId),
              db.getPostImages(post.id),
              db.getProfileByUserId(post.userId),
            ]);
            return {
              ...post,
              author: user
                ? { id: user.id, name: user.name, avatar: profile?.avatar ?? null }
                : null,
              images: images.map((img) => img.imageUrl),
            };
          })
        );

        // Check if current user liked these posts
        let likedPostIds: number[] = [];
        if (ctx.user) {
          likedPostIds = await db.getUserLikes(
            ctx.user.id,
            "post",
            items.map((p) => p.id)
          );
        }

        return {
          items: enriched.map((p) => ({
            ...p,
            liked: likedPostIds.includes(p.id),
          })),
          total,
          hasMore: input.offset + input.limit < total,
        };
      }),

    detail: publicProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      const post = await db.getPostById(input.id);
      if (!post) return null;

      const [user, images, profile] = await Promise.all([
        db.getUserById(post.userId),
        db.getPostImages(post.id),
        db.getProfileByUserId(post.userId),
      ]);

      let liked = false;
      if (ctx.user) {
        const likedIds = await db.getUserLikes(ctx.user.id, "post", [post.id]);
        liked = likedIds.includes(post.id);
      }

      return {
        ...post,
        author: user ? { id: user.id, name: user.name, avatar: profile?.avatar ?? null } : null,
        images: images.map((img) => img.imageUrl),
        liked,
      };
    }),

    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const post = await db.getPostById(input.id);
      if (!post) throw new Error("Post not found");
      if (post.userId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new Error("Not authorized");
      }
      await db.deletePost(input.id);
      return { success: true };
    }),

    byUser: publicProcedure
      .input(
        z.object({
          userId: z.number(),
          limit: z.number().min(1).max(50).default(20),
          offset: z.number().min(0).default(0),
        })
      )
      .query(async ({ ctx, input }) => {
        const items = await db.getPostsByUserId(input.userId, input.limit, input.offset);
        const total = await db.getPostsCountByUserId(input.userId);

        const enriched = await Promise.all(
          items.map(async (post) => {
            const images = await db.getPostImages(post.id);
            return {
              ...post,
              images: images.map((img) => img.imageUrl),
            };
          })
        );

        let likedPostIds: number[] = [];
        if (ctx.user) {
          likedPostIds = await db.getUserLikes(
            ctx.user.id,
            "post",
            items.map((p) => p.id)
          );
        }

        return {
          items: enriched.map((p) => ({
            ...p,
            liked: likedPostIds.includes(p.id),
          })),
          total,
          hasMore: input.offset + input.limit < total,
        };
      }),
  }),

  // ─── Comments ───────────────────────────────────────────────
  comment: router({
    create: protectedProcedure
      .input(
        z.object({
          postId: z.number(),
          content: z.string().min(1).max(1000),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const id = await db.createComment({
          postId: input.postId,
          userId: ctx.user.id,
          content: input.content,
        });
        return { id };
      }),

    list: publicProcedure
      .input(
        z.object({
          postId: z.number(),
          limit: z.number().min(1).max(50).default(20),
          offset: z.number().min(0).default(0),
        })
      )
      .query(async ({ ctx, input }) => {
        const items = await db.getCommentsByPostId(input.postId, input.limit, input.offset);

        const enriched = await Promise.all(
          items.map(async (comment) => {
            const [user, profile] = await Promise.all([
              db.getUserById(comment.userId),
              db.getProfileByUserId(comment.userId),
            ]);
            return {
              ...comment,
              author: user
                ? { id: user.id, name: user.name, avatar: profile?.avatar ?? null }
                : null,
            };
          })
        );

        let likedCommentIds: number[] = [];
        if (ctx.user) {
          likedCommentIds = await db.getUserLikes(
            ctx.user.id,
            "comment",
            items.map((c) => c.id)
          );
        }

        return enriched.map((c) => ({
          ...c,
          liked: likedCommentIds.includes(c.id),
        }));
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number(), postId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteComment(input.id, input.postId);
        return { success: true };
      }),
  }),

  // ─── Likes ──────────────────────────────────────────────────
  like: router({
    toggle: protectedProcedure
      .input(
        z.object({
          targetType: z.enum(["post", "comment"]),
          targetId: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        return db.toggleLike(ctx.user.id, input.targetType, input.targetId);
      }),
  }),

  // ─── User Profile ──────────────────────────────────────────
  profile: router({
    get: publicProcedure.input(z.object({ userId: z.number() })).query(async ({ input }) => {
      const [user, profile, postsCount] = await Promise.all([
        db.getUserById(input.userId),
        db.getProfileByUserId(input.userId),
        db.getPostsCountByUserId(input.userId),
      ]);
      if (!user) return null;
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        avatar: profile?.avatar ?? null,
        bio: profile?.bio ?? null,
        location: profile?.location ?? null,
        website: profile?.website ?? null,
        postsCount,
      };
    }),

    update: protectedProcedure
      .input(
        z.object({
          avatar: z.string().optional(),
          bio: z.string().max(500).optional(),
          location: z.string().max(100).optional(),
          website: z.string().max(255).optional(),
          name: z.string().min(1).max(50).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        // Update user name if provided
        if (input.name) {
          const dbInstance = await db.getDb();
          if (dbInstance) {
            const { users } = await import("../drizzle/schema");
            const { eq } = await import("drizzle-orm");
            await dbInstance.update(users).set({ name: input.name }).where(eq(users.id, ctx.user.id));
          }
        }
        // Upsert profile
        await db.upsertProfile({
          userId: ctx.user.id,
          avatar: input.avatar ?? null,
          bio: input.bio ?? null,
          location: input.location ?? null,
          website: input.website ?? null,
        });
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
