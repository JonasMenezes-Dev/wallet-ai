import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import Jimp from 'jimp-compact';

test('Android foreground centers the approved wallet inside the circular safe area', async () => {
  const config = JSON.parse(readFileSync(new URL('../app.json', import.meta.url))).expo;
  const path = config.android.adaptiveIcon.foregroundImage.replace(/^\.\//, '../');
  const image = await Jimp.read(new URL(path, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
  const { width, height, data } = image.bitmap;
  // Inspect the central mark, including the separated chart bars. Exclude
  // the decorative tile rim, which must not define the optical bounds.
  const pixels = new Set();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    if (x > width * .27 && x < width * .74 && y > height * .22 && y < height * .80 && data[i + 3] > 128 && data[i + 1] > 75 && data[i + 1] > data[i] * 1.3 && data[i + 1] > data[i + 2] * 1.15) pixels.add(y * width + x);
  }
  const mark = [...pixels];
  assert.ok(mark.length > 100, 'The original wallet mark remains visible');
  const xs = mark.map(p => p % width), ys = mark.map(p => Math.floor(p / width));
  const bounds = [xs.reduce((a,b) => Math.min(a,b)), ys.reduce((a,b) => Math.min(a,b)), xs.reduce((a,b) => Math.max(a,b)), ys.reduce((a,b) => Math.max(a,b))];
  assert.ok(Math.abs((bounds[0] + bounds[2] + 1) / 2 - width / 2) < width * .012, `Horizontal center: ${bounds}`);
  assert.ok(Math.abs((bounds[1] + bounds[3] + 1) / 2 - height / 2) < height * .012, `Vertical center: ${bounds}`);
  const radius = width * 33 / 108;
  for (const p of mark) assert.ok(Math.hypot(p % width + .5 - width / 2, Math.floor(p / width) + .5 - height / 2) <= radius, 'Wallet remains inside the Android safe circle');
  assert.equal(config.version, '2.0.0');
  assert.equal(config.android.versionCode, 4);
  assert.equal(config.android.package, 'com.walletai.app');
});
