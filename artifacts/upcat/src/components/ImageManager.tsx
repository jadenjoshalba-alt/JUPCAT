import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, Download, ImagePlus, Globe, Loader2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/apiUrl";
import { resolveImageUrl } from "@/lib/imageResolver";

interface ImageInfo {
  filename: string;
  relativePath: string;
  importStatement: string;
}

export default function ImageManager() {
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [selectedImage, setSelectedImage] = useState<ImageInfo | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  const apiUrl = getApiUrl();

  const fetchImages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/images`);
      if (res.ok) {
        const data = await res.json();
        setImages(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  const handleFileUpload = async () => {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await fetch(`${apiUrl}/images/upload`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        toast({
          title: "Image uploaded",
          description: `Saved as ${data.filename}`,
        });
        setFile(null);
        fetchImages();
      } else {
        const err = await res.json();
        toast({
          title: "Upload failed",
          description: err.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Upload failed",
        description: "Network error",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleUrlDownload = async () => {
    if (!imageUrl.trim()) return;
    setDownloading(true);
    try {
      const res = await fetch(`${apiUrl}/images/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: imageUrl.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        toast({
          title: "Image downloaded",
          description: `Saved as ${data.filename}`,
        });
        setImageUrl("");
        fetchImages();
      } else {
        const err = await res.json();
        toast({
          title: "Download failed",
          description: err.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Download failed",
        description: "Network error",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard", description: text });
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" /> Upload Image
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <Button
              onClick={handleFileUpload}
              disabled={!file || uploading}
              className="shrink-0"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4" />
              )}
              Upload
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Accepted formats: JPEG, PNG, GIF, WebP, SVG. Max size: 10 MB.
          </p>
        </CardContent>
      </Card>

      {/* Download from URL Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" /> Download from URL
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Input
              placeholder="https://example.com/image.png"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
            />
            <Button
              onClick={handleUrlDownload}
              disabled={!imageUrl.trim() || downloading}
              className="shrink-0"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Paste a direct image URL and the app will download it into the images folder.
          </p>
        </CardContent>
      </Card>

      {/* Image Gallery */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImagePlus className="h-5 w-5" /> Uploaded Images
            <span className="text-sm font-normal text-muted-foreground">
              ({images.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading...
            </div>
          ) : images.length === 0 ? (
            <p className="text-muted-foreground">
              No images uploaded yet.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {images.map((img) => (
                <div
                  key={img.filename}
                  className="border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedImage(img)}
                >
                  <img
                    src={resolveImageUrl(img.relativePath)}
                    alt={img.filename}
                    className="w-full h-32 object-contain rounded border mb-2"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "";
                      (e.target as HTMLImageElement).alt = "Failed to load";
                    }}
                  />
                  <p className="text-xs font-mono truncate">{img.filename}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {img.relativePath}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedImage?.filename}</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="space-y-4">
              <img
                src={resolveImageUrl(selectedImage.relativePath)}
                alt={selectedImage.filename}
                className="w-full max-h-[300px] object-contain border rounded-lg"
              />
              <div className="space-y-2">
                <div className="text-sm font-medium">Relative Path (for quiz data):</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted p-2 rounded text-sm font-mono">
                    {selectedImage.relativePath}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(selectedImage.relativePath)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Import Statement (for code):</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted p-2 rounded text-sm font-mono">
                    {selectedImage.importStatement}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(selectedImage.importStatement)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Use the relative path in your quiz JSON&apos;s{" "}
                <code className="bg-muted px-1 rounded">imageUrl</code> field.
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
