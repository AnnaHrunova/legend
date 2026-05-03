export const TESTER_PROFILE_STORAGE_KEY = 'legendDeskTesterProfile';

export type TesterProfile = {
  testerId: string;
  fullName: string;
  email: string;
  role: string;
  createdAt: string;
};

type TesterProfileInput = {
  fullName: string;
  email: string;
  role: string;
};

export function createTesterProfile({ fullName, email, role }: TesterProfileInput): TesterProfile {
  return {
    testerId: generateTesterId(),
    fullName: fullName.trim(),
    email: email.trim(),
    role: role.trim(),
    createdAt: new Date().toISOString(),
  };
}

export function getTesterProfile(): TesterProfile | undefined {
  try {
    const stored = window.localStorage.getItem(TESTER_PROFILE_STORAGE_KEY);
    if (!stored) return undefined;
    const parsed = JSON.parse(stored) as Partial<TesterProfile>;
    if (!parsed.testerId || !parsed.fullName || !parsed.email || !parsed.role || !parsed.createdAt) {
      return undefined;
    }
    return {
      testerId: parsed.testerId,
      fullName: parsed.fullName,
      email: parsed.email,
      role: parsed.role,
      createdAt: parsed.createdAt,
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
    testerName: profile.fullName,
    testerEmail: profile.email,
    testerRole: profile.role,
  };
}

function generateTesterId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `tester-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
