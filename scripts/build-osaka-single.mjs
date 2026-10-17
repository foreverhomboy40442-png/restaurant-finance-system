// Build the standalone single-file trip handbook by inlining
// styles.css, data.js and app.js into index.html.
// Usage: node scripts/build-osaka-single.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "..", "public", "trips", "osaka-kyoto-2025");

const html = readFileSync(join(dir, "index.html"), "utf8");
const css = readFileSync(join(dir, "styles.css"), "utf8");
const data = readFileSync(join(dir, "data.js"), "utf8");
const bootstrap = readFileSync(join(dir, "config-bootstrap.js"), "utf8");
const app = readFileSync(join(dir, "app.js"), "utf8");
const shared = readFileSync(join(dir, "shared.js"), "utf8");

let out = html
  .replace(
    '<meta name="description" content="大阪京都瘋女18｜2026/11/19–11/24 行程手冊" />',
    '<meta name="description" content="大阪京都瘋女18｜2026/11/19–11/24 行程手冊（單一檔案版）" />'
  )
  .replace(
    '    <link rel="stylesheet" href="./styles.css" />',
    `    <style>\n${css}\n    </style>`
  )
  .replace(
    `    <script src="./data.js"></script>\n` +
      `    <script src="./config-bootstrap.js"></script>\n` +
      `    <script src="./app.js"></script>\n` +
      `    <script type="module" src="./shared.js"></script>`,
    `    <script>\n${data}\n    </script>\n` +
      `    <script>\n${bootstrap}\n    </script>\n` +
      `    <script>\n${app}\n    </script>\n` +
      `    <script type="module">\n${shared}\n    </script>`
  );

writeFileSync(join(dir, "osaka-kyoto-2026.html"), out);
console.log("Built osaka-kyoto-2026.html");
