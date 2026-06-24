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

// ── List uploaded images ──
router.get("/images", (_req, res) => {
  try {
    const files = fs.existsSync(IMAGES_DIR)
      ? fs
          .readdirSync(IMAGES_DIR)
          .filter((f) =>
            /\.(jpe?g|png|gif|webp|svg)$/i.test(f)
          )
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

// ── Download image from URL ──
router.post("/images/download", async (req, res) => {
  const { url } = req.body as { url?: string };
  if (!url) {
    res.status(400).json({ error: "URL is required" });
    return;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      res.status(400).json({ error: `Failed to download: ${response.status}` });
      return;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      res.status(400).json({ error: "URL does not point to an image" });
      return;
    }

    const ext =
      contentType.includes("png")
        ? ".png"
        : contentType.includes("jpeg")
        ? ".jpg"
        : contentType.includes("gif")
        ? ".gif"
        : contentType.includes("webp")
        ? ".webp"
        : contentType.includes("svg")
        ? ".svg"
        : ".png";

    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename = `downloaded-${uniqueSuffix}${ext}`;
    const filepath = path.join(IMAGES_DIR, filename);

    const buffer = await response.arrayBuffer();
    fs.writeFileSync(filepath, Buffer.from(buffer));

    res.json({
      filename,
      relativePath: `images/${filename}`,
      importStatement: `import ${filename
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-zA-Z0-9]/g, "_")} from "@/assets/${filename}";`,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to download image" });
  }
});

export default router;
