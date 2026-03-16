import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImagePlus, X, Loader2, ChevronLeft } from "lucide-react";
import { useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export default function CreatePost() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const [, navigate] = useLocation();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<{ url: string; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = trpc.upload.image.useMutation();
  const createPostMutation = trpc.post.create.useMutation({
    onSuccess: (data) => {
      toast.success("帖子发布成功！");
      navigate(`/post/${data.id}`);
    },
    onError: (err) => {
      toast.error(err.message || "发布失败，请重试");
    },
  });

  const handleImageUpload = useCallback(
    async (files: FileList) => {
      if (images.length + files.length > 9) {
        toast.error("最多上传 9 张图片");
        return;
      }

      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          if (file.size > 10 * 1024 * 1024) {
            toast.error(`${file.name} 超过 10MB 限制`);
            continue;
          }

          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.split(",")[1]);
            };
            reader.readAsDataURL(file);
          });

          const preview = URL.createObjectURL(file);
          const result = await uploadMutation.mutateAsync({
            base64,
            mimeType: file.type,
            fileName: file.name,
          });

          setImages((prev) => [...prev, { url: result.url, preview }]);
        }
      } catch (err) {
        toast.error("图片上传失败");
      } finally {
        setUploading(false);
      }
    },
    [images.length, uploadMutation]
  );

  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(() => {
    if (!title.trim()) {
      toast.error("请输入标题");
      return;
    }
    createPostMutation.mutate({
      title: title.trim(),
      content: content.trim() || undefined,
      images: images.map((img) => img.url),
    });
  }, [title, content, images, createPostMutation]);

  if (!user) return null;

  return (
    <main className="container max-w-2xl py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          返回
        </button>
        <h1 className="font-serif text-xl font-semibold">发布新帖子</h1>
        <div className="w-16" />
      </div>

      <div className="space-y-6">
        {/* Image upload area */}
        <div>
          <label className="text-sm font-medium text-foreground mb-3 block">
            图片 <span className="text-muted-foreground font-normal">（最多 9 张）</span>
          </label>
          <div className="grid grid-cols-3 gap-3">
            <AnimatePresence>
              {images.map((img, i) => (
                <motion.div
                  key={img.url}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="relative aspect-square rounded-xl overflow-hidden group"
                >
                  <img
                    src={img.preview}
                    alt={`Upload ${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>

            {images.length < 9 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="aspect-square rounded-xl border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-colors"
              >
                {uploading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    <ImagePlus className="h-6 w-6" />
                    <span className="text-xs">添加图片</span>
                  </>
                )}
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                handleImageUpload(e.target.files);
                e.target.value = "";
              }
            }}
          />
        </div>

        {/* Title */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            标题 <span className="text-destructive">*</span>
          </label>
          <Input
            placeholder="给你的帖子起个标题..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            className="rounded-xl border-border/60 focus:border-primary h-12 text-base"
          />
          <p className="text-xs text-muted-foreground mt-1 text-right">
            {title.length}/200
          </p>
        </div>

        {/* Content */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            正文 <span className="text-muted-foreground font-normal">（可选）</span>
          </label>
          <Textarea
            placeholder="分享你的故事、想法或经验..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[160px] rounded-xl border-border/60 focus:border-primary resize-none text-base leading-relaxed"
          />
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-4">
          <Button
            size="lg"
            className="rounded-full px-10 gap-2"
            onClick={handleSubmit}
            disabled={createPostMutation.isPending || !title.trim()}
          >
            {createPostMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                发布中...
              </>
            ) : (
              "发布帖子"
            )}
          </Button>
        </div>
      </div>
    </main>
  );
}
