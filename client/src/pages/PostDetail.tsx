import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Heart,
  MessageCircle,
  ChevronLeft,
  Send,
  Trash2,
  ChevronRight,
} from "lucide-react";
import { Link, useParams, useLocation } from "wouter";
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import { toast } from "sonner";

function ImageGallery({ images }: { images: string[] }) {
  const [current, setCurrent] = useState(0);

  if (images.length === 0) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black/5">
      <div className="relative aspect-[4/3] md:aspect-[16/10]">
        <AnimatePresence mode="wait">
          <motion.img
            key={current}
            src={images[current]}
            alt={`Image ${current + 1}`}
            className="absolute inset-0 h-full w-full object-contain"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
        </AnimatePresence>
      </div>

      {images.length > 1 && (
        <>
          <button
            onClick={() => setCurrent((c) => (c - 1 + images.length) % images.length)}
            className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 shadow-md backdrop-blur-sm transition-all hover:bg-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => setCurrent((c) => (c + 1) % images.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 shadow-md backdrop-blur-sm transition-all hover:bg-white"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-2 rounded-full transition-all ${
                  i === current ? "w-6 bg-white" : "w-2 bg-white/50"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CommentItem({
  comment,
  currentUserId,
  onDelete,
}: {
  comment: any;
  currentUserId?: number;
  onDelete: (id: number) => void;
}) {
  const utils = trpc.useUtils();
  const likeMutation = trpc.like.toggle.useMutation({
    onSuccess: () => {
      utils.comment.list.invalidate();
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex gap-3 py-4"
    >
      <Link href={`/profile/${comment.author?.id}`}>
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={comment.author?.avatar ?? undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs">
            {comment.author?.name?.charAt(0)?.toUpperCase() ?? "U"}
          </AvatarFallback>
        </Avatar>
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Link href={`/profile/${comment.author?.id}`}>
            <span className="text-sm font-medium text-foreground hover:text-primary transition-colors">
              {comment.author?.name ?? "匿名"}
            </span>
          </Link>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(comment.createdAt), {
              addSuffix: true,
              locale: zhCN,
            })}
          </span>
        </div>
        <p className="text-sm text-foreground/90 leading-relaxed">{comment.content}</p>
        <div className="flex items-center gap-4 mt-2">
          <button
            onClick={() =>
              likeMutation.mutate({ targetType: "comment", targetId: comment.id })
            }
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <Heart
              className={`h-3.5 w-3.5 ${
                comment.liked ? "fill-red-500 text-red-500" : ""
              }`}
            />
            {comment.likesCount > 0 && comment.likesCount}
          </button>
          {currentUserId === comment.author?.id && (
            <button
              onClick={() => onDelete(comment.id)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              删除
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function PostDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [commentText, setCommentText] = useState("");
  const utils = trpc.useUtils();

  const postId = parseInt(params.id ?? "0");

  const { data: post, isLoading } = trpc.post.detail.useQuery(
    { id: postId },
    { enabled: postId > 0 }
  );

  const { data: commentsList } = trpc.comment.list.useQuery(
    { postId, limit: 50, offset: 0 },
    { enabled: postId > 0 }
  );

  const likeMutation = trpc.like.toggle.useMutation({
    onSuccess: () => {
      utils.post.detail.invalidate({ id: postId });
    },
  });

  const commentMutation = trpc.comment.create.useMutation({
    onSuccess: () => {
      setCommentText("");
      utils.comment.list.invalidate({ postId });
      utils.post.detail.invalidate({ id: postId });
      toast.success("评论发布成功");
    },
    onError: () => {
      toast.error("评论发布失败");
    },
  });

  const deleteMutation = trpc.post.delete.useMutation({
    onSuccess: () => {
      toast.success("帖子已删除");
      navigate("/");
    },
  });

  const deleteCommentMutation = trpc.comment.delete.useMutation({
    onSuccess: () => {
      utils.comment.list.invalidate({ postId });
      utils.post.detail.invalidate({ id: postId });
      toast.success("评论已删除");
    },
  });

  const handleComment = useCallback(() => {
    if (!commentText.trim()) return;
    if (!isAuthenticated) {
      window.location.href = getLoginUrl();
      return;
    }
    commentMutation.mutate({ postId, content: commentText.trim() });
  }, [commentText, isAuthenticated, postId, commentMutation]);

  if (isLoading) {
    return (
      <div className="container max-w-3xl py-8">
        <Skeleton className="h-8 w-32 mb-6" />
        <Skeleton className="aspect-[16/10] w-full rounded-2xl mb-6" />
        <Skeleton className="h-6 w-3/4 mb-3" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container max-w-3xl py-20 text-center">
        <p className="text-muted-foreground mb-4">帖子不存在或已被删除</p>
        <Link href="/">
          <Button variant="outline" className="rounded-full">
            返回首页
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <main className="container max-w-3xl py-6">
      {/* Back button */}
      <button
        onClick={() => window.history.back()}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft className="h-4 w-4" />
        返回
      </button>

      {/* Image gallery */}
      {post.images && post.images.length > 0 && (
        <div className="mb-6">
          <ImageGallery images={post.images} />
        </div>
      )}

      {/* Post content */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-foreground mb-4">{post.title}</h1>

        {/* Author info */}
        <div className="flex items-center justify-between mb-6">
          <Link href={`/profile/${post.author?.id}`}>
            <div className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <Avatar className="h-10 w-10">
                <AvatarImage src={post.author?.avatar ?? undefined} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {post.author?.name?.charAt(0)?.toUpperCase() ?? "U"}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{post.author?.name ?? "匿名"}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(post.createdAt), {
                    addSuffix: true,
                    locale: zhCN,
                  })}
                </p>
              </div>
            </div>
          </Link>

          {user && (user.id === post.userId || user.role === "admin") && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => {
                if (confirm("确定要删除这篇帖子吗？")) {
                  deleteMutation.mutate({ id: post.id });
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              删除
            </Button>
          )}
        </div>

        {/* Content text */}
        {post.content && (
          <div className="prose prose-sm max-w-none text-foreground/85 leading-relaxed whitespace-pre-wrap">
            {post.content}
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center gap-6 mt-6 pt-6 border-t border-border/60">
          <button
            onClick={() => {
              if (!isAuthenticated) {
                window.location.href = getLoginUrl();
                return;
              }
              likeMutation.mutate({ targetType: "post", targetId: post.id });
            }}
            className="flex items-center gap-2 text-sm transition-colors hover:text-primary"
          >
            <Heart
              className={`h-5 w-5 transition-all ${
                post.liked
                  ? "fill-red-500 text-red-500 scale-110"
                  : "text-muted-foreground"
              }`}
            />
            <span className={post.liked ? "text-red-500 font-medium" : "text-muted-foreground"}>
              {post.likesCount}
            </span>
          </button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MessageCircle className="h-5 w-5" />
            <span>{post.commentsCount}</span>
          </div>
        </div>
      </div>

      {/* Comments section */}
      <div className="border-t border-border/60 pt-6">
        <h2 className="text-lg font-semibold mb-4">
          评论 {commentsList && commentsList.length > 0 && `(${commentsList.length})`}
        </h2>

        {/* Comment input */}
        <div className="flex gap-3 mb-6">
          {isAuthenticated ? (
            <>
              <Avatar className="h-8 w-8 shrink-0 mt-1">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Textarea
                  placeholder="写下你的评论..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="min-h-[80px] resize-none rounded-xl border-border/60 focus:border-primary"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      handleComment();
                    }
                  }}
                />
                <div className="flex justify-end mt-2">
                  <Button
                    size="sm"
                    className="rounded-full gap-1.5"
                    onClick={handleComment}
                    disabled={!commentText.trim() || commentMutation.isPending}
                  >
                    <Send className="h-3.5 w-3.5" />
                    {commentMutation.isPending ? "发送中..." : "发送"}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="w-full rounded-xl border border-border/60 bg-muted/30 p-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">登录后即可发表评论</p>
              <Button
                size="sm"
                className="rounded-full"
                onClick={() => {
                  window.location.href = getLoginUrl();
                }}
              >
                立即登录
              </Button>
            </div>
          )}
        </div>

        {/* Comments list */}
        <div className="divide-y divide-border/40">
          {commentsList?.map((comment: any) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUserId={user?.id}
              onDelete={(id) =>
                deleteCommentMutation.mutate({ id, postId })
              }
            />
          ))}
        </div>

        {(!commentsList || commentsList.length === 0) && (
          <div className="py-12 text-center">
            <MessageCircle className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">暂无评论，来说点什么吧</p>
          </div>
        )}
      </div>
    </main>
  );
}
