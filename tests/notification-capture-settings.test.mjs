import assert from "node:assert/strict";
import test from "node:test";
import { createNotificationCaptureSettings } from "../src/services/notification-capture-settings.ts";

const bank = { name: "Nubank", packageName: "com.nu.production" };
function fixture() {
  let policy = { enabled: false, authorizedPackages: [] };
  let permission = false;
  let apps = [bank];
  let writes = 0;
  let settingsOpened = 0;
  const bridge = {
    isCaptureSupported: () => true,
    hasPermission: () => permission,
    openSettings: () => { settingsOpened++; },
    getCaptureAuthorization: async () => structuredClone(policy),
    getInstalledBankApps: async () => structuredClone(apps),
    updateCaptureAuthorization: async (enabled, packages) => {
      writes++;
      policy = { enabled, authorizedPackages: [...packages] };
      return true;
    },
  };
  return {
    bridge, settings: createNotificationCaptureSettings(bridge),
    policy: () => policy, writes: () => writes, settingsOpened: () => settingsOpened,
    permission: (value) => { permission = value; },
    apps: (value) => { apps = value; },
    authorize: (value) => { policy = value; },
  };
}

test("loading preserves disabled/empty defaults without opening Android settings or writing", async () => {
  const f = fixture();
  const state = await f.settings.load();
  assert.deepEqual(state, { permissionGranted: false, authorization: { enabled: false, authorizedPackages: [] }, apps: [bank] });
  assert.equal(f.writes(), 0);
  assert.equal(f.settingsOpened(), 0);
});

test("unsupported platforms and old native bridges return unavailable", async () => {
  for (const bridge of [null, {}, { hasPermission: () => true }]) {
    const settings = createNotificationCaptureSettings(bridge);
    assert.equal(settings.available, false);
    assert.equal(await settings.load(), null);
    await assert.rejects(settings.update(false, []));
  }
  const f = fixture();
  f.bridge.isCaptureSupported = () => false;
  assert.equal(await f.settings.load(), null);
});

test("permission and internal capture remain independent after Android revocation", async () => {
  const f = fixture();
  f.authorize({ enabled: true, authorizedPackages: [bank.packageName] });
  f.permission(true);
  assert.equal((await f.settings.load()).permissionGranted, true);
  f.permission(false);
  const state = await f.settings.load();
  assert.equal(state.permissionGranted, false);
  assert.equal(state.authorization.enabled, true);
  assert.equal(f.writes(), 0);
});

test("activation requires Android permission and explicit installed-app selection", async () => {
  const f = fixture();
  await assert.rejects(f.settings.update(true, [bank.packageName]));
  f.permission(true);
  await assert.rejects(f.settings.update(true, []));
  await assert.rejects(f.settings.update(true, ["com.example.unknown"]));
  await assert.rejects(f.settings.update(true, ["*"]));
  assert.equal(f.writes(), 0);
  assert.equal(f.policy().enabled, false);
});

test("permission is refreshed after pending native reads finish", async () => {
  const f = fixture();
  f.permission(true);
  let finish;
  f.bridge.getInstalledBankApps = () => new Promise((resolve) => { finish = resolve; });
  const loading = f.settings.load();
  f.permission(false);
  finish([bank]);
  assert.equal((await loading).permissionGranted, false);
});

test("selection is saved only natively and never implicitly activates capture", async () => {
  const f = fixture();
  const selected = await f.settings.update(false, [bank.packageName]);
  assert.deepEqual(selected.authorization, { enabled: false, authorizedPackages: [bank.packageName] });
  f.permission(true);
  const active = await f.settings.update(true, [bank.packageName]);
  assert.deepEqual(active.authorization, { enabled: true, authorizedPackages: [bank.packageName] });
  assert.equal(f.writes(), 2);
});

