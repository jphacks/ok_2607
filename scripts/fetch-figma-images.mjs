#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

const DEFAULT_FIGMA_URL =
  "https://www.figma.com/design/IjOn5pPLYYKsAUrXOLGh7i/TODO-ROGUE%EF%BD%9C%E3%82%B9%E3%83%9 マ%E3%83%9B%E7%B8%A6%E5%9E%8BUI-6%E7%94%BB%E9%9D%A2?node-id=0-1&p=f&t=BBvvYIghqFNYlZKl-0";

// .env.local / .env から環境変数を読み込む（dotenv不要）
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnvFile(path.resolve(process.cwd(), ".env.local"));
loadEnvFile(path.resolve(process.cwd(), ".env"));

const optionsDefinition = {
  url: {
    type: "string",
    short: "u",
    default: DEFAULT_FIGMA_URL,
  },
  token: {
    type: "string",
    short: "t",
  },
  "out-dir": {
    type: "string",
    short: "o",
    default: "docs/figma",
  },
  scale: {
    type: "string",
    short: "s",
    default: "2",
  },
  format: {
    type: "string",
    short: "f",
    default: "png",
  },
  all: {
    type: "boolean",
    default: false,
  },
  help: {
    type: "boolean",
    short: "h",
    default: false,
  },
};

const { values: flags, positionals } = parseArgs({
  options: optionsDefinition,
  allowPositionals: true,
  strict: false,
});

if (flags.help) {
  console.log(`
Figma 画像ダウンローダー

使い方:
  npm run figma:fetch [オプション]
  node scripts/fetch-figma-images.mjs [オプション]

オプション:
  -u, --url <url>        Figma の URL (デフォルト: 指定の TODO-ROGUE UI URL)
  -t, --token <token>    Figma Personal Access Token (または環境変数 FIGMA_ACCESS_TOKEN)
  -o, --out-dir <path>   画像保存先ディレクトリ (デフォルト: docs/figma)
  -s, --scale <number>   画像解像度の倍率 1〜4 (デフォルト: 2)
  -f, --format <format>  画像形式: png, jpg, svg, pdf (デフォルト: png)
      --all              node-id が指定されていても全画面・フレームを取得する
  -h, --help             ヘルプを表示

設定方法:
  1. Figma (https://www.figma.com/) にログイン
  2. 設定 (Settings) -> Security -> Personal access tokens でトークンを新規作成
  3. .env.local に以下を追記:
     FIGMA_ACCESS_TOKEN=figd_...
`);
  process.exit(0);
}

const targetUrl = flags.url || positionals[0] || DEFAULT_FIGMA_URL;
const token = flags.token || process.env.FIGMA_ACCESS_TOKEN;
const outDir = path.resolve(process.cwd(), flags["out-dir"] || "docs/figma");
const scale = Number(flags.scale) || 2;
const format = flags.format || "png";
const fetchAll = Boolean(flags.all);

if (!token) {
  console.error(`
エラー: Figma のアクセストークンが見つかりません。
以下のいずれかの方法でトークンを設定してください:

1. .env.local に記載する（推奨）:
   FIGMA_ACCESS_TOKEN=figd_xxxxxxxxxxxxxxxxxxxx

2. コマンドライン引数で渡す:
   npm run figma:fetch -- --token figd_xxxxxxxxxxxxxxxxxxxx

3. 一時的な環境変数として渡す:
   FIGMA_ACCESS_TOKEN=figd_xxxxxxxxxxxxxxxxxxxx npm run figma:fetch

※ トークンの発行手順:
   Figma (ブラウザ) -> 左上プロフィールアイコン -> Settings -> Security -> Personal access tokens -> Generate new token
`);
  process.exit(1);
}

// URL の解析
function parseFigmaUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    // パスから fileKey を取得: /design/:key/... または /file/:key/...
    const match = parsed.pathname.match(/\/(?:design|file)\/([a-zA-Z0-9_-]+)/);
    if (!match) {
      throw new Error(`Figma のファイルキーを URL から抽出できませんでした: ${rawUrl}`);
    }
    const fileKey = match[1];

    let nodeId = parsed.searchParams.get("node-id");
    if (nodeId) {
      // URL では 0-1 や 0:1 の形式がある。API では : を使用する
      nodeId = nodeId.replace("-", ":");
    }

    return { fileKey, nodeId };
  } catch (err) {
    throw new Error(`無効な URL です: ${rawUrl} (${err.message})`);
  }
}

function sanitizeFileName(name) {
  return name
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function figmaApi(endpoint) {
  const url = `https://api.figma.com/v1/${endpoint}`;
  const res = await fetch(url, {
    headers: {
      "X-Figma-Token": token,
    },
  });

  if (!res.ok) {
    let errorDetail = "";
    try {
      const json = await res.json();
      errorDetail = json.err || json.message || JSON.stringify(json);
    } catch {
      errorDetail = await res.text();
    }
    throw new Error(`Figma API エラー (${res.status} ${res.statusText}): ${errorDetail}`);
  }

  return res.json();
}

function findNodeById(node, targetId) {
  if (node.id === targetId) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findNodeById(child, targetId);
      if (found) return found;
    }
  }
  return null;
}

