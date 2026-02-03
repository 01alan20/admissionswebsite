import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROUTES_TO_MATERIALIZE = [
  "/contact",
  "/faq",
  "/explore",
  "/compare",
  "/timelines",
  "/high-school-pathways",
  "/profile/login",
];

const distDir = path.resolve(process.cwd(), "dist");
const indexPath = path.join(distDir, "index.html");

const indexHtml = await readFile(indexPath, "utf8");

await Promise.all(
  ROUTES_TO_MATERIALIZE.map(async (route) => {
    const cleaned = route.replace(/^\//, "").replace(/\/$/, "");
    if (!cleaned) return;
    const dir = path.join(distDir, cleaned);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "index.html"), indexHtml, "utf8");
  })
);

console.log(
  `Generated static route entrypoints for ${ROUTES_TO_MATERIALIZE.length} routes in ${distDir}`
);
