import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Heart, MessageCircle, MapPin, Globe, Calendar, Settings, ImagePlus } from "lucide-react";
import { Link, useParams } from "wouter";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

function PostCard({ post, index }: { post: any; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link href={`/post/${post.id}`}>
        <div className="group cursor-pointer overflow-hidden rounded-2xl bg-card border border-border/50 shadow-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1">
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
          <div className="p-4">
            <h3 className="text-sm font-semibold leading-snug text-card-foreground line-clamp-2 mb-2 group-hover:text-primary transition-colors">
              {post.title}
            </h3>
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
      </Link>
    </motion.div>
  );
}

export default function Profile() {
  const params = useParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  const userId = parseInt(params.id ?? "0");
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data: profile, isLoading: profileLoading } = trpc.profile.get.useQuery(
    { userId },
    { enabled: userId > 0 }
  );

  const { data: postsData, isLoading: postsLoading } = trpc.post.byUser.useQuery(
    { userId, limit, offset: page * limit },
    { enabled: userId > 0 }
  );

  const isOwner = currentUser?.id === userId;
  const postsList = postsData?.items ?? [];

  // Masonry columns
  const columns = useMemo(() => {
    const cols: any[][] = [[], []];
    postsList.forEach((post, i) => {
      cols[i % 2].push({ ...post, originalIndex: i });
    });
    return cols;
  }, [postsList]);

  if (profileLoading) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="flex flex-col items-center gap-4 mb-10">
          <Skeleton className="h-24 w-24 rounded-full" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container max-w-4xl py-20 text-center">
        <p className="text-muted-foreground mb-4">用户不存在</p>
        <Link href="/">
          <Button variant="outline" className="rounded-full">
            返回首页
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <main className="container max-w-4xl py-8">
      {/* Profile header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center text-center mb-10"
      >
        <Avatar className="h-24 w-24 mb-4 border-4 border-background shadow-lg">
          <AvatarImage src={profile.avatar ?? undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-2xl font-semibold">
            {profile.name?.charAt(0)?.toUpperCase() ?? "U"}
          </AvatarFallback>
        </Avatar>

        <h1 className="font-serif text-2xl font-bold text-foreground mb-1">
          {profile.name ?? "匿名用户"}
        </h1>

        {profile.bio && (
          <p className="text-muted-foreground max-w-md leading-relaxed mt-2">{profile.bio}</p>
        )}

        <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
          {profile.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {profile.location}
            </span>
          )}
          {profile.website && (
            <a
              href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-primary transition-colors"
            >
              <Globe className="h-3.5 w-3.5" />
              网站
            </a>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {format(new Date(profile.createdAt), "yyyy年M月加入", { locale: zhCN })}
          </span>
        </div>

        <div className="flex items-center gap-6 mt-5">
          <div className="text-center">
            <p className="text-xl font-bold text-foreground">{profile.postsCount}</p>
            <p className="text-xs text-muted-foreground">帖子</p>
          </div>
        </div>

        {isOwner && (
          <Link href="/settings/profile">
            <Button variant="outline" size="sm" className="rounded-full gap-2 mt-5">
              <Settings className="h-4 w-4" />
              编辑资料
            </Button>
          </Link>
        )}
      </motion.div>

      {/* Posts grid */}
      {postsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl bg-card border border-border/50">
              <Skeleton className="aspect-[4/3] w-full" />
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : postsList.length === 0 ? (
        <div className="py-16 text-center">
          <ImagePlus className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground mb-2">
            {isOwner ? "你还没有发布帖子" : "该用户还没有发布帖子"}
          </p>
          {isOwner && (
            <Link href="/create">
              <Button variant="outline" className="rounded-full mt-2">
                发布第一篇帖子
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Desktop 3-col masonry */}
          <div className="hidden md:grid md:grid-cols-3 gap-4">
            {(() => {
              const cols: any[][] = [[], [], []];
              postsList.forEach((post, i) => {
                cols[i % 3].push({ ...post, originalIndex: i });
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
          {/* Mobile 2-col */}
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
              >
                上一页
              </Button>
            )}
            {postsData?.hasMore && (
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => setPage((p) => p + 1)}
              >
                下一页
              </Button>
            )}
          </div>
        </>
      )}
    </main>
  );
}
