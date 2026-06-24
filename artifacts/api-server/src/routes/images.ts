import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const router: IRouter = Router();

const IMAGES_DIR = path.resolve(process.cwd(), "..", "upcat", "public", "images");

// Ensure images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, IMAGES_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|svg/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) {
      cb(null, true);
    } else {
      cb(new Error("Only images (jpeg, jpg, png, gif, webp, svg) are allowed"));
    }
  },
});

// ── Helpers ──

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
}

function extractExtensionFromUrl(url: string): string {
  const cleanUrl = url.split("?")[0];
  const ext = path.extname(cleanUrl).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return ".jpg";
  if (ext === ".png") return ".png";
  if (ext === ".gif") return ".gif";
  if (ext === ".webp") return ".webp";
  if (ext === ".svg") return ".svg";
  return ".png";
}

/**
 * Gemini sometimes sends URLs like:
 * https://www.google.com/search?q=https://upload.wikimedia.org/...
 * Extract the actual image URL from the query parameter.
 */
function cleanGoogleSearchUrl(url: string): string {
  if (!url) return "";
  // Check if it's a Google search URL wrapping another URL
  if (url.includes("google.com/search?q=")) {
    const qIndex = url.indexOf("q=");
    if (qIndex !== -1) {
      const rawQuery = url.slice(qIndex + 2);
      // URL-decode the query
      const decoded = decodeURIComponent(rawQuery.split("&")[0]);
      if (decoded.startsWith("http://") || decoded.startsWith("https://")) {
        return decoded;
      }
    }
  }
  return url;
}

async function downloadImage(url: string, filepath: string): Promise<boolean> {
  try {
    const response = await fetch(url, { redirect: "follow" });
    if (!response.ok) return false;

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/") && !contentType.includes("octet-stream")) {
      return false;
    }

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(filepath, Buffer.from(buffer));
    return true;
  } catch {
    return false;
  }
}

// ── List uploaded images ──
router.get("/images", (_req, res) => {
  try {
    const files = fs.existsSync(IMAGES_DIR)
      ? fs
          .readdirSync(IMAGES_DIR)
          .filter((f) => /\.(jpe?g|png|gif|webp|svg)$/i.test(f))
          .map((filename) => ({
            filename,
            relativePath: `images/${filename}`,
            importStatement: `import ${filename
              .replace(/\.[^.]+$/, "")
              .replace(/[^a-zA-Z0-9]/g, "_")} from "@/assets/${filename}";`,
          }))
      : [];
    res.json(files);
  } catch (err) {
    res.status(500).json({ error: "Failed to list images" });
  }
});

// ── Upload image file ──
router.post("/images/upload", upload.single("image"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No image file provided" });
    return;
  }
  const filename = req.file.filename;
  res.json({
    filename,
    relativePath: `images/${filename}`,
    importStatement: `import ${filename
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9]/g, "_")} from "@/assets/${filename}";`,
  });
});

// ── Download single image from URL ──
router.post("/images/download", async (req, res) => {
  const { url } = req.body as { url?: string };
  if (!url) {
    res.status(400).json({ error: "URL is required" });
    return;
  }

  const cleanUrl = cleanGoogleSearchUrl(url.trim());
  if (!cleanUrl) {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  const ext = extractExtensionFromUrl(cleanUrl);
  const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
  const filename = `downloaded-${uniqueSuffix}${ext}`;
  const filepath = path.join(IMAGES_DIR, filename);

  const success = await downloadImage(cleanUrl, filepath);
  if (!success) {
    res.status(400).json({ error: "Failed to download image. URL may not be a direct image link." });
    return;
  }

  res.json({
    filename,
    relativePath: `images/${filename}`,
    importStatement: `import ${filename
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9]/g, "_")} from "@/assets/${filename}";`,
  });
});

// ── Bulk download images with custom names ──
router.post("/images/bulk-download", async (req, res) => {
  const { mapping } = req.body as { mapping?: Record<string, string> };
  if (!mapping || typeof mapping !== "object" || Object.keys(mapping).length === 0) {
    res.status(400).json({ error: "Mapping is required (e.g., { 'q1': 'https://...' })" });
    return;
  }

  const results: Array<{ key: string; filename: string | null; error: string | null }> = [];

  for (const [key, rawUrl] of Object.entries(mapping)) {
    const cleanUrl = cleanGoogleSearchUrl(rawUrl.trim());
    if (!cleanUrl) {
      results.push({ key, filename: null, error: "Invalid URL" });
      continue;
    }

    const ext = extractExtensionFromUrl(cleanUrl);
    const safeName = sanitizeFilename(key);
    const filename = `${safeName}${ext}`;
    const filepath = path.join(IMAGES_DIR, filename);

    // Remove existing file with same name
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    const success = await downloadImage(cleanUrl, filepath);
    if (success) {
      results.push({ key, filename, error: null });
    } else {
      results.push({ key, filename: null, error: "Failed to download" });
    }
  }

  const succeeded = results.filter((r) => r.filename);
  const failed = results.filter((r) => r.error);

  res.json({
    results,
    summary: {
      total: results.length,
      success: succeeded.length,
      failed: failed.length,
    },
  });
});

// ── Delete an image ──
router.delete("/images/:filename", (req, res) => {
  const { filename } = req.params;
  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    res.status(400).json({ error: "Invalid filename" });
    return;
  }

  const filepath = path.join(IMAGES_DIR, filename);
  if (!fs.existsSync(filepath)) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  try {
    fs.unlinkSync(filepath);
    res.json({ deleted: true, filename });
  } catch {
    res.status(500).json({ error: "Failed to delete file" });
  }
});

export default router;
