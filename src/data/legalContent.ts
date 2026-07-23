/** Store-facing legal & help copy. Hosted mirrors live under /legal/*.html */

export type LegalDocId =
  | 'privacy'
  | 'terms'
  | 'guidelines'
  | 'faq'
  | 'subscription'
  | 'disclaimers';

export const SUPPORT_EMAIL = 'yammtech80@gmail.com';
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=ABN%20Support`;

/** Public paths when the static site is deployed (Render / web). */
export const LEGAL_PATHS: Record<LegalDocId, string> = {
  privacy: '/legal/privacy.html',
  terms: '/legal/terms.html',
  guidelines: '/legal/guidelines.html',
  faq: '/legal/faq.html',
  subscription: '/legal/subscription.html',
  disclaimers: '/legal/disclaimers.html',
};

export const LEGAL_DOCS: Record<
  LegalDocId,
  { title: string; updated: string; sections: { heading: string; body: string }[] }
> = {
  privacy: {
    title: 'Privacy Policy',
    updated: 'July 21, 2026',
    sections: [
      {
        heading: 'Who we are',
        body: 'Ahle Bait Network (ABN) operates a community business directory and job board. We are a technology platform that helps users discover listings; we are not a bank, payment intermediary for peer services, or a nonprofit charity unless separately stated in writing by a licensed entity.',
      },
      {
        heading: 'Information we collect',
        body: 'Account data (name, email, phone, password hash), listing and job content you submit, favorites, reports, device/app diagnostics, and purchase/membership status related to directory visibility subscriptions processed by Apple App Store or Google Play.',
      },
      {
        heading: 'How we use information',
        body: 'To create and secure accounts, show directory and job content, moderate submissions, process membership renewals via store billing, send service notices, and improve safety and reliability.',
      },
      {
        heading: 'Payments',
        body: 'Digital membership fees for listing visibility are processed by Apple or Google (In-App Purchase / Play Billing). ABN does not collect card numbers inside the app for those memberships. Communication between customers and businesses (calls, WhatsApp, etc.) happens outside the app.',
      },
      {
        heading: 'Sharing',
        body: 'We share data with infrastructure providers (e.g. hosting, database), app stores for purchases, and when required by law or to address abuse. Public listing fields you publish are visible to other users.',
      },
      {
        heading: 'Retention & security',
        body: 'We retain account and listing data while your account is active and as needed for legal, security, and moderation purposes. Access is protected with industry-standard practices including hashed passwords and authenticated APIs.',
      },
      {
        heading: 'Your rights',
        body: 'You may update profile information, request support, and delete your account from Account → Delete Account. After deletion we remove or anonymize personal account data subject to legal retention needs.',
      },
      {
        heading: 'Contact',
        body: `Privacy questions: ${SUPPORT_EMAIL}`,
      },
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    updated: 'July 21, 2026',
    sections: [
      {
        heading: 'Agreement',
        body: 'By using ABN you agree to these Terms, our Privacy Policy, Community Guidelines, and Subscription Terms. If you do not agree, do not use the app.',
      },
      {
        heading: 'The service',
        body: 'ABN provides a directory index and job board for community discovery. ABN does not sell goods, employ job applicants, guarantee business quality, or mediate disputes between users.',
      },
      {
        heading: 'Accounts',
        body: 'You must provide accurate information, keep credentials secure, and complete email verification. You are responsible for activity under your account. We may suspend or terminate accounts that violate these Terms or the law.',
      },
      {
        heading: 'Listings & jobs',
        body: 'Business and job posts must be lawful, accurate, and yours to publish. We may approve, reject, edit visibility, or remove content. Paid memberships affect directory visibility and do not guarantee leads or sales.',
      },
      {
        heading: 'Subscriptions',
        body: 'Paid plans renew according to Apple/Google rules. See Subscription Terms. Restore Purchases is available on iOS where required.',
      },
      {
        heading: 'Disclaimers',
        body: 'THE SERVICE IS PROVIDED “AS IS.” TO THE MAXIMUM EXTENT PERMITTED BY LAW, ABN DISCLAIMS WARRANTIES OF MERCHANTABILITY, FITNESS, AND NON-INFRINGEMENT. WE ARE NOT LIABLE FOR USER CONTENT, OFF-APP TRANSACTIONS, OR EMPLOYMENT OUTCOMES.',
      },
      {
        heading: 'Contact',
        body: `Legal: ${SUPPORT_EMAIL}`,
      },
    ],
  },
  guidelines: {
    title: 'Community Guidelines',
    updated: 'July 21, 2026',
    sections: [
      {
        heading: 'Be respectful',
        body: 'No hate, harassment, scams, impersonation, or illegal content. Treat community members with dignity.',
      },
      {
        heading: 'Honest listings',
        body: 'Only list businesses/services you are authorized to represent. Photos and descriptions must be truthful. No spam or misleading categories.',
      },
      {
        heading: 'Jobs',
        body: 'Job posts must be real openings. Do not post discriminatory requirements prohibited by law. Applicants contact employers directly; ABN is not the employer.',
      },
      {
        heading: 'Reporting & blocking',
        body: 'Use Report on a listing to flag problems. You may Block a listing owner to hide their content from your experience. Admins review reports and may remove content or ban accounts.',
      },
      {
        heading: 'Enforcement',
        body: 'Violations may result in content removal, suspension, or permanent ban without refund where permitted by store policies and law.',
      },
    ],
  },
  faq: {
    title: 'FAQ',
    updated: 'July 21, 2026',
    sections: [
      {
        heading: 'How do I list my business?',
        body: 'Sign in → Home/Portal → submit your business or service. An admin reviews it before it appears publicly.',
      },
      {
        heading: 'What are membership fees?',
        body: 'Directory visibility plans are billed monthly through Apple or Google after any trial period. See Subscription Terms.',
      },
      {
        heading: 'How do I restore a purchase (iOS)?',
        body: 'Open Manage Business/Service → Restore Purchases. Purchases must be made with the same Apple ID.',
      },
      {
        heading: 'How do I delete my account?',
        body: 'Account → Delete Account. This permanently removes your login and associated personal data as described in the Privacy Policy.',
      },
      {
        heading: 'How do I contact support?',
        body: `Email ${SUPPORT_EMAIL} or use Contact Support in Account.`,
      },
      {
        heading: 'How do I report abuse?',
        body: 'Open a listing → Report This Listing. Optionally Block the owner. Read Community Guidelines for rules.',
      },
    ],
  },
  subscription: {
    title: 'Subscription Terms',
    updated: 'July 21, 2026',
    sections: [
      {
        heading: 'Plans',
        body: 'Business Monthly (product id abn_business_monthly) and Service Monthly (abn_service_monthly) unlock or extend directory visibility for the purchased period after admin approval and any free trial.',
      },
      {
        heading: 'Billing',
        body: 'Payment is charged to your Apple ID or Google Play account at confirmation of purchase. Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period (Apple) or per Google Play cancellation rules.',
      },
      {
        heading: 'Managing & cancelling',
        body: 'Manage or cancel in device subscription settings (iOS Settings → Apple ID → Subscriptions, or Google Play → Payments & subscriptions). Deleting the app does not cancel a subscription.',
      },
      {
        heading: 'Restore Purchases',
        body: 'iOS users can Restore Purchases in the membership screen to re-link prior store entitlements to their ABN account.',
      },
      {
        heading: 'Refunds',
        body: 'Refund requests are handled by Apple or Google under their policies. ABN does not process card refunds inside the app.',
      },
    ],
  },
  disclaimers: {
    title: 'Business & Job Disclaimers',
    updated: 'July 21, 2026',
    sections: [
      {
        heading: 'Directory only',
        body: 'ABN lists community businesses and professionals for discovery. Inclusion is not an endorsement, certification, or guarantee of quality, licensing, or Islamic compliance.',
      },
      {
        heading: 'Off-app dealings',
        body: 'Calls, messages, payments for goods/services, and contracts are between you and the business. ABN is not a party to those transactions.',
      },
      {
        heading: 'Jobs',
        body: 'Job posts are provided by third-party businesses. ABN is not the employer, recruiter, or staffing agency and is not responsible for hiring decisions or employment terms.',
      },
    ],
  },
};
