import type { Macro } from '../domain/types';

export const macros: Macro[] = [
  {
    id: 'macro-info',
    name: 'Ask for more information',
    target: 'reply',
    body:
      'Thanks for reaching out. Could you share the affected account, a screenshot of the error, and the steps that led to it? Once we have that, we can investigate without guessing.',
  },
  {
    id: 'macro-refund',
    name: 'Refund request received',
    target: 'reply',
    body:
      'We received your refund request and are reviewing the billing history now. We will follow up with the outcome and any required next steps shortly.',
  },
  {
    id: 'macro-bug',
    name: 'Bug report escalation',
    target: 'note',
    body:
      'Escalating to Product Support. Include environment, customer impact, frequency, reproduction steps, and any linked logs before handoff.',
  },
  {
    id: 'macro-close',
    name: 'Closing solved ticket',
    target: 'reply',
    body:
      'We believe this issue is resolved, so we are marking the ticket as solved. Reply here if anything still looks off and we will reopen the conversation.',
  },
];
