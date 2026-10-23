/* RipZone compliance config (single place to edit). DEMO / STUB level: real vendors plug in where marked.
   TODO(counsel): confirm the restricted-state list and the review list before launch. Not legal advice. */
window.RZ_COMPLIANCE = {
  MIN_AGE: 18,
  VAULT_HOLD_DAYS: 5, // unshipped Vault cards auto-sell at the standard buyback (Store Credit) after this many days
  // Players located in these states are blocked at onboarding. TODO(counsel): confirm this list.
  BLOCKED_STATES: ['NV'], // v0.11.0: matches Rips (Nevada only). Server list: RZ_BLOCKED_STATES env. Candidates for counsel: WA, ID, MI, LA, MT, CT
  HELP: { phone: '1-800-GAMBLER', url: 'https://www.ncpgambling.org/help-treatment/' },
  // Allowed for now but flagged for counsel review (shown as a notice, not blocked). TODO(counsel).
  REVIEW_STATES: [],
  DEPOSIT: { MIN: 1, MAX: 5000, CHIPS: [10, 25, 50, 100, 250] },
  // Vendor hooks (not connected in this build):
  KYC_PROVIDER: 'Footprint',      // e.g. identity/age verification SDK goes here
  GEO_PROVIDER: null,                // e.g. geolocation/geofencing SDK; self-declared state only in this build
  PAYMENTS_PROVIDER: 'Coinflow',           // payment processor for deposits
  SUPPORT_EMAIL: 'RipZoneApp@gmail.com',
};
