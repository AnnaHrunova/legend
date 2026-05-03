import { useEffect, useState } from 'react';
import { identify, track } from '../../analytics/analytics';
import {
  clearTesterProfile,
  createTesterProfile,
  getTesterProfile,
  saveTesterProfile,
  type TesterProfile,
} from '../../analytics/testerProfile';

const roleOptions = ['Support', 'Product', 'Engineering', 'Operations', 'QA', 'Manager'];

type TesterProfileFormValue = {
  fullName: string;
  email: string;
  role: string;
};

export function TesterProfileControl() {
  const [profile, setProfile] = useState<TesterProfile | undefined>(() => getTesterProfile());
  const [modalMode, setModalMode] = useState<'create' | 'edit' | undefined>(() => (getTesterProfile() ? undefined : 'create'));

  useEffect(() => {
    const onProfileChanged = () => setProfile(getTesterProfile());
    window.addEventListener('legend-desk-tester-profile-changed', onProfileChanged);
    return () => window.removeEventListener('legend-desk-tester-profile-changed', onProfileChanged);
  }, []);

  useEffect(() => {
    const storedProfile = getTesterProfile();
    if (!storedProfile) return;
    identifyTester(storedProfile);
  }, []);

  function persistProfile(nextProfile: TesterProfile, eventName: 'tester_profile_created' | 'tester_profile_updated') {
    saveTesterProfile(nextProfile);
    setProfile(nextProfile);
    setModalMode(undefined);
    identifyTester(nextProfile);
    track(eventName, {
      testerId: nextProfile.testerId,
      role: nextProfile.role,
    });
  }

  function createProfile(value: TesterProfileFormValue) {
    persistProfile(createTesterProfile(value), 'tester_profile_created');
  }

  function updateProfile(value: TesterProfileFormValue) {
    if (!profile) return;
    persistProfile(
      {
        ...profile,
        fullName: value.fullName.trim(),
        email: value.email.trim(),
        role: value.role.trim(),
      },
      'tester_profile_updated',
    );
  }

  function resetProfile() {
    if (profile) {
      track('tester_profile_reset', { testerId: profile.testerId });
    }
    clearTesterProfile();
    setProfile(undefined);
    setModalMode('create');
  }

  return (
    <>
      {profile && (
        <button type="button" className="tester-profile-trigger" onClick={() => setModalMode('edit')} title={profile.email}>
          <span>Testing as</span>
          <strong>{profile.fullName}</strong>
        </button>
      )}
      {modalMode && (
        <TesterProfileModal
          mode={modalMode}
          profile={profile}
          onSubmit={modalMode === 'create' ? createProfile : updateProfile}
          onCancel={modalMode === 'edit' ? () => setModalMode(undefined) : undefined}
          onReset={modalMode === 'edit' ? resetProfile : undefined}
        />
      )}
    </>
  );
}

type TesterProfileModalProps = {
  mode: 'create' | 'edit';
  profile?: TesterProfile;
  onSubmit: (value: TesterProfileFormValue) => void;
  onCancel?: () => void;
  onReset?: () => void;
};

function TesterProfileModal({
  mode,
  profile,
  onSubmit,
  onCancel,
  onReset,
}: TesterProfileModalProps) {
  const [fullName, setFullName] = useState(profile?.fullName ?? '');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [role, setRole] = useState(profile?.role ?? roleOptions[0]);
  const [error, setError] = useState<string | undefined>();

  function submit() {
    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    const trimmedRole = role.trim();
    if (!trimmedName) {
      setError('Full name is required.');
      return;
    }
    if (!trimmedEmail || !isValidEmail(trimmedEmail)) {
      setError('A valid email is required.');
      return;
    }
    if (!trimmedRole) {
      setError('Role is required.');
      return;
    }
    onSubmit({ fullName: trimmedName, email: trimmedEmail, role: trimmedRole });
  }

  return (
    <div className="tester-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="tester-modal-title">
      <section className="tester-modal">
        <div className="tester-modal-header">
          <div>
            <h2 id="tester-modal-title">{mode === 'create' ? 'Before you start' : 'Tester profile'}</h2>
            <p>Please enter your details so we can connect your feedback and usage during this prototype test.</p>
          </div>
        </div>

        <p className="tester-privacy-copy">
          This is only used for prototype testing and feedback analysis. Do not enter sensitive personal data.
        </p>

        <label className="tester-field">
          <span>Full name</span>
          <input
            value={fullName}
            onChange={(event) => {
              setFullName(event.target.value);
              setError(undefined);
            }}
            placeholder="Full name"
          />
        </label>

        <label className="tester-field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setError(undefined);
            }}
            placeholder="name@company.com"
          />
        </label>

        <label className="tester-field">
          <span>Role / team</span>
          <select value={role} onChange={(event) => setRole(event.target.value)}>
            {roleOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>

        {error && <div className="tester-form-error">{error}</div>}

        <div className="tester-modal-actions">
          {mode === 'edit' && onReset && (
            <button type="button" className="danger-button" onClick={onReset}>
              Reset tester profile
            </button>
          )}
          <div>
            {mode === 'edit' && <button type="button" onClick={onCancel}>Cancel</button>}
            <button type="button" className="primary-button" onClick={submit}>
              {mode === 'create' ? 'Start testing' : 'Save profile'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function identifyTester(profile: TesterProfile) {
  identify(profile.testerId, {
    name: profile.fullName,
    email: profile.email,
    role: profile.role,
  });
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
