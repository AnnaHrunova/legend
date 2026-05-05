import type { Macro } from '../domain/types';

export const macros: Macro[] = [
  {
    id: 'macro-more-details',
    name: 'Ask for more details',
    description: 'Use when the ticket lacks account, device, screenshot, or reproduction details.',
    category: 'general',
    body:
      'Thanks for reaching out. To investigate this properly, could you please send us the affected account, the exact steps you took before the issue appeared, and a screenshot or screen recording if available?\n\nOnce we have those details, we can check the right system and get back to you with the next step.',
    suggestedTags: ['needs-info'],
    suggestedStatus: 'Waiting on customer',
  },
  {
    id: 'macro-esim-install',
    name: 'eSIM installation troubleshooting',
    description: 'First response for failed QR scan, activation, or profile download.',
    category: 'esim',
    body:
      'Sorry the eSIM setup is not working as expected. Please try these steps first:\n\n1. Confirm the device is connected to Wi-Fi.\n2. Restart the device before scanning the QR code again.\n3. Make sure the eSIM was not already installed on another device.\n4. If activation still gets stuck, send us the device model and a screenshot of the error.\n\nWe will check the eSIM order and activation status from our side.',
    suggestedTags: ['esim', 'activation'],
    suggestedStatus: 'Pending',
    suggestedProjectIds: ['esim'],
  },
  {
    id: 'macro-refund-received',
    name: 'Refund request received',
    description: 'Acknowledges refund review without promising an outcome.',
    category: 'billing',
    body:
      'We received your refund request and are reviewing the order and payment history now. We will confirm whether the refund can be processed and share the expected timing as soon as the review is complete.',
    suggestedTags: ['refund'],
    suggestedStatus: 'Pending',
    suggestedProjectIds: ['payments', 'esim'],
  },
  {
    id: 'macro-payment-failed',
    name: 'Payment failed troubleshooting',
    description: 'Initial response for failed or reserved payments.',
    category: 'payments',
    body:
      'Sorry about the payment trouble. Please do not retry repeatedly while the payment is still marked as processing or reserved.\n\nWe are checking whether the payment failed before capture or whether it is waiting for reversal. If you can share the approximate time, amount, and payment method, we can locate the transaction faster.',
    suggestedTags: ['payment-failed'],
    suggestedStatus: 'Open',
    suggestedProjectIds: ['payments'],
  },
  {
    id: 'macro-documents-missing',
    name: 'Documents not received',
    description: 'For missing statements, compliance PDFs, and delivery delays.',
    category: 'documents',
    body:
      'Thanks for flagging this. We are checking document generation and delivery for your account.\n\nIf this is about a monthly statement or verification document, please confirm the document type and the date range you expected. We will resend or regenerate it if needed.',
    suggestedTags: ['documents'],
    suggestedStatus: 'Open',
    suggestedProjectIds: ['dms', 'notifications-service'],
  },
  {
    id: 'macro-push-notifications',
    name: 'Push notifications troubleshooting',
    description: 'For missing or delayed Android/iOS notifications.',
    category: 'notifications',
    body:
      'Sorry notifications are not arriving reliably. Please check that notifications are enabled both in the app and in your device settings, then restart the app.\n\nIf notifications are still delayed or missing, send us your device model, app version, and one recent example of a missing alert so we can inspect delivery logs.',
    suggestedTags: ['notifications'],
    suggestedStatus: 'Open',
    suggestedProjectIds: ['notifications-service'],
  },
  {
    id: 'macro-login-reset',
    name: 'Login reset instructions',
    description: 'For login loops, OTP issues, and password reset failures.',
    category: 'login',
    body:
      'I am sorry you are having trouble logging in. Please try resetting your password from the latest email link and avoid requesting several links at once, because older links expire automatically.\n\nIf the issue continues, reply with the approximate time of your last login attempt and whether you used password, OTP, or biometrics.',
    suggestedTags: ['login'],
    suggestedStatus: 'Waiting on customer',
    suggestedProjectIds: ['auth'],
  },
  {
    id: 'macro-known-issue',
    name: 'Known issue acknowledgement',
    description: 'Use when the ticket matches an active known issue.',
    category: 'general',
    body:
      'Thanks for reporting this. We are currently tracking a known issue that matches what you described. Our team is working on it, and we will update you here when we have a confirmed fix or workaround.\n\nYou do not need to create another ticket for the same issue.',
    suggestedTags: ['known-issue'],
    suggestedStatus: 'Pending',
  },
  {
    id: 'macro-closing-solved',
    name: 'Closing solved ticket',
    description: 'Clear closure reply that leaves the door open for reopening.',
    category: 'general',
    body:
      'We believe this issue is now resolved, so we are marking the ticket as solved. If anything still looks wrong, reply here and we will reopen the conversation.',
    suggestedTags: ['resolved'],
    suggestedStatus: 'Solved',
  },
];
