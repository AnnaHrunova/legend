export const TESTER_PROFILE_STORAGE_KEY = 'legendDeskTesterProfile';

export type TesterProfile = {
  testerId: string;
  name: string;
  role?: string;
  createdAt: string;
  anonymous: boolean;
};

type TesterProfileInput = {
  name: string;
  role?: string;
  anonymous: boolean;
};

export function createTesterProfile({ name, role, anonymous }: TesterProfileInput): TesterProfile {
  return {
    testerId: generateTesterId(),
    name,
    ...(role?.trim() ? { role: role.trim() } : {}),
    createdAt: new Date().toISOString(),
    anonymous,
  };
}

export function getTesterProfile(): TesterProfile | undefined {
  try {
    const stored = window.localStorage.getItem(TESTER_PROFILE_STORAGE_KEY);
    if (!stored) return undefined;
    const parsed = JSON.parse(stored) as Partial<TesterProfile>;
    if (!parsed.testerId || !parsed.name || !parsed.createdAt || typeof parsed.anonymous !== 'boolean') {
      return undefined;
    }
    return {
      testerId: parsed.testerId,
      name: parsed.name,
      ...(parsed.role ? { role: parsed.role } : {}),
      createdAt: parsed.createdAt,
      anonymous: parsed.anonymous,
    };
  } catch {
    return undefined;
  }
}

export function saveTesterProfile(profile: TesterProfile): void {
  window.localStorage.setItem(TESTER_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  window.dispatchEvent(new CustomEvent('legend-desk-tester-profile-changed'));
}

export function clearTesterProfile(): void {
  window.localStorage.removeItem(TESTER_PROFILE_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('legend-desk-tester-profile-changed'));
}

export function testerAnalyticsProperties(profile?: TesterProfile): Record<string, unknown> {
  if (!profile) return {};
  return {
    testerId: profile.testerId,
    testerName: profile.name,
    ...(profile.role ? { testerRole: profile.role } : {}),
    testerAnonymous: profile.anonymous,
  };
}

function generateTesterId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `tester-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
