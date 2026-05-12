import { useEffect, useMemo, useState } from 'react';
import { getTesterProfile, type TesterProfile } from '../analytics/testerProfile';
import { agents, currentUser } from '../data/mockUsers';
import type { Agent, Team } from '../domain/types';

export function getActiveAgent(profile = getTesterProfile()): Agent {
  if (!profile) return currentUser;

  const existingAgent = agents.find(
    (agent) =>
      agent.email.toLowerCase() === profile.email.toLowerCase() ||
      agent.name.toLowerCase() === profile.fullName.toLowerCase(),
  );

  if (existingAgent) return existingAgent;

  return {
    id: `tester-${profile.testerId}`,
    name: profile.fullName,
    email: profile.email,
    role: roleFromTesterProfile(profile.role),
    team: teamFromTesterProfile(profile.role),
    online: true,
  };
}

export function getAssignableAgents(activeAgent = getActiveAgent()): Agent[] {
  const knownAgents = agents.filter(
    (agent) =>
      agent.id !== activeAgent.id &&
      agent.email.toLowerCase() !== activeAgent.email.toLowerCase() &&
      agent.name.toLowerCase() !== activeAgent.name.toLowerCase(),
  );

  return [activeAgent, ...knownAgents];
}

export function useActiveAgent(): Agent {
  const [profile, setProfile] = useState<TesterProfile | undefined>(() => getTesterProfile());

  useEffect(() => {
    const onProfileChanged = () => setProfile(getTesterProfile());
    window.addEventListener('legend-desk-tester-profile-changed', onProfileChanged);
    return () => window.removeEventListener('legend-desk-tester-profile-changed', onProfileChanged);
  }, []);

  return useMemo(() => getActiveAgent(profile), [profile]);
}

export function useAssignableAgents(): Agent[] {
  const activeAgent = useActiveAgent();
  return useMemo(() => getAssignableAgents(activeAgent), [activeAgent]);
}

function roleFromTesterProfile(role: string): Agent['role'] {
  const normalized = role.toLowerCase();
  if (normalized.includes('admin')) return 'Admin';
  if (normalized.includes('lead') || normalized.includes('manager') || normalized.includes('operations')) return 'Lead';
  return 'Agent';
}

function teamFromTesterProfile(role: string): Team {
  const normalized = role.toLowerCase();
  if (normalized.includes('billing')) return 'Billing';
  if (normalized.includes('compliance')) return 'Compliance';
  if (normalized.includes('product')) return 'Product Support';
  return 'Technical Support';
}
