import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = {
    total: 100,
    concurrency: 100,
    stepDir: path.join(rootDir, 'Step'),
    reportDir: path.join(rootDir, 'reports'),
    url: null,
    timeoutMs: 120000,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === '--url' && next) {
      args.url = next;
      i += 1;
    } else if (arg === '--total' && next) {
      args.total = Number(next);
      i += 1;
    } else if (arg === '--concurrency' && next) {
      args.concurrency = Number(next);
      i += 1;
    } else if (arg === '--step-dir' && next) {
      args.stepDir = path.resolve(next);
      i += 1;
    } else if (arg === '--timeout-ms' && next) {
      args.timeoutMs = Number(next);
      i += 1;
    }
  }

  return args;
}

async function readEnvUrl() {
  const envPath = path.join(rootDir, 'client', '.env');
  try {
    const content = await readFile(envPath, 'utf8');
    const lines = content.split(/\r?\n/);
    const env = {};
    for (const line of lines) {
      const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*?)\s*$/);
      if (match) env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
    return env.VITE_API_URL || env.VITE_API_BASE_URL || null;
  } catch {
    return null;
  }
}

function normalizeBaseUrl(rawUrl) {
  if (!rawUrl || rawUrl === '/api') return 'http://localhost:5000';
  return rawUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
}

async function collectStepFiles(stepDir) {
  const entries = await readdir(stepDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(stepDir, entry.name))
    .filter((file) => /\.(step|stp)$/i.test(file))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));

  if (files.length === 0) {
    throw new Error(`No STEP/STP files found in ${stepDir}`);
  }
  return files;
}

async function uploadOne({ id, filePath, uploadUrl, timeoutMs }) {
  const startedAt = Date.now();
  const fileName = path.basename(filePath);
  const buffer = await readFile(filePath);
  const hash = createHash('sha1').update(buffer).digest('hex').slice(0, 12);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const form = new FormData();
    form.append('file', new Blob([buffer]), fileName);

    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });

    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    return {
      id,
      fileName,
      bytes: buffer.length,
      hash,
      ok: response.ok && json?.success === true,
      status: response.status,
      ms: Date.now() - startedAt,
      tempPath: json?.tempPath || null,
      error: response.ok ? null : (json?.error || text.slice(0, 300)),
    };
  } catch (error) {
    return {
      id,
      fileName,
      bytes: buffer.length,
      hash,
      ok: false,
      status: null,
      ms: Date.now() - startedAt,
      tempPath: null,
      error: error?.name === 'AbortError' ? `Timed out after ${timeoutMs}ms` : String(error?.message || error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function runPool(tasks, concurrency, worker) {
  const results = new Array(tasks.length);
  let cursor = 0;

  async function next() {
    while (cursor < tasks.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(tasks[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, next));
  return results;
}

const args = parseArgs(process.argv.slice(2));
const envUrl = await readEnvUrl();
const baseUrl = normalizeBaseUrl(args.url || process.env.DMS_API_URL || envUrl);
const uploadUrl = `${baseUrl}/api/upload-asset`;
const files = await collectStepFiles(args.stepDir);

const tasks = Array.from({ length: args.total }, (_, index) => ({
  id: index + 1,
  filePath: files[index % files.length],
  uploadUrl,
  timeoutMs: args.timeoutMs,
}));

console.log(`Target: ${uploadUrl}`);
console.log(`STEP/STP files: ${files.length}`);
console.log(`Uploads: ${tasks.length}`);
console.log(`Concurrency: ${Math.min(args.concurrency, tasks.length)}`);
console.log('Starting upload burst...');

const startedAt = Date.now();
const results = await runPool(tasks, args.concurrency, uploadOne);
const elapsedMs = Date.now() - startedAt;
const okCount = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok);
const sortedMs = [...results].map((r) => r.ms).sort((a, b) => a - b);
const pct = (p) => sortedMs[Math.min(sortedMs.length - 1, Math.floor((p / 100) * sortedMs.length))] || 0;

const summary = {
  target: uploadUrl,
  total: results.length,
  ok: okCount,
  failed: failed.length,
  elapsedMs,
  avgMs: Math.round(results.reduce((sum, r) => sum + r.ms, 0) / Math.max(1, results.length)),
  minMs: sortedMs[0] || 0,
  p50Ms: pct(50),
  p90Ms: pct(90),
  p95Ms: pct(95),
  maxMs: sortedMs[sortedMs.length - 1] || 0,
  uniqueSourceFiles: files.length,
};

await mkdir(args.reportDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const reportPath = path.join(args.reportDir, `instant-upload-load-test-${stamp}.json`);
await writeFile(reportPath, JSON.stringify({ summary, failures: failed, results }, null, 2));

console.log(JSON.stringify(summary, null, 2));
if (failed.length > 0) {
  console.log('Failures:');
  for (const item of failed.slice(0, 10)) {
    console.log(`#${item.id} ${item.fileName} status=${item.status ?? 'n/a'} error=${item.error}`);
  }
  if (failed.length > 10) console.log(`...and ${failed.length - 10} more`);
}
console.log(`Report: ${reportPath}`);

process.exit(failed.length > 0 ? 1 : 0);
