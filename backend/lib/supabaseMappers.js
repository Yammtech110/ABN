'use strict';

/** Map profiles_directory row → API camelCase shape */
const mapProfileFromDb = (row) => ({
  id:                 String(row.id),
  email:              row.email,
  listingType:        row.listing_type || 'business',
  businessName:       row.business_name || '',
  category:           row.category || '',
  subscriptionStatus: row.subscription_status || 'pending',
  subscriptionTier:   row.subscription_tier != null ? Number(row.subscription_tier) : undefined,
  imageUrl:           row.image_url || '',
  coverUrl:           row.cover_url || '',
  description:        row.description || '',
  address:            row.address || '',
  area:               row.area || '',
  city:               row.city || '',
  phone:              row.phone || '',
  whatsapp:           row.whatsapp || '',
  website:            row.website || '',
  workingHours:       row.working_hours || '',
  hiringActive:       Boolean(row.hiring_active),
  isVerified:         Boolean(row.is_verified),
  isActive:           row.is_active !== false,
  rating:             Number(row.rating) || 0,
  reviewsCount:       Number(row.reviews_count) || 0,
  membershipExpiry:   row.membership_expiry || null,
  createdAt:          row.created_at || null,
});

/** DB role values for profiles_directory (see migrations/001_init_supabase.sql) */
const listingTypeToDbRole = (listingType) =>
  listingType === 'service' ? 'service_provider' : 'business_owner';

const mapProfileToDb = (api, { email } = {}) => {
  const row = {};
  if (email !== undefined) row.email = email;
  if (api.role !== undefined) {
    row.role = api.role;
  } else if (api.listingType !== undefined) {
    row.role = listingTypeToDbRole(api.listingType);
  }
  if (api.listingType !== undefined) row.listing_type = api.listingType;
  if (api.businessName !== undefined) row.business_name = api.businessName;
  if (api.category !== undefined) row.category = api.category;
  if (api.subscriptionStatus !== undefined) row.subscription_status = api.subscriptionStatus;
  if (api.subscriptionTier !== undefined) row.subscription_tier = api.subscriptionTier;
  if (api.imageUrl !== undefined) row.image_url = api.imageUrl;
  if (api.coverUrl !== undefined) row.cover_url = api.coverUrl;
  if (api.description !== undefined) row.description = api.description;
  if (api.address !== undefined) row.address = api.address;
  if (api.area !== undefined) row.area = api.area;
  if (api.city !== undefined) row.city = api.city;
  if (api.phone !== undefined) row.phone = api.phone;
  if (api.whatsapp !== undefined) row.whatsapp = api.whatsapp;
  if (api.website !== undefined) row.website = api.website;
  if (api.workingHours !== undefined) row.working_hours = api.workingHours;
  if (api.hiringActive !== undefined) row.hiring_active = api.hiringActive;
  if (api.isVerified !== undefined) row.is_verified = api.isVerified;
  if (api.isActive !== undefined) row.is_active = api.isActive;
  if (api.rating !== undefined) row.rating = api.rating;
  if (api.reviewsCount !== undefined) row.reviews_count = api.reviewsCount;
  if (api.membershipExpiry !== undefined) row.membership_expiry = api.membershipExpiry;
  return row;
};

const mapJobFromDb = (row) => ({
  id:              String(row.id),
  businessId:      String(row.business_id),
  businessName:    row.business_name || '',
  businessLogoUrl: row.business_logo_url || '',
  title:           row.title || '',
  category:        row.category || 'Others',
  requirements:    row.requirements || '',
  salaryMin:       Number(row.salary_min) || 0,
  salaryMax:       Number(row.salary_max) || 0,
  hiringEmail:     row.hiring_email || '',
  isActive:        Boolean(row.is_active),
  postedDate:      row.posted_date || null,
  createdAt:       row.created_at || null,
});

const mapJobToDb = (api) => {
  const row = {};
  if (api.id !== undefined) row.id = api.id;
  if (api.businessId !== undefined) row.business_id = api.businessId;
  if (api.businessName !== undefined) row.business_name = api.businessName;
  if (api.businessLogoUrl !== undefined) row.business_logo_url = api.businessLogoUrl;
  if (api.title !== undefined) row.title = api.title;
  if (api.category !== undefined) row.category = api.category;
  if (api.requirements !== undefined) row.requirements = api.requirements;
  if (api.salaryMin !== undefined) row.salary_min = api.salaryMin;
  if (api.salaryMax !== undefined) row.salary_max = api.salaryMax;
  if (api.hiringEmail !== undefined) row.hiring_email = api.hiringEmail;
  if (api.isActive !== undefined) row.is_active = api.isActive;
  if (api.postedDate !== undefined) row.posted_date = api.postedDate;
  return row;
};

const mapReviewFromDb = (row) => ({
  id:         String(row.id),
  businessId: String(row.business_id),
  userId:     row.user_id,
  userName:   row.user_name,
  rating:     row.rating_score,
  comment:    row.comment || '',
  date:       row.review_date,
});

const mapReportFromDb = (row) => ({
  id:            String(row.id),
  businessId:    String(row.business_id),
  businessName:  row.business_name || '',
  reporterId:    row.reporter_id,
  reporterName:  row.reporter_name || '',
  reporterEmail: row.reporter_email || '',
  reason:        row.reason || '',
  status:        row.status || 'open',
  adminNotes:    row.admin_notes || '',
  date:          row.created_at ? String(row.created_at).slice(0, 10) : '',
  resolvedAt:    row.resolved_at || null,
  createdAt:     row.created_at || null,
});

const mapUserFromDb = (row) => ({
  id:                row.id,
  email:             row.email,
  phone:             row.phone || '',
  name:              row.name,
  role:              row.role,
  passwordHash:      row.password_hash,
  preferredLanguage: row.preferred_language || 'en',
  isBlocked:         Boolean(row.is_blocked),
  // Missing column / legacy rows → treat as verified
  emailVerified:     row.email_verified === undefined || row.email_verified === null
    ? true
    : Boolean(row.email_verified),
});

const mapUserToDb = (user) => ({
  id:                 user.id,
  email:              user.email,
  phone:              user.phone || '',
  name:               user.name,
  role:               user.role,
  password_hash:      user.passwordHash,
  preferred_language: user.preferredLanguage || 'en',
  ...(user.emailVerified !== undefined ? { email_verified: Boolean(user.emailVerified) } : {}),
  ...(user.isBlocked !== undefined ? { is_blocked: Boolean(user.isBlocked) } : {}),
});

module.exports = {
  mapProfileFromDb,
  mapProfileToDb,
  mapJobFromDb,
  mapJobToDb,
  mapReviewFromDb,
  mapReportFromDb,
  mapUserFromDb,
  mapUserToDb,
};
