import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockUser(overrides?: Partial<AuthenticatedUser>): AuthenticatedUser {
  return {
    id: 1,
    openId: "test-user-1",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

function createContext(user?: AuthenticatedUser | null): TrpcContext {
  return {
    user: user ?? null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

// Mock the db module
vi.mock("./db", () => {
  const posts: any[] = [];
  const postImages: any[] = [];
  const comments: any[] = [];
  const likes: any[] = [];
  const profiles: any[] = [];
  let nextPostId = 1;
  let nextCommentId = 1;

  return {
    getDb: vi.fn().mockResolvedValue({}),
    createPost: vi.fn().mockImplementation(async (data: any) => {
      const id = nextPostId++;
      posts.push({ id, ...data, likesCount: 0, commentsCount: 0, createdAt: new Date(), updatedAt: new Date() });
      return id;
    }),
    createPostImages: vi.fn().mockResolvedValue(undefined),
    getPostById: vi.fn().mockImplementation(async (id: number) => {
      return posts.find((p) => p.id === id) ?? undefined;
    }),
    getPostImages: vi.fn().mockResolvedValue([]),
    getPostsFeed: vi.fn().mockResolvedValue([]),
    getTotalPostsCount: vi.fn().mockResolvedValue(0),
    getPostsByUserId: vi.fn().mockResolvedValue([]),
    getPostsCountByUserId: vi.fn().mockResolvedValue(0),
    deletePost: vi.fn().mockResolvedValue(undefined),
    createComment: vi.fn().mockImplementation(async (data: any) => {
      const id = nextCommentId++;
      comments.push({ id, ...data, likesCount: 0, createdAt: new Date(), updatedAt: new Date() });
      return id;
    }),
    getCommentsByPostId: vi.fn().mockResolvedValue([]),
    deleteComment: vi.fn().mockResolvedValue(undefined),
    toggleLike: vi.fn().mockResolvedValue({ liked: true }),
    getUserLikes: vi.fn().mockResolvedValue([]),
    getUserById: vi.fn().mockImplementation(async (id: number) => {
      if (id === 1) return createMockUser();
      return undefined;
    }),
    getProfileByUserId: vi.fn().mockResolvedValue(undefined),
    upsertProfile: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/test.jpg", key: "test.jpg" }),
}));

describe("Post procedures", () => {
  it("should create a post when authenticated", async () => {
    const user = createMockUser();
    const ctx = createContext(user);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.post.create({
      title: "Test Post",
      content: "This is a test post",
      images: [],
    });

    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
  });

  it("should reject post creation when not authenticated", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.post.create({
        title: "Test Post",
        content: "This is a test post",
        images: [],
      })
    ).rejects.toThrow();
  });

  it("should reject post creation with empty title", async () => {
    const user = createMockUser();
    const ctx = createContext(user);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.post.create({
        title: "",
        content: "Content",
        images: [],
      })
    ).rejects.toThrow();
  });

  it("should fetch post feed", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.post.feed({ limit: 20, offset: 0 });

    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("hasMore");
    expect(Array.isArray(result.items)).toBe(true);
  });

  it("should return null for non-existent post", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.post.detail({ id: 99999 });
    expect(result).toBeNull();
  });
});

describe("Comment procedures", () => {
  it("should create a comment when authenticated", async () => {
    const user = createMockUser();
    const ctx = createContext(user);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.comment.create({
      postId: 1,
      content: "Great post!",
    });

    expect(result).toHaveProperty("id");
    expect(typeof result.id).toBe("number");
  });

  it("should reject comment creation when not authenticated", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.comment.create({
        postId: 1,
        content: "Great post!",
      })
    ).rejects.toThrow();
  });

  it("should reject empty comment", async () => {
    const user = createMockUser();
    const ctx = createContext(user);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.comment.create({
        postId: 1,
        content: "",
      })
    ).rejects.toThrow();
  });

  it("should list comments for a post", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.comment.list({ postId: 1, limit: 20, offset: 0 });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("Like procedures", () => {
  it("should toggle like when authenticated", async () => {
    const user = createMockUser();
    const ctx = createContext(user);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.like.toggle({
      targetType: "post",
      targetId: 1,
    });

    expect(result).toHaveProperty("liked");
    expect(typeof result.liked).toBe("boolean");
  });

  it("should reject like when not authenticated", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.like.toggle({
        targetType: "post",
        targetId: 1,
      })
    ).rejects.toThrow();
  });
});

describe("Profile procedures", () => {
  it("should get user profile", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.profile.get({ userId: 1 });
    expect(result).not.toBeNull();
    expect(result).toHaveProperty("id", 1);
    expect(result).toHaveProperty("name", "Test User");
  });

  it("should return null for non-existent user profile", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.profile.get({ userId: 99999 });
    expect(result).toBeNull();
  });

  it("should update profile when authenticated", async () => {
    const user = createMockUser();
    const ctx = createContext(user);
    const caller = appRouter.createCaller(ctx);

    const result = await caller.profile.update({
      bio: "Hello world",
      location: "Shanghai",
    });

    expect(result).toEqual({ success: true });
  });

  it("should reject profile update when not authenticated", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.profile.update({
        bio: "Hello world",
      })
    ).rejects.toThrow();
  });
});

describe("Upload procedures", () => {
  it("should upload image when authenticated", async () => {
    const user = createMockUser();
    const ctx = createContext(user);
    const caller = appRouter.createCaller(ctx);

    // Create a small base64 encoded image (1x1 pixel PNG)
    const base64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const result = await caller.upload.image({
      base64,
      mimeType: "image/png",
      fileName: "test.png",
    });

    expect(result).toHaveProperty("url");
    expect(result).toHaveProperty("key");
    expect(typeof result.url).toBe("string");
  });

  it("should reject upload when not authenticated", async () => {
    const ctx = createContext(null);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.upload.image({
        base64: "dGVzdA==",
        mimeType: "image/png",
      })
    ).rejects.toThrow();
  });

  it("should reject non-image mime types", async () => {
    const user = createMockUser();
    const ctx = createContext(user);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.upload.image({
        base64: "dGVzdA==",
        mimeType: "application/pdf",
      })
    ).rejects.toThrow();
  });
});
