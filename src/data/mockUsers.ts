import type { Agent } from '../domain/types';

export const currentUser: Agent = {
  id: 'agent-001',
  name: 'Anna Kovacs',
  email: 'anna.kovacs@example.internal',
  role: 'Lead',
  team: 'Technical Support',
  online: true,
};

export const agents: Agent[] = [
  currentUser,
  {
    id: 'agent-002',
    name: 'Marta Levin',
    email: 'marta.levin@example.internal',
    role: 'Agent',
    team: 'Billing',
    online: true,
  },
  {
    id: 'agent-003',
    name: 'Nikolai Petrov',
    email: 'nikolai.petrov@example.internal',
    role: 'Agent',
    team: 'Technical Support',
    online: false,
  },
  {
    id: 'agent-004',
    name: 'Priya Shah',
    email: 'priya.shah@example.internal',
    role: 'Admin',
    team: 'Compliance',
    online: true,
  },
  {
    id: 'agent-005',
    name: 'Jonas Meyer',
    email: 'jonas.meyer@example.internal',
    role: 'Agent',
    team: 'Product Support',
    online: true,
  },
  {
    id: 'agent-006',
    name: 'Elena Ruiz',
    email: 'elena.ruiz@example.internal',
    role: 'Lead',
    team: 'Billing',
    online: false,
  },
  {
    id: 'agent-007',
    name: 'Sam Carter',
    email: 'sam.carter@example.internal',
    role: 'Agent',
    team: 'Compliance',
    online: true,
  },
  {
    id: 'agent-008',
    name: 'Rina Okafor',
    email: 'rina.okafor@example.internal',
    role: 'Agent',
    team: 'Product Support',
    online: false,
  },
];