test("discovering newly installed wallets does not authorize or activate them", async () => {
  const f = fixture();
  const wallet = { name: "Google Wallet", packageName: "com.google.android.apps.walletnfcrel" };
  f.authorize({ enabled: true, authorizedPackages: [bank.packageName] });
  f.permission(true);
  f.apps([bank, wallet]);
  const discovered = await f.settings.load();
  assert.deepEqual(discovered.apps, [bank, wallet]);
  assert.deepEqual(discovered.authorization.authorizedPackages, [bank.packageName]);
  assert.equal(f.writes(), 0);
  const selected = await f.settings.update(false, [wallet.packageName]);
  assert.deepEqual(selected.authorization, { enabled: false, authorizedPackages: [wallet.packageName] });
  const enabled = await f.settings.update(true, [wallet.packageName]);
  assert.deepEqual(enabled.authorization, { enabled: true, authorizedPackages: [wallet.packageName] });
});

test("a payment-app catalog cannot authorize an absent or malformed source", async () => {
  const f = fixture();
  f.permission(true);
  f.apps([{ name: "PicPay", packageName: "com.picpay" }]);
  await assert.rejects(f.settings.update(true, ["com.google.android.apps.walletnfcrel"]));
  await assert.rejects(f.settings.update(true, ["com.picpay.fake"]));
  assert.equal(f.writes(), 0);
});

test("disabling works without Android access and preserves unavailable existing selections", async () => {
  const f = fixture();
  f.authorize({ enabled: true, authorizedPackages: [bank.packageName] });
  f.apps([]);
  const state = await f.settings.update(false, [bank.packageName]);
  assert.equal(state.authorization.enabled, false);
  assert.deepEqual(state.authorization.authorizedPackages, [bank.packageName]);
  f.permission(true);
  await assert.rejects(f.settings.update(true, [bank.packageName]));
  const cleared = await f.settings.update(false, []);
  assert.deepEqual(cleared.authorization.authorizedPackages, []);
});

test("failed native writes never report success or enable capture", async () => {
  const f = fixture();
  f.permission(true);
  f.bridge.updateCaptureAuthorization = async () => false;
  await assert.rejects(f.settings.update(true, [bank.packageName]));
  assert.equal(f.policy().enabled, false);
  assert.deepEqual(f.policy().authorizedPackages, []);
});

test("native read failures and malformed authorization are rejected without writes", async () => {
  const f = fixture();
  f.bridge.getCaptureAuthorization = async () => { throw new Error("native failure"); };
  await assert.rejects(f.settings.load());
  f.bridge.getCaptureAuthorization = async () => ({ enabled: "true", authorizedPackages: ["*"] });
  await assert.rejects(f.settings.load());
  assert.equal(f.writes(), 0);
});

test("Android settings open only through the explicit action", async () => {
  const f = fixture();
  await f.settings.load();
  assert.equal(f.settingsOpened(), 0);
  f.settings.openAndroidSettings();
  assert.equal(f.settingsOpened(), 1);
});

test("development diagnostics return only counts and known queue states", async () => {
  const f = fixture();
  f.bridge.getDevelopmentCaptureDiagnostics = async () => ({
    states: { received: 4, pending: 0, confirmed: 0, ignored: 0, error: 0 },
    duplicateChecks: 1, duplicateFailures: 0, unexpectedPayload: "must stay native",
  });
  assert.deepEqual(await f.settings.loadDevelopmentDiagnostics(), {
    states: { received: 4, pending: 0, confirmed: 0, ignored: 0, error: 0 },
    duplicateChecks: 1, duplicateFailures: 0,
  });
  assert.equal(f.writes(), 0);
});

test("release or missing native diagnostics stay unavailable; invalid counts are rejected", async () => {
  const f = fixture();
  assert.equal(await f.settings.loadDevelopmentDiagnostics(), null);
  f.bridge.getDevelopmentCaptureDiagnostics = async () => null;
  assert.equal(await f.settings.loadDevelopmentDiagnostics(), null);
  f.bridge.getDevelopmentCaptureDiagnostics = async () => ({
    states: { received: -1, pending: 0, confirmed: 0, ignored: 0, error: 0 },
    duplicateChecks: 0, duplicateFailures: 0,
  });
  await assert.rejects(f.settings.loadDevelopmentDiagnostics());
});
