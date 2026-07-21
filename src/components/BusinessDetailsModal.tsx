import React, { useState, useMemo, useEffect } from 'react';
import { Business } from '../types';
import { textEn } from '../utils/englishOnly';
import { useDirectory } from '../context/DirectoryContext';
import { TRANSLATIONS } from '../data/translations';
import {
  X,
  MapPin,
  Phone,
  MessageSquare,
  Globe,
  Clock,
  Star,
  CheckCircle,
  Bookmark,
  Heart,
  ChevronRight,
  Send,
  AlertTriangle,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { businessLogoUrl, listingPlaceholderDataUrl, resolveListingCoverUrl } from '../utils/listingImages';
import { BusinessThumbnail } from './BusinessThumbnail';

interface BusinessDetailsModalProps {
  business: Business;
  onClose: () => void;
}

// ── Open Now helper ───────────────────────────────────────────
function isBusinessOpenNow(workingHours: string): boolean | null {
  try {
    const cleaned = workingHours.replace(/\(.*?\)/g, '').trim();
    const parts = cleaned.split('-').map((s) => s.trim());
    if (parts.length < 2) return null;
    const parseTime = (str: string) => {
      const m = str.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!m) return null;
      let h = parseInt(m[1]);
      const min = parseInt(m[2]);
      const period = m[3].toUpperCase();
      if (period === 'PM' && h !== 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;
      return h * 60 + min;
    };
    const open = parseTime(parts[0]);
    const close = parseTime(parts[1]);
    if (open === null || close === null) return null;
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    if (close < open) return cur >= open || cur <= close;
    return cur >= open && cur <= close;
  } catch {
    return null;
  }
}

export const BusinessDetailsModal: React.FC<BusinessDetailsModalProps> = ({ business, onClose }) => {
  const {
    language, reviews, currentUser, favorites, toggleFavorite,
    fetchReviewsForBusiness, submitReview, apiToken, isAuthenticated,
    blockListingOwner,
  } = useDirectory();
  const t = TRANSLATIONS[language];

  const isOpen = useMemo(() => isBusinessOpenNow(business.workingHours.en), [business.workingHours.en]);

  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const [reportReason, setReportReason] = useState('');
  const [reportError, setReportError] = useState('');
  const [reportSuccess, setReportSuccess] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [blockMsg, setBlockMsg] = useState('');

  useEffect(() => {
    fetchReviewsForBusiness(business.id);
  }, [business.id, fetchReviewsForBusiness]);

  // Filter reviews matching current business id
  const businessReviews = reviews.filter((r) => r.businessId === business.id);

  const isFav = favorites.includes(business.id);
  const isListingOwner = currentUser?.id === business.ownerId;
  const canReportListing = isAuthenticated && !isListingOwner && currentUser?.role !== 'admin';

  const handleBlockOwner = async () => {
    if (!business.ownerId) return;
    const ok = confirm('Block this listing owner? Their listings will be hidden for you.');
    if (!ok) return;
    setBlockBusy(true);
    setBlockMsg('');
    const result = await blockListingOwner(business.ownerId);
    setBlockBusy(false);
    if (!result.success) {
      setBlockMsg(result.error || 'Could not block.');
      return;
    }
    setBlockMsg('Owner blocked. Closing…');
    setTimeout(() => onClose(), 800);
  };

  const handleToggleFavorite = async () => {
    const result = await toggleFavorite(business.id);
    if (!result.success && result.error) {
      alert(result.error);
    }
  };

  const handleCreateReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewError('');
    setReviewSuccess('');

    if (!currentUser) {
      setReviewError(language === 'en' ? 'You must be signed in to submit a review!' : 'يجب تسجيل الدخول لإضافة تقييم!');
      return;
    }

    setIsSubmittingReview(true);
    const result = await submitReview(business.id, rating, comment);
    setIsSubmittingReview(false);

    if (!result.success) {
      setReviewError(result.error || (language === 'en' ? 'Could not submit review.' : 'تعذر إرسال التقييم.'));
      return;
    }

    setComment('');
    setRating(5);
    setReviewSuccess(language === 'en' ? 'Review posted! Jazakumullah Khayran.' : 'تم نشر المراجعة! جزاكم الله خيراً.');
    setTimeout(() => setReviewSuccess(''), 4000);
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setReportError('');
    setReportSuccess('');

    if (!apiToken) {
      setReportError(language === 'en' ? 'You must be signed in to report a listing.' : 'يجب تسجيل الدخول للإبلاغ عن نشاط.');
      return;
    }

    const trimmed = reportReason.trim();
    if (trimmed.length < 10) {
      setReportError(language === 'en' ? 'Please describe the issue in at least 10 characters.' : 'يرجى وصف المشكلة في 10 أحرف على الأقل.');
      return;
    }

    setIsSubmittingReport(true);
    try {
      const res = await apiFetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({ businessId: business.id, reason: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReportError(data.error || (language === 'en' ? 'Could not submit report.' : 'تعذر إرسال البلاغ.'));
        return;
      }
      setReportReason('');
      setReportSuccess(
        language === 'en'
          ? 'Report submitted. Our admin team will review it.'
          : 'تم إرسال البلاغ. سيقوم فريق الإدارة بمراجعته.'
      );
      setTimeout(() => setReportSuccess(''), 5000);
    } catch {
      setReportError(language === 'en' ? 'Cannot reach server. Try again later.' : 'تعذر الاتصال بالخادم. حاول لاحقاً.');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleActionClick = (actionType: 'phone' | 'whatsapp' | 'maps') => {
    if (actionType === 'phone') {
      window.open(`tel:${business.phone}`, '_self');
    } else if (actionType === 'whatsapp') {
      const prefilledText = encodeURIComponent(t.whatsappMessage);
      const url = `https://wa.me/${business.whatsapp}?text=${prefilledText}`;
      window.open(url, '_blank');
    } else if (actionType === 'maps') {
      // Open Google Maps with the business address
      const query = encodeURIComponent(`${business.name}, ${business.address}, ${business.city}, USA`);
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in" id="details-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative w-full max-w-2xl h-[90vh] overflow-y-auto rounded-3xl bg-[#0F0E0C] border border-[#2D2319] text-[#F4E3D7] scrollbar-thin" id="details-modal-container">
        
        {/* Floating Close & Favorite Buttons */}
        <div className="absolute top-4 right-4 z-10 flex gap-2" id="details-floating-controls">
          <button
            onClick={handleToggleFavorite}
            className={`p-2.5 rounded-full backdrop-blur-md border border-[#3A2E22] transition-colors ${
              isFav ? 'bg-[#FFA048] text-black hover:bg-opacity-95' : 'bg-black/50 text-[#F4E3D7] hover:bg-black/80'
            }`}
            title={t.saved}
            id="details-btn-fav"
          >
            <Heart className={`w-5 h-5 ${isFav ? 'fill-current' : ''}`} />
          </button>
          <button
            onClick={onClose}
            className="p-2.5 rounded-full backdrop-blur-md bg-black/50 hover:bg-black/80 text-[#FFA048] border border-[#3A2E22] transition-colors"
            id="details-btn-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cover Photo Banner */}
        <div className="relative h-48 md:h-64 w-full bg-slate-800" id="details-cover-wrapper">
          <img
            src={resolveListingCoverUrl(business.coverUrl, business.logoUrl, business.id, business.name)}
            alt={business.name}
            className="w-full h-full object-cover opacity-85 lazy-image"
            onLoad={(e) => e.currentTarget.classList.add('loaded')}
            onError={(e) => {
              (e.target as HTMLImageElement).src = listingPlaceholderDataUrl(
                business.name || business.id,
                { wide: true },
              );
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F0E0C] to-transparent"></div>
        </div>

        {/* Business Badge & Title Header */}
        <div className="relative px-6 pb-6 -mt-16" id="details-header-content">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            {/* Logo Avatar */}
            <div className="relative w-24 h-24 md:w-28 md:h-28 rounded-2xl overflow-hidden border-4 border-[#0F0E0C] bg-[#191613]" id="details-logo-wrapper">
              <BusinessThumbnail business={business} className="w-full h-full object-cover" />
            </div>

            {/* Verification & Location */}
            <div className="flex-1 min-w-0 md:mb-2">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider bg-[#201B15] text-[#FFA048] border border-[#2D2319]">
                  {textEn(business.subcategory)}
                </span>
                {business.isVerified && (
                  <span className="flex items-center gap-1 text-[10px] font-bold tracking-wider bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full">
                    <CheckCircle className="w-3 h-3 fill-current text-green-400" />
                    {t.verified}
                  </span>
                )}
                <span className="text-[10px] bg-[#2E2822] text-gray-300 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                  <MapPin className="w-3 h-3 text-[#FFA048]" />
                  {(t[business.city.replace(/\s+/g, '').toLowerCase() as keyof typeof t] as string) || business.city}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight" id="details-biz-title">
                {business.name}
              </h1>
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-gray-400 inline" />
                {business.address}, {business.area}
              </p>
            </div>

            {/* Quick rating bubble */}
            <div className="flex flex-col items-center bg-[#191613] border border-[#2D2319] p-2.5 rounded-2xl w-24">
              <span className="text-xl font-black text-[#FFA048] flex items-center gap-1">
                {business.rating} <Star className="w-4 h-4 fill-current" />
              </span>
              <span className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider block mt-1">
                {businessReviews.length} {language === 'en' ? 'Reviews' : 'تقييمات'}
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Warning for Suspended Account status */}
        {business.status === 'suspended' && (
          <div className="mx-6 mb-6 p-4 rounded-2xl bg-red-950/35 border border-red-900/60 text-red-300 flex items-start gap-3" id="details-suspended-alert">
            <span className="text-xl">⚠️</span>
            <div className="text-xs">
              <p className="font-bold">{language === 'en' ? 'Listing Suspended' : 'نشاط مجمد مؤقتاً'}</p>
              <p className="mt-1">
                {language === 'en'
                  ? 'This business listing is currently suspended due to missed membership updates. Customers cannot view this in normal search results.'
                  : 'تم تعليق تفعيل هذا النشاط بمجتمع الدليل لانتهاء مدة الاشتراك الشهري. لا يظهر هذا النشاط للزبائن في قائمة البحث العام.'}
              </p>
            </div>
          </div>
        )}

        {/* Main Details Body Grid */}
        <div className="px-6 pb-24 grid grid-cols-1 md:grid-cols-3 gap-6" id="details-grid-body">
          
          {/* Left/Middle Column (Description, Photo list, Review list) */}
          <div className="md:col-span-2 space-y-6">
            
            {/* Description Card */}
            <div className="p-5 rounded-2xl bg-[#13110E] border border-[#2D2319]">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#FFA048] mb-3">
                {language === 'en' ? 'About Our Business' : 'نبذة وتفاصيل العمل'}
              </h3>
              <p className="text-sm leading-relaxed text-gray-300 whitespace-pre-line">
                {textEn(business.description)}
              </p>

              {/* Working Hours with Open/Closed badge */}
              <div className="mt-5 pt-4 border-t border-[#2D2319]/60 flex items-center gap-3 text-xs text-gray-400">
                <Clock className="w-4 h-4 text-[#FFA048]" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <strong className="text-gray-200">{t.workingHours}:</strong>
                    {isOpen !== null && (
                      <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider ${isOpen ? 'badge-open' : 'badge-closed'}`}>
                        {isOpen ? '🟢 Open Now' : '🔴 Closed Now'}
                      </span>
                    )}
                  </div>
                  <span className="block mt-0.5">{textEn(business.workingHours)}</span>
                </div>
              </div>
            </div>

            {/* ── Rate This Business (interactive 5-star + POST /api/reviews) ── */}
            <div className="p-5 rounded-2xl bg-[#13110E] border border-[#FFA048]/25 space-y-4" id="details-rate-business">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-extrabold tracking-wider text-[#FFA048]">
                  {language === 'en' ? '⭐ Rate This Business' : '⭐ قيّم هذا النشاط'}
                </h3>
                <span className="text-[10px] text-gray-500">
                  {business.rating} ★ · {businessReviews.length} {language === 'en' ? 'reviews' : 'تقييم'}
                </span>
              </div>

              {!currentUser && (
                <p className="text-xs text-gray-400 bg-[#0F0E0C] border border-[#2D2319] rounded-xl p-3">
                  {language === 'en'
                    ? 'Please sign in to leave a star rating and review.'
                    : 'يرجى تسجيل الدخول لترك تقييم ومراجعة.'}
                </p>
              )}

              {reviewError && (
                <p className="text-red-400 text-xs bg-red-950/30 border border-red-900/50 rounded-xl p-2.5">{reviewError}</p>
              )}
              {reviewSuccess && (
                <p className="text-green-400 text-xs bg-green-950/30 border border-green-900/50 rounded-xl p-2.5">{reviewSuccess}</p>
              )}

              <form onSubmit={handleCreateReview} className="space-y-4">
                <div>
                  <p className="text-xs text-gray-400 mb-2">{t.ratingLabel}</p>
                  <div className="flex items-center gap-2" onMouseLeave={() => setHoverRating(0)}>
                    {[1, 2, 3, 4, 5].map((star) => {
                      const active = star <= (hoverRating || rating);
                      return (
                        <button
                          key={star}
                          type="button"
                          disabled={!currentUser || isSubmittingReview}
                          onMouseEnter={() => setHoverRating(star)}
                          onClick={() => setRating(star)}
                          className="p-1 rounded-lg focus:outline-none disabled:opacity-40 transition-transform hover:scale-110"
                          aria-label={`${star} star${star > 1 ? 's' : ''}`}
                        >
                          <Star
                            className={`w-8 h-8 transition-colors ${
                              active ? 'text-[#FFA048] fill-[#FFA048]' : 'text-gray-700 hover:text-gray-500'
                            }`}
                          />
                        </button>
                      );
                    })}
                    <span className="ml-2 text-sm font-extrabold text-[#FFA048]">
                      {hoverRating || rating}/5
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1.5" htmlFor="details-comment-input">
                    {language === 'en' ? 'Your review (optional)' : 'مراجعتك (اختياري)'}
                  </label>
                  <textarea
                    id="details-comment-input"
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    disabled={!currentUser || isSubmittingReview}
                    placeholder={language === 'en' ? 'Share your experience with this business…' : 'شارك تجربتك مع هذا النشاط…'}
                    className="w-full p-3 rounded-xl bg-[#0F0E0C] border border-[#2D2319] focus:border-[#FFA048] text-xs outline-none text-[#F4E3D7] transition-all disabled:opacity-50 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!currentUser || isSubmittingReview}
                  className="w-full py-3 rounded-xl bg-[#FFA048] hover:bg-opacity-95 text-black font-extrabold text-xs transition-all shadow-md disabled:opacity-40 flex items-center justify-center gap-2"
                  id="details-btn-submit-rating"
                >
                  <Send className="w-4 h-4" />
                  {isSubmittingReview
                    ? (language === 'en' ? 'Submitting…' : 'جارٍ الإرسال…')
                    : (language === 'en' ? 'Submit Rating' : 'إرسال التقييم')}
                </button>
              </form>
            </div>

            {/* Gallery Images Strip */}
            {business.gallery && business.gallery.length > 0 && (
              <div className="p-5 rounded-2xl bg-[#13110E] border border-[#2D2319]">
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#FFA048] mb-3">
                  {language === 'en' ? 'Photos & Service Shots' : 'صور المقر والخدمات'}
                </h3>
                <div className="grid grid-cols-2 gap-2" id="gallery-grid">
                  {business.gallery.map((img, i) => (
                    <div key={i} className="aspect-video rounded-xl overflow-hidden bg-stone-900 border border-[#2D2319]">
                      <img
                        src={img}
                        alt={`gallery-${i}`}
                        loading="lazy"
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = listingPlaceholderDataUrl(
                            business.name || business.id,
                            { wide: true },
                          );
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews Section */}
            <div className="p-5 rounded-2xl bg-[#13110E] border border-[#2D2319] space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#2D2319]">
                <h3 className="text-sm font-bold tracking-wider text-[#FFA048]">
                  {t.reviews}
                </h3>
                <span className="text-xs text-gray-400">
                  {businessReviews.length} {language === 'en' ? 'responses' : 'مشاركات'}
                </span>
              </div>

              {/* Display existing reviews list */}
              <div className="space-y-3.5" id="reviews-list">
                {businessReviews.length === 0 ? (
                  <p className="text-xs text-center text-gray-500 py-2">
                    {language === 'en' ? 'No community feedback yet. Be the first to review!' : 'لا توجد تقييمات من المجتمع حالياً. كن أول من يكتب تجربته!'}
                  </p>
                ) : (
                  businessReviews.map((rev) => (
                    <div key={rev.id} className="p-3.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319]/40">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-[#F4E3D7]">{rev.userName}</span>
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`w-3 h-3 ${
                                i < Math.floor(rev.rating)
                                  ? 'text-[#FFA048] fill-[#FFA048]'
                                  : 'text-gray-600'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed font-sans">{rev.comment}</p>
                      <span className="text-[9px] text-gray-500 block mt-1.5 text-right">{rev.date}</span>
                    </div>
                  ))
                )}
              </div>

              {/* Past reviews list only — submit form is above under "Rate This Business" */}
            </div>

            {/* Report listing — real submissions stored in backend */}
            <div className="p-5 rounded-2xl bg-[#13110E] border border-red-950/25 space-y-3" id="report-listing-section">
              <div className="flex items-center gap-2 pb-2 border-b border-[#2D2319]">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold tracking-wider text-amber-400">
                  {language === 'en' ? 'Report This Listing' : 'الإبلاغ عن هذا النشاط'}
                </h3>
              </div>
              <p className="text-[10px] text-gray-500 leading-relaxed">
                ABN is a directory only — not an endorsement. See Community Guidelines in Account. Deals happen outside the app.
              </p>
              {blockMsg && <p className="text-[10px] text-amber-400">{blockMsg}</p>}

              {!isAuthenticated ? (
                <p className="text-xs text-gray-500">
                  {language === 'en'
                    ? 'Sign in to report inaccurate information, unresponsive contact, or community concerns.'
                    : 'سجّل الدخول للإبلاغ عن معلومات غير دقيقة أو عدم الاستجابة أو مخاوف مجتمعية.'}
                </p>
              ) : !canReportListing ? (
                <p className="text-xs text-gray-500">
                  {language === 'en'
                    ? 'Listing owners and admins manage concerns through the account portal.'
                    : 'أصحاب النشاط والمسؤولون يديرون البلاغات من لوحة الحساب.'}
                </p>
              ) : (
                <form onSubmit={handleSubmitReport} className="space-y-3">
                  <textarea
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    placeholder={
                      language === 'en'
                        ? 'Describe the issue (e.g. wrong phone number, misleading info, unresponsive)...'
                        : 'صف المشكلة (مثل رقم خاطئ، معلومات مضللة، عدم الرد)...'
                    }
                    className="w-full p-3 text-xs rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-gray-200 placeholder:text-gray-600 resize-none"
                  />
                  {reportError && <p className="text-[10px] text-red-400">{reportError}</p>}
                  {reportSuccess && <p className="text-[10px] text-green-400">{reportSuccess}</p>}
                  <button
                    type="submit"
                    disabled={isSubmittingReport}
                    className="w-full py-2.5 rounded-xl text-xs font-bold bg-red-600/20 text-red-300 border border-red-600/30 hover:bg-red-600/30 disabled:opacity-50"
                  >
                    {isSubmittingReport
                      ? (language === 'en' ? 'Submitting...' : 'جاري الإرسال...')
                      : (language === 'en' ? 'Submit Report to Admin' : 'إرسال البلاغ للإدارة')}
                  </button>
                  <button
                    type="button"
                    onClick={handleBlockOwner}
                    disabled={blockBusy}
                    className="w-full py-2.5 rounded-xl text-xs font-bold border border-red-900/40 text-red-300 hover:bg-red-950/30 disabled:opacity-50"
                    id="btn-block-owner"
                  >
                    {blockBusy ? 'Blocking…' : 'Block This Owner'}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Right Column (Direct Actions Sidebar) */}
          <div className="space-y-6">

            {/* Instant Communication Action Buttons */}
            <div className="p-5 rounded-2xl bg-[#13110E] border border-[#2D2319] space-y-3" id="details-actions">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#FFA048] mb-1">
                {t.contactBusiness}
              </h3>
              
              {/* Call directly */}
              <button
                onClick={() => handleActionClick('phone')}
                className="w-full flex items-center justify-between p-3.5 rounded-xl bg-[#2E2822] hover:bg-[#3A332B] transition-all border border-[#3D3328] group"
                id="action-btn-call"
              >
                <span className="flex items-center gap-3 text-sm font-semibold">
                  <Phone className="w-4 h-4 text-[#FFA048]" />
                  {t.callNow}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white" />
              </button>

              {/* Whatsapp */}
              <button
                onClick={() => handleActionClick('whatsapp')}
                className="w-full flex items-center justify-between p-3.5 rounded-xl bg-green-500/10 hover:bg-green-500/20 transition-all border border-green-500/25 text-green-300 group"
                id="action-btn-whatsapp"
              >
                <span className="flex items-center gap-3 text-sm font-semibold">
                  <MessageSquare className="w-4 h-4 text-green-400" />
                  {t.openWhatsapp}
                </span>
                <ChevronRight className="w-4 h-4 text-green-500/60 group-hover:text-green-300" />
              </button>

              {/* Map Location — opens Google Maps externally (BRD §5.4: communication outside the app) */}
              <button
                onClick={() => handleActionClick('maps')}
                className="w-full flex items-center justify-between p-3.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 transition-all border border-blue-500/25 text-blue-300 group"
                id="action-btn-map"
              >
                <span className="flex items-center gap-3 text-sm font-semibold">
                  <MapPin className="w-4 h-4 text-blue-400" />
                  {t.openMap}
                </span>
                <ChevronRight className="w-4 h-4 text-blue-500/60 group-hover:text-blue-300" />
              </button>

              {/* Website link */}
              {business.website && (
                <a
                  href={business.website}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-between p-3.5 rounded-xl bg-[#2E2822] hover:bg-[#3A332B] transition-all border border-[#3D3328] group"
                  id="action-link-website"
                >
                  <span className="flex items-center gap-3 text-sm font-semibold text-[#F4E3D7]">
                    <Globe className="w-4 h-4 text-[#FFA048]" />
                    {t.openWebsite}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white" />
                </a>
              )}
            </div>

            {/* Real Google Map embed */}
            <div className="p-5 rounded-2xl bg-[#13110E] border border-[#2D2319] space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-widest text-[#FFA048]">
                {language === 'en' ? 'Map Location View' : 'موقع خارطة الدليل'}
              </h4>
              <div className="relative aspect-video rounded-xl overflow-hidden border border-[#2D2319] bg-stone-900" id="details-mini-map">
                <iframe
                  title="Google Maps"
                  className="w-full h-full border-0"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(`${business.name}, ${business.address}, ${business.city}, USA`)}&output=embed`}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                ></iframe>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
