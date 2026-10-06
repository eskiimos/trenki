/* eslint-disable @typescript-eslint/no-require-imports -- Скрипт сборки CommonJS, запускается Node без транспиляции. */
// Runtime-ассеты камеры выдаются с нашего домена, без CDN в браузере.
// npm-пакет закреплён lock-файлом, модели — SHA256 официальных v1.
const { createHash } = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const VISION_VERSION = '0.10.14';
const MODELS = [
  { name: 'pose_landmarker_lite', sha256: '59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a' },
  { name: 'pose_landmarker_heavy', sha256: '64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b' },
];
const MAX_MODEL_BYTES = 40 * 1024 * 1024;
const WASM_FILES = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
];

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function prepareModel(modelDirectory, model) {
  const modelPath = path.join(modelDirectory, `${model.name}.task`);
  const modelUrl = `https://storage.googleapis.com/mediapipe-models/pose_landmarker/${model.name}/float16/1/${model.name}.task`;
  try {
    const cached = await fs.readFile(modelPath);
    if (sha256(cached) === model.sha256) return;
    process.stderr.write('MediaPipe: заменяем файл модели с неверной контрольной суммой.\n');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const temporaryPath = `${modelPath}.${process.pid}.tmp`;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(modelUrl, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status} при загрузке ${model.name}`);
      const declaredSize = Number(response.headers.get('content-length'));
      if (declaredSize > MAX_MODEL_BYTES) throw new Error('Модель превышает допустимый размер');
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > MAX_MODEL_BYTES) throw new Error('Модель превышает допустимый размер');
      if (sha256(bytes) !== model.sha256) throw new Error(`SHA256 ${model.name} не совпадает с закреплённой версией`);
      await fs.writeFile(temporaryPath, bytes);
      await fs.rename(temporaryPath, modelPath);
      return;
    } catch (error) {
      lastError = error;
      await fs.rm(temporaryPath, { force: true });
      if (attempt < 3) {
        process.stderr.write(`MediaPipe: загрузка модели не удалась, повтор ${attempt + 1}/3.\n`);
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  }
  throw lastError;
}

async function main() {
  const packageDirectory = path.dirname(require.resolve('@mediapipe/tasks-vision'));
  const metadata = JSON.parse(await fs.readFile(path.join(packageDirectory, 'package.json'), 'utf8'));
  if (metadata.version !== VISION_VERSION) {
    throw new Error(`Ожидался tasks-vision ${VISION_VERSION}, установлен ${metadata.version}`);
  }
  const publicDirectory = path.resolve(__dirname, '..', 'public', 'mediapipe');
  const wasmDirectory = path.join(publicDirectory, VISION_VERSION, 'wasm');
  const modelDirectory = path.join(publicDirectory, 'models');
  await fs.mkdir(wasmDirectory, { recursive: true });
  await fs.mkdir(modelDirectory, { recursive: true });
  for (const filename of WASM_FILES) {
    await fs.copyFile(path.join(packageDirectory, 'wasm', filename), path.join(wasmDirectory, filename));
  }
  for (const model of MODELS) await prepareModel(modelDirectory, model);
  process.stdout.write(`MediaPipe: WASM ${VISION_VERSION}, lite/heavy-модели готовы на нашем домене.\n`);
}

main().catch((error) => {
  process.stderr.write(`Подготовка MediaPipe не удалась: ${error.message || error}\n`);
  process.exitCode = 1;
});
