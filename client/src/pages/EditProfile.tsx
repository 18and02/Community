import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronLeft, Loader2, Camera } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function EditProfile() {
  const { user } = useAuth({ redirectOnUnauthenticated: true });
  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocationVal] = useState("");
  const [website, setWebsite] = useState("");
  const [avatar, setAvatar] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: profile, isLoading } = trpc.profile.get.useQuery(
    { userId: user?.id ?? 0 },
    { enabled: !!user?.id }
  );

  useEffect(() => {
    if (profile) {
      setName(profile.name ?? "");
      setBio(profile.bio ?? "");
      setLocationVal(profile.location ?? "");
      setWebsite(profile.website ?? "");
      setAvatar(profile.avatar ?? "");
      setAvatarPreview(profile.avatar ?? "");
    }
  }, [profile]);

  const uploadMutation = trpc.upload.image.useMutation();
  const updateMutation = trpc.profile.update.useMutation({
    onSuccess: () => {
      toast.success("资料更新成功");
      navigate(`/profile/${user?.id}`);
    },
    onError: (err) => {
      toast.error(err.message || "更新失败");
    },
  });

  const handleAvatarUpload = useCallback(
    async (file: File) => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("头像不能超过 5MB");
        return;
      }
      setUploading(true);
      try {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]);
          };
          reader.readAsDataURL(file);
        });

        setAvatarPreview(URL.createObjectURL(file));

        const result = await uploadMutation.mutateAsync({
          base64,
          mimeType: file.type,
          fileName: file.name,
        });
        setAvatar(result.url);
      } catch {
        toast.error("头像上传失败");
      } finally {
        setUploading(false);
      }
    },
    [uploadMutation]
  );

  const handleSave = useCallback(() => {
    updateMutation.mutate({
      name: name.trim() || undefined,
      avatar: avatar || undefined,
      bio: bio.trim() || undefined,
      location: location.trim() || undefined,
      website: website.trim() || undefined,
    });
  }, [name, avatar, bio, location, website, updateMutation]);

  if (!user) return null;

  return (
    <main className="container max-w-xl py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          返回
        </button>
        <h1 className="font-serif text-xl font-semibold">编辑资料</h1>
        <div className="w-16" />
      </div>

      <div className="space-y-8">
        {/* Avatar */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
              <AvatarImage src={avatarPreview || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-semibold">
                {name?.charAt(0)?.toUpperCase() || user?.name?.charAt(0)?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-colors"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleAvatarUpload(e.target.files[0]);
                e.target.value = "";
              }
            }}
          />
          <p className="text-xs text-muted-foreground mt-2">点击更换头像</p>
        </div>

        {/* Form fields */}
        <div className="space-y-5">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">昵称</label>
            <Input
              placeholder="你的昵称"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              className="rounded-xl border-border/60 focus:border-primary h-11"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">个人简介</label>
            <Textarea
              placeholder="介绍一下你自己..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={500}
              className="min-h-[100px] rounded-xl border-border/60 focus:border-primary resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">{bio.length}/500</p>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">所在地</label>
            <Input
              placeholder="例如：上海"
              value={location}
              onChange={(e) => setLocationVal(e.target.value)}
              maxLength={100}
              className="rounded-xl border-border/60 focus:border-primary h-11"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">个人网站</label>
            <Input
              placeholder="https://example.com"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              maxLength={255}
              className="rounded-xl border-border/60 focus:border-primary h-11"
            />
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-4">
          <Button
            size="lg"
            className="rounded-full px-10"
            onClick={handleSave}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                保存中...
              </>
            ) : (
              "保存修改"
            )}
          </Button>
        </div>
      </div>
    </main>
  );
}
