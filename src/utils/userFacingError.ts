/**
 * Map API / network failures to clear, condition-specific English messages.
 */

type ErrorContext =
  | 'login'
  | 'register'
  | 'listing'
  | 'review'
  | 'reply'
  | 'report'
  | 'favorite'
  | 'job'
  | 'generic';

const NETWORK_MSG =
  'Connecting to the server… If this keeps happening, wait about a minute and try again.';

const byStatus = (status: number | undefined, context: ErrorContext): string | null => {
  if (!status) return null;
  if (status === 401) {
    if (context === 'login') return 'Incorrect email or password.';
    return 'Your session expired. Please sign in again.';
  }
  if (status === 403) {
    if (context === 'login') return 'This account is blocked. Contact support for help.';
    if (context === 'job') {
      return 'You cannot manage jobs yet. Your listing must be approved, active, and hiring enabled.';
    }
    if (context === 'listing') {
      return 'This action is not allowed for your account or listing status.';
    }
    if (context === 'reply') return 'Only the listing owner can reply to reviews.';
    return 'You do not have permission for this action.';
  }
  if (status === 404) {
    if (context === 'login' || context === 'register') return 'No account found with that email.';
    if (context === 'favorite') return 'That listing was not found or is no longer available.';
    return 'The requested item was not found.';
  }
  if (status === 409) {
    if (context === 'register') return 'An account with this email already exists. Sign in instead.';
    if (context === 'listing') return 'You already have a directory listing on this account.';
    if (context === 'review') return 'You already reviewed this listing. Only one review per listing is allowed.';
    if (context === 'report') return 'You already have an open report for this listing.';
    return 'This action conflicts with an existing record.';
  }
  if (status === 429) {
    return 'Too many requests from this network. Please wait a minute and try again.';
  }
  if (status === 503) {
    return 'Service temporarily unavailable. Please try again shortly.';
  }
  if (status >= 500) {
    return 'Something went wrong on the server. Please try again in a moment.';
  }
  return null;
};

/** Normalize server / client error text into a specific user-facing English message. */
export function userFacingError(
  raw: unknown,
  opts: { status?: number; context?: ErrorContext } = {},
): string {
  const context = opts.context || 'generic';
  const text = String(
    (raw && typeof raw === 'object' && 'error' in (raw as object)
      ? (raw as { error?: unknown }).error
      : raw) ?? '',
  ).trim();
  const lower = text.toLowerCase();

  if (!text || lower === 'failed to fetch' || lower.includes('networkerror')) {
    return byStatus(opts.status, context) || NETWORK_MSG;
  }

  // ── Auth / account ──────────────────────────────────────────────────────
  if (lower.includes('invalid email or password') || lower === 'login failed.') {
    return 'Incorrect email or password.';
  }
  if (lower.includes('blocked')) {
    return text.startsWith('This account')
      ? text
      : 'This account has been blocked. Contact support for help.';
  }
  if (lower.includes('email not verified') || lower.includes('needsemailverification')) {
    return 'Please verify your email with the 6-digit code we sent you before signing in.';
  }
  if (lower.includes('already exists')) {
    return context === 'listing'
      ? 'You already have a directory listing on this account.'
      : 'An account with this email already exists. Sign in instead.';
  }
  if (lower.includes('invalid or expired verification') || lower.includes('invalid or expired reset')) {
    return 'That code is invalid or expired. Request a new code and try again.';
  }
  if (lower.includes('account not found') || lower.includes('user not found')) {
    return 'No account found with that email.';
  }
  if (lower.includes('password must be') || lower.includes('passwords do not match')) {
    return text;
  }
  if (lower.includes('current password is incorrect')) {
    return 'Current password is incorrect.';
  }
  if (lower.includes('invalid token') || lower.includes('authentication required') || lower.includes('log in again')) {
    return 'Your session expired. Please sign in again.';
  }
  if (lower.includes('could not send') && lower.includes('email')) {
    return 'We could not send the email right now. Wait a minute and tap Resend.';
  }
  if (lower.includes('smtp') || lower.includes('brevo')) {
    return 'Email delivery is temporarily unavailable. Please try again later.';
  }

  // ── Listing / registration / change requests ────────────────────────────
  if (lower.includes('change_request_required') || lower.includes('cannot be changed directly')) {
    return 'Name and photos are locked. Submit a change request for admin approval.';
  }
  if (lower.includes('pending name/photo') || lower.includes('pending') && lower.includes('change request')) {
    return 'You already have a pending name/photo change request. Wait for admin review.';
  }
  if (lower.includes('must be approved before requesting')) {
    return 'Your listing must be approved by an admin before you can request name or photo changes.';
  }
  if (lower.includes('directory profile already exists')) {
    return 'You already have a directory listing on this account.';
  }
  if (lower.includes('must be approved before') && lower.includes('hiring')) {
    return 'Your listing must be approved before you can enable hiring or post jobs.';
  }
  if (lower.includes('suspended') && (lower.includes('renew') || lower.includes('membership'))) {
    return 'Your listing is suspended. Renew membership to continue.';
  }
  if (lower.includes('hiring is not active')) {
    return 'Hiring is turned off. Enable hiring from your Account / Portal first.';
  }
  if (lower.includes('only registered business')) {
    return 'Only approved business or service listings can post or manage jobs.';
  }
  if (lower.includes('register as a business')) {
    return 'Register a business listing first, then you can post jobs.';
  }

  // ── Reviews / reports / favorites ───────────────────────────────────────
  if (lower.includes('already reviewed')) {
    return 'You already reviewed this listing. Only one review per listing is allowed.';
  }
  if (lower.includes('only the listing owner can reply')) {
    return 'Only the listing owner can reply to reviews.';
  }
  if (lower.includes('already have an open report')) {
    return 'You already have an open report for this listing. Wait for admin review.';
  }
  if (lower.includes('only active directory listings can be saved')) {
    return 'Only active, approved listings can be saved to favorites.';
  }
  if (lower.includes('must be signed in') || lower.includes('sign in to')) {
    return text;
  }

  // ── Rate limit ──────────────────────────────────────────────────────────
  if (lower.includes('too many')) {
    return 'Too many requests from this network. Please wait a minute and try again.';
  }

  const statusMsg = byStatus(opts.status, context);
  if (statusMsg && (text.length < 8 || lower.includes('internal') || lower.includes('unexpected'))) {
    return statusMsg;
  }

  // Prefer the server’s own clear English message when present
  if (text.length >= 8 && !lower.includes('error:') && !/^error$/i.test(text)) {
    return text;
  }

  return statusMsg || NETWORK_MSG;
}

export function networkErrorMessage(): string {
  return NETWORK_MSG;
}
