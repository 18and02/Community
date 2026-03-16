import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, MessageCircle, Compass, ImagePlus } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function PostCard({ post, index }: { post: any; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link href={`/post/${post.id}`}>
        <div className="group cursor-pointer overflow-hidden rounded-2xl bg-card border border-border/50 shadow-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1">
          {/* Cover Image */}
          {post.coverImage && (
            <div className="relative aspect-[4/3] overflow-hidden">
              <img
                src={post.coverImage}
                alt={post.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
              {post.images && post.images.length > 1 && (
                <div className="absolute top-3 right-3 rounded-full bg-black/50 px-2.5 py-1 text-xs text-white backdrop-blur-sm">
                  {post.images.length} 图
                </div>
              )}
            </div>
          )}

          {/* Content */}
          <div className="p-4">
            <h3 className="text-sm font-semibold leading-snug text-card-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors">
              {post.title}
            </h3>
            {post.content && (
              <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                {post.content}
              </p>
            )}

            {/* Author & Stats */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={post.author?.avatar ?? undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                    {post.author?.name?.charAt(0)?.toUpperCase() ?? "U"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                  {post.author?.name ?? "匿名"}
                </span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground">
                <span className="flex items-center gap-1 text-xs">
                  <Heart className={`h-3.5 w-3.5 ${post.liked ? "fill-red-500 text-red-500" : ""}`} />
                  {post.likesCount > 0 && post.likesCount}
                </span>
                <span className="flex items-center gap-1 text-xs">
                  <MessageCircle className="h-3.5 w-3.5" />
                  {post.commentsCount > 0 && post.commentsCount}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function PostSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl bg-card border border-border/50">
      <Skeleton className="aspect-[4/3] w-full" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { isAuthenticated } = useAuth();
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data, isLoading, isFetching } = trpc.post.feed.useQuery(
    { limit, offset: page * limit },
    { placeholderData: (prev) => prev }
  );

  const posts = data?.items ?? [];
  const hasMore = data?.hasMore ?? false;

  // Split posts into columns for masonry layout
  const columns = useMemo(() => {
    const cols: any[][] = [[], []];
    posts.forEach((post, i) => {
      cols[i % 2].push({ ...post, originalIndex: i });
    });
    return cols;
  }, [posts]);

  return (
    <main className="container py-6">
      {/* Hero section - only show when no posts or first visit */}
      {!isLoading && posts.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
            <Compass className="h-10 w-10 text-primary" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-foreground mb-3">
            欢迎来到 Community
          </h1>
          <p className="text-muted-foreground max-w-md mb-8 leading-relaxed">
            一个分享生活、发现灵感的社群平台。在这里记录你的精彩瞬间，与志同道合的人交流互动。
          </p>
          {isAuthenticated ? (
            <Link href="/create">
              <Button size="lg" className="rounded-full gap-2 px-8">
                <ImagePlus className="h-5 w-5" />
                发布第一篇帖子
              </Button>
            </Link>
          ) : (
            <Button
              size="lg"
              className="rounded-full px-8"
              onClick={() => {
                window.location.href = getLoginUrl();
              }}
            >
              立即加入
            </Button>
          )}
        </motion.div>
      )}

      {/* Loading skeletons */}
      {isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <PostSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Masonry grid */}
      {!isLoading && posts.length > 0 && (
        <>
          <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-4 gap-4">
            {(() => {
              const cols: any[][] = [[], [], [], []];
              posts.forEach((post, i) => {
                cols[i % 4].push({ ...post, originalIndex: i });
              });
              return cols.map((col, colIdx) => (
                <div key={colIdx} className="flex flex-col gap-4">
                  {col.map((post: any) => (
                    <PostCard key={post.id} post={post} index={post.originalIndex} />
                  ))}
                </div>
              ));
            })()}
          </div>
          <div className="grid grid-cols-2 gap-3 md:hidden">
            {columns.map((col, colIdx) => (
              <div key={colIdx} className="flex flex-col gap-3">
                {col.map((post: any) => (
                  <PostCard key={post.id} post={post} index={post.originalIndex} />
                ))}
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-4 mt-10">
            {page > 0 && (
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => setPage((p) => p - 1)}
                disabled={isFetching}
              >
                上一页
              </Button>
            )}
            {hasMore && (
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => setPage((p) => p + 1)}
                disabled={isFetching}
              >
                {isFetching ? "加载中..." : "下一页"}
              </Button>
            )}
          </div>
        </>
      )}
    </main>
  );
}