function extractRenderableNodes(rootNode, targetNodeId, isAll) {
  const targets = [];

  const isFrameLike = (n) =>
    ["FRAME", "COMPONENT", "COMPONENT_SET", "SECTION", "GROUP"].includes(n.type);

  if (!targetNodeId || isAll) {
    // 全ページからフレームを収集
    const pages = rootNode.children || [];
    for (const page of pages) {
      for (const child of page.children || []) {
        if (isFrameLike(child)) {
          targets.push({ id: child.id, name: child.name, page: page.name });
        }
      }
    }
    return targets;
  }

  // 指定ノードを探索
  const targetNode = findNodeById(rootNode, targetNodeId);
  if (!targetNode) {
    console.warn(
      `警告: 指定された node-id (${targetNodeId}) が見つかりませんでした。全フレームを対象にします。`,
    );
    return extractRenderableNodes(rootNode, null, true);
  }

  // targetNode が CANVAS（ページ）の場合、その直下のフレーム群を対象とする
  if (targetNode.type === "CANVAS") {
    for (const child of targetNode.children || []) {
      if (isFrameLike(child)) {
        targets.push({ id: child.id, name: child.name, page: targetNode.name });
      }
    }
    if (targets.length === 0) {
      // フレームがなければ直下の子すべて
      for (const child of targetNode.children || []) {
        targets.push({ id: child.id, name: child.name, page: targetNode.name });
      }
    }
    return targets;
  }

  // targetNode の直下に複数の画面（FRAMEなど）がある場合
  const subFrames = (targetNode.children || []).filter(isFrameLike);
  if (subFrames.length > 0) {
    // 直下フレームを各画面として抽出
    for (const child of subFrames) {
      targets.push({ id: child.id, name: child.name, page: targetNode.name });
    }
    // ノード自身も含める
    targets.unshift({ id: targetNode.id, name: `${targetNode.name}_全体`, page: "" });
  } else {
    // 子フレームがなければ対象ノードそのもの
    targets.push({ id: targetNode.id, name: targetNode.name, page: "" });
  }

  return targets;
}

async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`画像ダウンロード失敗 (${res.status}): ${url}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
}

async function main() {
  const { fileKey, nodeId } = parseFigmaUrl(targetUrl);

  console.log(`\n🎨 Figma から画像を取得します...`);
  console.log(`- File Key: ${fileKey}`);
  console.log(`- Node ID : ${nodeId || "(未指定 / 全体)"}`);
  console.log(`- 保存先   : ${outDir}`);
  console.log(`- 形式/倍率: ${format.toUpperCase()} (x${scale})`);

  console.log(`\n1/3 ファイル情報を取得中...`);
  const fileData = await figmaApi(`files/${fileKey}?depth=3`);
  console.log(`✓ ドキュメント名: 「${fileData.name}」`);

  const nodes = extractRenderableNodes(fileData.document, nodeId, fetchAll);
  if (nodes.length === 0) {
    throw new Error("画像化の対象となるノードが見つかりませんでした。");
  }

  console.log(`\n2/3 対象画面 (${nodes.length} 件):`);
  nodes.forEach((n, idx) => {
    console.log(`  ${idx + 1}. [${n.id}] ${n.name}`);
  });

  // 画像 URL の発行（最大 50 件ずつ取得）
  console.log(`\n3/3 画像エクスポート URL を生成中...`);
  const chunkSize = 50;
  const imageUrlMap = {};

  for (let i = 0; i < nodes.length; i += chunkSize) {
    const chunk = nodes.slice(i, i + chunkSize);
    const ids = chunk.map((n) => n.id).join(",");
    const endpoint = `images/${fileKey}?ids=${ids}&format=${format}&scale=${scale}`;
    const result = await figmaApi(endpoint);
    if (result.images) {
      Object.assign(imageUrlMap, result.images);
    }
  }

  // ディレクトリ作成
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log(`\n画像をダウンロード中...`);
  let downloadedCount = 0;
  const downloadedFiles = [];

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const imgUrl = imageUrlMap[node.id];
    if (!imgUrl) {
      console.warn(`⚠️ [${node.id}] ${node.name}: 画像 URL が生成されませんでした。`);
      continue;
    }

    const indexPrefix = String(i + 1).padStart(2, "0");
    const safeName = sanitizeFileName(node.name) || `node_${node.id.replace(":", "_")}`;
    const filename = `${indexPrefix}_${safeName}.${format}`;
    const destPath = path.join(outDir, filename);

    process.stdout.write(`  [${i + 1}/${nodes.length}] ${filename} を保存中... `);
    try {
      await downloadFile(imgUrl, destPath);
      const stat = fs.statSync(destPath);
      const sizeKb = (stat.size / 1024).toFixed(1);
      console.log(`✓ (${sizeKb} KB)`);
      downloadedCount++;
      downloadedFiles.push({ filename, path: destPath, sizeKb });
    } catch (e) {
      console.log(`✕ 失敗: ${e.message}`);
    }
  }

  console.log(`\n🎉 完了: ${downloadedCount}/${nodes.length} 件の画像を保存しました！`);
  console.log(`保存先: ${outDir}\n`);
}

main().catch((err) => {
  console.error(`\n❌ エラーが発生しました: ${err.message}`);
  process.exit(1);
});
