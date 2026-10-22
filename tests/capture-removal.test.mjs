import assert from 'node:assert/strict';
import { test } from 'node:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

test('bank capture has no native registration, route, dependency or live source reference', () => {
  for (const path of ['modules/notification-listener/package.json',
    'modules/notification-listener/expo-module.config.json',
    'modules/notification-listener/android/src/main/AndroidManifest.xml',
    'app/notification-import.tsx', 'src/services/notification-import.service.ts']) {
    assert.equal(existsSync(path), false, path);
  }
  const scan = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? scan(path) : /\.[jt]sx?$/.test(path) ? [path] : [];
  });
  for (const path of [...scan('app'), ...scan('src'), 'package.json', 'package-lock.json', 'app.json']) {
    assert.doesNotMatch(readFileSync(path, 'utf8'),
      /notification-listener|notification-import|BankNotificationSettings|NotificationConfirmationForm|BIND_NOTIFICATION_LISTENER_SERVICE|parseBankNotification|notification-capture-settings/,
      path);
  }
  // Wallet's own Android notification permission remains independent of bank access.
  assert.match(readFileSync('app/index.tsx', 'utf8'), /POST_NOTIFICATIONS/);
});
