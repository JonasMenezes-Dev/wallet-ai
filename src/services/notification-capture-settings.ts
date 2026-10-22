export type CaptureAuthorization = { enabled: boolean; authorizedPackages: string[] };
export type InstalledBankApp = { name: string; packageName: string };
export type CaptureSettingsSnapshot = {
  permissionGranted: boolean;
  authorization: CaptureAuthorization;
  apps: InstalledBankApp[];
};

export type DevelopmentCaptureDiagnostics = {
  states: Record<"received" | "pending" | "confirmed" | "ignored" | "error", number>;
  duplicateChecks: number;
  duplicateFailures: number;
};

export interface NotificationCaptureNativeBridge {
  isCaptureSupported(): boolean;
  hasPermission(): boolean;
  openSettings(): void;
  getCaptureAuthorization(): Promise<unknown>;
  getInstalledBankApps(): Promise<unknown>;
  updateCaptureAuthorization(enabled: boolean, packages: string[]): Promise<boolean>;
  getDevelopmentCaptureDiagnostics?(): Promise<unknown>;
}

const validPackage = (value: unknown): value is string => typeof value === "string"
  && value.length <= 255 && /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(value);

function authorizationFromNative(value: unknown): CaptureAuthorization {
  const policy = value as Partial<CaptureAuthorization> | null;
  if (!policy || typeof policy.enabled !== "boolean" || !Array.isArray(policy.authorizedPackages)
    || policy.authorizedPackages.length > 128 || !policy.authorizedPackages.every(validPackage)) {
    throw new Error("Não foi possível consultar a autorização segura.");
  }
  return { enabled: policy.enabled, authorizedPackages: [...new Set(policy.authorizedPackages)].sort() };
}

function appsFromNative(value: unknown): InstalledBankApp[] {
  if (!Array.isArray(value) || !value.every((app) => app && typeof app.name === "string"
    && app.name.trim().length > 0 && validPackage(app.packageName))) {
    throw new Error("Não foi possível consultar os apps financeiros instalados.");
  }
  return value.map((app) => ({ name: app.name, packageName: app.packageName }));
}

/** All persistence belongs to the native encrypted preferences. No JS storage fallback. */
export function createNotificationCaptureSettings(bridge: Partial<NotificationCaptureNativeBridge> | null) {
  const available = bridge !== null && ["isCaptureSupported", "hasPermission", "openSettings",
    "getCaptureAuthorization", "getInstalledBankApps", "updateCaptureAuthorization"].every(
    (method) => typeof bridge[method as keyof NotificationCaptureNativeBridge] === "function",
  );
  const native = bridge as NotificationCaptureNativeBridge;

  async function load(): Promise<CaptureSettingsSnapshot | null> {
    if (!available || !native.isCaptureSupported()) return null;
    const [policy, apps] = await Promise.all([
      native.getCaptureAuthorization(), native.getInstalledBankApps(),
    ]);
    // Read permission last: the user may return from Android settings during the async reads.
    const permissionGranted = native.hasPermission();
    if (typeof permissionGranted !== "boolean") throw new Error("Não foi possível consultar a permissão Android.");
    return { permissionGranted, authorization: authorizationFromNative(policy), apps: appsFromNative(apps) };
  }

  async function update(enabled: boolean, packages: string[]): Promise<CaptureSettingsSnapshot> {
    const current = await load();
    if (!current) throw new Error("Captura indisponível neste dispositivo.");
    if (typeof enabled !== "boolean" || packages.length > 128 || !packages.every(validPackage)) {
      throw new Error("Seleção de aplicativos inválida.");
    }
    const selection = [...new Set(packages)].sort();
    const installed = new Set(current.apps.map((app) => app.packageName));
    if (enabled && (!current.permissionGranted || selection.length === 0)) {
      throw new Error("Conceda o acesso Android e selecione pelo menos um app financeiro.");
    }
    if (selection.some((pkg) => !installed.has(pkg)
      && (enabled || !current.authorization.authorizedPackages.includes(pkg)))) {
      throw new Error("Selecione somente apps financeiros compatíveis instalados.");
    }
    if (await native.updateCaptureAuthorization(enabled, selection) !== true) {
      throw new Error("Não foi possível salvar a autorização segura.");
    }
    const saved = await load();
    if (!saved) throw new Error("Não foi possível confirmar a autorização segura.");
    return saved;
  }

  function openAndroidSettings() {
    if (!available || !native.isCaptureSupported()) throw new Error("Acesso indisponível neste dispositivo.");
    native.openSettings();
  }
  async function loadDevelopmentDiagnostics(): Promise<DevelopmentCaptureDiagnostics | null> {
    if (!available || !native.getDevelopmentCaptureDiagnostics) return null;
    const raw = await native.getDevelopmentCaptureDiagnostics() as Partial<DevelopmentCaptureDiagnostics> | null;
    if (raw === null) return null; // Native debuggable gate is authoritative, including production JS.
    if (!raw || !raw.states) throw new Error("Diagnóstico de desenvolvimento indisponível.");
    const count = (value: unknown): number => {
      if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
        throw new Error("Contagem de diagnóstico inválida.");
      }
      return value;
    };
    // Explicit whitelist: no event, title, text, amount, identity or arbitrary native field crosses this API.
    return {
      states: {
        received: count(raw.states.received), pending: count(raw.states.pending),
        confirmed: count(raw.states.confirmed), ignored: count(raw.states.ignored), error: count(raw.states.error),
      },
      duplicateChecks: count(raw.duplicateChecks), duplicateFailures: count(raw.duplicateFailures),
    };
  }
  return { available, load, update, openAndroidSettings, loadDevelopmentDiagnostics };
}
