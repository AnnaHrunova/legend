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
    identify(storedProfile.testerId, {
      name: storedProfile.name,
      ...(storedProfile.role ? { role: storedProfile.role } : {}),
      anonymous: storedProfile.anonymous,
    });
  }, []);

  function persistProfile(nextProfile: TesterProfile, eventName: 'tester_profile_created' | 'tester_profile_updated') {
    saveTesterProfile(nextProfile);
    setProfile(nextProfile);
    setModalMode(undefined);
    identify(nextProfile.testerId, {
      name: nextProfile.name,
      ...(nextProfile.role ? { role: nextProfile.role } : {}),
      anonymous: nextProfile.anonymous,
    });
    track(eventName, {
      testerId: nextProfile.testerId,
      anonymous: nextProfile.anonymous,
      ...(nextProfile.role ? { role: nextProfile.role } : {}),
    });
  }

  function createNamedProfile(name: string, role?: string) {
    persistProfile(createTesterProfile({ name, role, anonymous: false }), 'tester_profile_created');
  }

  function continueAnonymously() {
    persistProfile(createTesterProfile({ name: 'Anonymous tester', anonymous: true }), 'tester_profile_created');
  }

  function updateProfile(name: string, role?: string) {
    if (!profile) return;
    persistProfile(
      {
        ...profile,
        name,
        ...(role?.trim() ? { role: role.trim() } : { role: undefined }),
        anonymous: false,
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
        <button type="button" className="tester-profile-trigger" onClick={() => setModalMode('edit')}>
          <span>Testing as</span>
          <strong>{profile.name}</strong>
        </button>
      )}
      {modalMode && (
        <TesterProfileModal
          mode={modalMode}
          profile={profile}
          onSubmit={modalMode === 'create' ? createNamedProfile : updateProfile}
          onAnonymous={continueAnonymously}
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
  onSubmit: (name: string, role?: string) => void;
  onAnonymous: () => void;
  onCancel?: () => void;
  onReset?: () => void;
};

function TesterProfileModal({
  mode,
  profile,
  onSubmit,
  onAnonymous,
  onCancel,
  onReset,
}: TesterProfileModalProps) {
  const [name, setName] = useState(profile?.anonymous ? '' : profile?.name ?? '');
  const [role, setRole] = useState(profile?.role ?? '');
  const [showError, setShowError] = useState(false);

  function submit() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setShowError(true);
      return;
    }
    onSubmit(trimmedName, role);
  }

  return (
    <div className="tester-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="tester-modal-title">
      <section className="tester-modal">
        <div className="tester-modal-header">
          <div>
            <h2 id="tester-modal-title">{mode === 'create' ? 'Before you start' : 'Tester profile'}</h2>
            <p>Please enter your name so we can connect your feedback and usage during this prototype test.</p>
          </div>
        </div>

        <p className="tester-privacy-copy">
          This is only used for prototype testing and feedback analysis. Do not enter sensitive personal data.
        </p>

        <label className="tester-field">
          <span>Name {mode === 'create' ? '' : '(required)'}</span>
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setShowError(false);
            }}
            placeholder="Your name"
          />
          {showError && <small>Name is required unless you continue anonymously.</small>}
        </label>

        <label className="tester-field">
          <span>Role / team</span>
          <input
            value={role}
            onChange={(event) => setRole(event.target.value)}
            list="tester-role-options"
            placeholder="Support, Product, Engineering..."
          />
          <datalist id="tester-role-options">
            {roleOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </label>

        <div className="tester-modal-actions">
          {mode === 'edit' && onReset && (
            <button type="button" className="danger-button" onClick={onReset}>
              Reset tester profile
            </button>
          )}
          <div>
            {mode === 'create' ? (
              <button type="button" onClick={onAnonymous}>Continue anonymously</button>
            ) : (
              <button type="button" onClick={onCancel}>Cancel</button>
            )}
            <button type="button" className="primary-button" onClick={submit}>
              {mode === 'create' ? 'Start testing' : 'Save profile'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
