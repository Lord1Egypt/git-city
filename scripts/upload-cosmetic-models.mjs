#!/usr/bin/env node
// Upload cosmetic GLB models to the `cosmetic-models` Supabase Storage bucket.
// Catalog rows reference them by relative path (render_spec.model), resolved at
// runtime against NEXT_PUBLIC_MODELS_BASE_URL. This keeps GLBs OUT of git, so a
// new cosmetic is upload + a DB row — no commit, no redeploy.
//
//   node --env-file=.env.local scripts/upload-cosmetic-models.mjs   # local supabase
//   node --env-file=.env.prod  scripts/upload-cosmetic-models.mjs   # production
//
// Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.
//
// Uploads every subfolder of public/models EXCEPT the committed Kenney kits
// (trees/props). Keys preserve the subfolder, e.g. vehicles/bankr_monitor.glb.

import { createClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, extname } from "node:path";

const BUCKET = "cosmetic-models";
const SOURCE_ROOT = "public/models";
const EXCLUDE_DIRS = new Set(["trees", "props"]); // Kenney CC0 kits, versioned in git

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(supabaseUrl, serviceKey);

const CONTENT_TYPES = {
  ".glb": "model/gltf-binary",
  ".gltf": "model/gltf+json",
  ".bin": "application/octet-stream",
};

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else files.push(full);
  }
  return files;
}

function collectFiles() {
  if (!existsSync(SOURCE_ROOT)) return [];
  const files = [];
  for (const entry of readdirSync(SOURCE_ROOT)) {
    const full = join(SOURCE_ROOT, entry);
    if (!statSync(full).isDirectory()) continue;   // skip top-level files (e.g. paper-plane.glb)
    if (EXCLUDE_DIRS.has(entry)) continue;          // skip Kenney kits
    walk(full, files);
  }
  return files;
}

async function ensureBucket() {
  const { data } = await sb.storage.getBucket(BUCKET);
  if (data) return;
  const { error } = await sb.storage.createBucket(BUCKET, {
    public: true,
    allowedMimeTypes: ["model/gltf-binary", "model/gltf+json", "application/octet-stream"],
    fileSizeLimit: "25MB",
  });
  if (error) throw error;
  console.log(`Created public bucket "${BUCKET}"`);
}

async function main() {
  await ensureBucket();

  const files = collectFiles();
  if (files.length === 0) {
    console.log(`No cosmetic models found under ${SOURCE_ROOT}/ (excluding ${[...EXCLUDE_DIRS].join(", ")}).`);
    return;
  }
  console.log(`Uploading ${files.length} model(s) to "${BUCKET}"...`);

  let ok = 0, fail = 0;
  for (const file of files) {
    const key = relative(SOURCE_ROOT, file).split("\\").join("/");
    const contentType = CONTENT_TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";
    const { error } = await sb.storage.from(BUCKET).upload(key, readFileSync(file), {
      contentType,
      cacheControl: "31536000",
      upsert: true,
    });
    if (error) { console.error(`  ✗ ${key}: ${error.message}`); fail++; }
    else { console.log(`  ✓ ${key}`); ok++; }
  }

  console.log(`\nDone. ${ok} uploaded, ${fail} failed.`);
  console.log(`Public URL base: ${supabaseUrl}/storage/v1/object/public/${BUCKET}`);
  console.log(`→ set NEXT_PUBLIC_MODELS_BASE_URL to that base.`);
  if (fail > 0) process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });
