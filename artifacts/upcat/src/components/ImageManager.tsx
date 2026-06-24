import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Copy,
  Download,
  ImagePlus,
  Globe,
  Loader2,
  Upload,
  Trash2,
  Package,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/apiUrl";
import { resolveImageUrl } from "@/lib/imageResolver";

interface ImageInfo {
  filename: string;
  relativePath: string;
  importStatement: string;
}

interface BulkResult {
  key: string;
  filename: string | null;
  error: string | null;
}

export default function ImageManager() {
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [selectedImage, setSelectedImage] = useState<ImageInfo | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
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

  const parseBulkText = (text: string): Record<string, string> => {
    const mapping: Record<string, string> = {};
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      // Try "key": "url"  (JSON-like)
      const jsonMatch = line.match(/^"?([^"]+)"?\s*:\s*"?(https?:\/\/[^"]+)"?$/);
      if (jsonMatch) {
        mapping[jsonMatch[1]] = jsonMatch[2];
        continue;
      }
      // Try key: "url" (without quotes around key)
      const colonMatch = line.match(/^([^\s:]+)\s*:\s*"?(https?:\/\/[^"]+)"?$/);
      if (colonMatch) {
        mapping[colonMatch[1]] = colonMatch[2];
        continue;
      }
      // Try key, url (CSV-like)
      const csvMatch = line.match(/^([^,]+),\s*(https?:\/\/[^,\s]+)$/);
      if (csvMatch) {
        mapping[csvMatch[1].trim()] = csvMatch[2].trim();
      }
    }
    return mapping;
  };

  const handleBulkDownload = async () => {
    const mapping = parseBulkText(bulkText);
    if (Object.keys(mapping).length === 0) {
      toast({
        title: "No valid entries",
        description: "Paste entries in format: question_id: \"https://...\"",
        variant: "destructive",
      });
      return;
    }
    setBulkLoading(true);
    setBulkResults(null);
    try {
      const res = await fetch(`${apiUrl}/images/bulk-download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapping }),
      });
      const data = await res.json();
      if (res.ok) {
        setBulkResults(data.results);
        toast({
          title: "Bulk download complete",
          description: `${data.summary.success} succeeded, ${data.summary.failed} failed`,
        });
        fetchImages();
      } else {
        toast({
          title: "Bulk download failed",
          description: data.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Bulk download failed",
        description: "Network error",
        variant: "destructive",
      });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleDelete = async (filename: string) => {
    setDeleting(filename);
    try {
      const res = await fetch(`${apiUrl}/images/${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast({ title: "Image deleted", description: filename });
        fetchImages();
        if (selectedImage?.filename === filename) {
          setSelectedImage(null);
        }
      } else {
        const err = await res.json();
        toast({
          title: "Delete failed",
          description: err.error || "Unknown error",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Delete failed",
        description: "Network error",
        variant: "destructive",
      });
    } finally {
      setDeleting(null);
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
            Paste a direct image URL. The app also handles Google Search wrapper URLs.
          </p>
        </CardContent>
      </Card>

      {/* Bulk Download Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" /> Bulk Download
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder={`Paste mappings here:
math_geo_042: "https://upload.wikimedia.org/..."
math_geo_043: "https://..."
science_bio_001: "https://..."

Or use CSV format:
math_geo_042, https://upload.wikimedia.org/...`}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={8}
          />
          <div className="flex items-center gap-4">
            <Button
              onClick={handleBulkDownload}
              disabled={bulkLoading || !bulkText.trim()}
              className="shrink-0"
            >
              {bulkLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Download All
            </Button>
            {bulkResults && (
              <span className="text-sm text-muted-foreground">
                {bulkResults.filter((r) => r.filename).length} succeeded,{" "}
                {bulkResults.filter((r) => r.error).length} failed
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Images are saved with the exact question ID as filename (e.g.,{" "}
            <code>images/math_geo_042.png</code>). Use the question ID in your
            quiz JSON&apos;s <code>imageUrl</code> field.
          </p>
          {/* Bulk results */}
          {bulkResults && (
            <div className="border rounded-lg p-3 space-y-1 max-h-48 overflow-y-auto">
              {bulkResults.map((r) => (
                <div
                  key={r.key}
                  className="flex items-center gap-2 text-sm"
                >
                  {r.filename ? (
                    <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                  )}
                  <span className="font-mono text-xs">{r.key}</span>
                  <span className="text-muted-foreground">
                    {r.filename ? `→ ${r.filename}` : r.error}
                  </span>
                </div>
              ))}
            </div>
          )}
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
                  className="border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors group relative"
                  onClick={() => setSelectedImage(img)}
                >
                  <img
                    src={resolveImageUrl(img.relativePath)}
                    alt={img.filename}
                    className="w-full h-32 object-contain rounded border mb-2"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <p className="text-xs font-mono truncate">
                    {img.filename}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {img.relativePath}
                  </p>
                  {/* Delete button */}
                  <button
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-500 text-white p-1 rounded-md hover:bg-red-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(img.filename);
                    }}
                    title="Delete"
                  >
                    {deleting === img.filename ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </button>
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
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedImage?.filename}</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={() => selectedImage && handleDelete(selectedImage.filename)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="space-y-4">
              <img
                src={resolveImageUrl(selectedImage.relativePath)}
                alt={selectedImage.filename}
                className="w-full max-h-[300px] object-contain border rounded-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
              <div className="space-y-2">
                <div className="text-sm font-medium">
                  Relative Path (for quiz data):
                </div>
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
                <div className="text-sm font-medium">
                  Import Statement (for code):
                </div>
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
