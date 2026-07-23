import React, { useEffect, useMemo, useState } from 'react';
import { useDirectory } from '../context/DirectoryContext';
import { apiFetch } from '../lib/api';
import { TRANSLATIONS } from '../data/translations';
import { ImageUploadGrid } from './ImageUploadGrid';
import {
  CreditCard,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Briefcase,
  History,
  Gift,
  Star,
  RefreshCw,
  Mail,
  Phone,
  User,
  Heart,
  UserCheck,
  CheckCircle,
  Lock,
  Edit,
  ArrowRight,
  ArrowLeft,
  Zap,
  Smartphone,
  BadgeCheck,
} from 'lucide-react';
import { Business, PaymentRecord } from '../types';
import { US_STATES } from '../data/usStates';
import {
  formatUSPhoneInput,
  formatZipInput,
  isValidUSPhone,
  normalizeUSPhone,
  validateDirectoryRegistration,
} from '../utils/businessRegistrationValidation';
import { bilingualEn, textEn } from '../utils/englishOnly';
import { canManageListing, getUserListing, listingKind } from '../utils/listingAccess';
import { filterNotificationsForUser } from '../utils/notifications';
import {
  IAP_PRODUCTS,
  purchaseSubscription,
  restorePurchases,
  getTrialEndDate,
  getDaysRemaining,
} from '../hooks/useInAppPurchase';

const isLegacyMockImage = (url?: string): boolean =>
  Boolean(
    url &&
      /images\.unsplash\.com\/photo-1542838132|images\.unsplash\.com\/photo-1578916171728/i.test(url),
  );

const isUsableUploadSrc = (url?: string): boolean => {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  // Never re-submit API media paths or the old shared grocery mock as "uploads"
  if (trimmed.includes('/api/directory/')) return false;
  if (isLegacyMockImage(trimmed)) return false;
  return trimmed.startsWith('data:image/') || /^https?:\/\//i.test(trimmed);
};

const buildListingImages = (gallery: string[] | undefined, logoUrl?: string): string[] => {
  // Keep API media URLs for preview in the grid; submit path filters via isUsableUploadSrc
  const fromGallery = (gallery ?? []).filter((url) => url && !isLegacyMockImage(url)).slice(0, 5);
  if (fromGallery.length > 0) return fromGallery;
  if (logoUrl && !isLegacyMockImage(logoUrl)) return [logoUrl];
  return [];
};

interface BusinessPortalTabProps {
  onBack?: () => void;
  manageMode?: boolean;
  registrationOnly?: boolean;
}

export const BusinessPortalTab: React.FC<BusinessPortalTabProps> = ({
  onBack,
  manageMode = false,
  registrationOnly = false,
}) => {
  const {
    language,
    currentUser,
    businesses,
    categories,
    payments,
    addBusiness,
    updateBusiness,
    renewMembership,
    apiToken,
    refreshDirectory,
    notifications,
    refreshNotifications,
    signOut,
  } = useDirectory();

  useEffect(() => {
    refreshNotifications();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const portalNotifications = useMemo(
    () => filterNotificationsForUser(notifications, currentUser).filter((n) => !n.isRead),
    [notifications, currentUser],
  );
  const latestPortalAlert = portalNotifications[0];

  // Derive plan price by listing type
  const myBusiness = getUserListing(currentUser, businesses);
  const kind = listingKind(myBusiness);
  const planAmount = kind === 'service' ? 30 : 50;
  const t = TRANSLATIONS[language];

  // Forms Toggle / Tab
  const [activePortalTab, setActivePortalTab] = useState<'dash' | 'edit' | 'pay'>('dash');

  // Find business registered to current owner
  const [isSavingManage, setIsSavingManage] = useState(false);

  // Registration Flow State
  const [registrationType, setRegistrationType] = useState<'business' | 'service' | null>(null);

  // Registration Form State
  const [regName, setRegName] = useState('');
  const [regCatId, setRegCatId] = useState(categories[0]?.id || '');
  const [regDesc, setRegDesc] = useState('');
  const [regState, setRegState] = useState('');
  const [regCity, setRegCity] = useState('');
  const [regZipCode, setRegZipCode] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regWhatsapp, setRegWhatsapp] = useState('');
  const [regWeb, setRegWeb] = useState('');
  const [regHours, setRegHours] = useState('8:00 AM - 10:00 PM');
  const [regImages, setRegImages] = useState<string[]>([]);
  const [regCoverImages, setRegCoverImages] = useState<string[]>([]);
  const [regSuccess, setRegSuccess] = useState('');
  const [regError, setRegError] = useState('');
  const [regPhotoError, setRegPhotoError] = useState('');
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);
  const [showApprovalNotice, setShowApprovalNotice] = useState(false);

  React.useEffect(() => {
    if (!registrationType) return;
    if (registrationType === 'service') {
      const serviceCat = categories.find((c) => c.group === 'Services');
      if (serviceCat) setRegCatId(serviceCat.id);
    } else {
      setRegCatId(categories[0]?.id || '');
    }
  }, [registrationType, categories]);

  // Pre-fill onboarding form when managing an approved listing
  React.useEffect(() => {
    if (!manageMode || !myBusiness) return;
    const listingKindValue = listingKind(myBusiness);
    setRegistrationType(listingKindValue);
    setRegName(myBusiness.name);
    setRegDesc(textEn(myBusiness.description));
    setRegState(myBusiness.subcategory.en || '');
    setRegCity(String(myBusiness.city || ''));
    setRegZipCode(myBusiness.area || '');
    setRegAddress(myBusiness.address || '');
    setRegPhone(myBusiness.phone || '');
    setRegWhatsapp(myBusiness.whatsapp || '');
    setRegWeb(myBusiness.website || '');
    setRegHours(textEn(myBusiness.workingHours) || '');
    setRegImages(buildListingImages(myBusiness.gallery, myBusiness.logoUrl));
    setRegCoverImages(
      myBusiness.coverUrl && isUsableUploadSrc(myBusiness.coverUrl)
        ? [myBusiness.coverUrl]
        : (myBusiness.coverUrl && myBusiness.coverUrl !== myBusiness.logoUrl ? [myBusiness.coverUrl] : []),
    );
    if (listingKindValue === 'service') {
      const serviceCat = categories.find((c) => c.group === 'Services');
      if (serviceCat) setRegCatId(serviceCat.id);
    } else if (myBusiness.categoryId) {
      setRegCatId(myBusiness.categoryId);
    }
  }, [manageMode, myBusiness?.id, language, categories]);

  // ── Bug #3 Fix: Edit form state — initialized empty, populated via useEffect ──
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editHours, setEditHours] = useState('');
  const [editImages, setEditImages] = useState<string[]>([]);
  const [editCover, setEditCover] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  // Populate edit fields whenever myBusiness changes (e.g. after sign-in)
  React.useEffect(() => {
    if (myBusiness) {
      setEditName(myBusiness.name);
      setEditDesc(textEn(myBusiness.description));
      setEditPhone(myBusiness.phone);
      setEditWhatsapp(myBusiness.whatsapp);
      setEditHours(textEn(myBusiness.workingHours));
      setEditImages(buildListingImages(myBusiness.gallery, myBusiness.logoUrl));
      setEditCover(myBusiness.coverUrl);
    }
  }, [myBusiness?.id]);

  // IAP Payment state
  const [payError, setPayError] = useState('');
  const [paySuccess, setPaySuccess] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentRecord | null>(null);
  const [isProcessingPay, setIsProcessingPay] = useState(false);
  const [isRestoringPurchases, setIsRestoringPurchases] = useState(false);

  // ── IAP Subscribe — native Google Play / Apple payment, then record on server ──
  const handleIAPSubscribe = async () => {
    if (!myBusiness) return;
    setPayError('');
    setPaySuccess('');
    setIsProcessingPay(true);

    const productId = kind === 'service'
      ? IAP_PRODUCTS.SERVICE_MONTHLY
      : IAP_PRODUCTS.BUSINESS_MONTHLY;

    const result = await purchaseSubscription(productId);

    if (!result.success) {
      setPayError(result.error || (language === 'en' ? 'Payment was not completed.' : 'لم يكتمل الدفع.'));
      setIsProcessingPay(false);
      return;
    }

    const renewal = await renewMembership(myBusiness.id, planAmount);
    if (!renewal.success) {
      setPayError(renewal.error || (language === 'en' ? 'Payment succeeded but activation failed. Contact support.' : 'تم الدفع لكن فشل التفعيل. تواصل مع الدعم.'));
      setIsProcessingPay(false);
      return;
    }

    setPaySuccess(language === 'en'
      ? '✅ Subscription activated! Your listing is now live in the directory.'
      : '✅ تم تفعيل الاشتراك! ظهر نشاطك في الدليل.');
    setTimeout(() => { setPaySuccess(''); setActivePortalTab('dash'); }, 3000);
    setIsProcessingPay(false);
  };

  // ── Restore previous purchases (required by Apple guidelines) ──
  const handleRestorePurchases = async () => {
    if (!myBusiness) return;
    setIsRestoringPurchases(true);
    setPayError('');
    const purchases = await restorePurchases();
    if (purchases.length > 0) {
      const renewal = await renewMembership(myBusiness.id, planAmount);
      if (renewal.success) {
        setPaySuccess(language === 'en' ? 'Purchases restored successfully!' : 'تم استعادة الاشتراك بنجاح!');
      } else {
        setPayError(renewal.error || (language === 'en' ? 'Could not activate restored subscription.' : 'تعذر تفعيل الاشتراك المستعاد.'));
      }
    } else {
      setPayError(language === 'en' ? 'No previous purchases found to restore.' : 'لا توجد اشتراكات سابقة لاستعادتها.');
    }
    setIsRestoringPurchases(false);
  };

  // ── Free trial detection ──
  const trialDaysRemaining = React.useMemo(() => {
    if (!myBusiness?.membershipExpiryDate) return 0;
    return getDaysRemaining(myBusiness.membershipExpiryDate);
  }, [myBusiness?.membershipExpiryDate]);

  const isOnFreeTrial = React.useMemo(() => {
    if (!myBusiness) return false;
    // If the expiry is > 45 days from now, it was set as a 60-day trial
    return trialDaysRemaining > 45;
  }, [myBusiness, trialDaysRemaining]);

  // ── Subscription expiry warning (within 7 days, after trial) ──
  const expiryWarning = React.useMemo(() => {
    if (!myBusiness?.membershipExpiryDate) return null;
    if (isOnFreeTrial) return null; // don't warn during trial
    const diffDays = getDaysRemaining(myBusiness.membershipExpiryDate);
    if (diffDays <= 0) return { days: diffDays, type: 'expired' as const };
    if (diffDays <= 7) return { days: diffDays, type: 'warning' as const };
    return null;
  }, [myBusiness?.membershipExpiryDate, isOnFreeTrial]);

  // Handle registration submission
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registrationType) return;
    setRegPhotoError('');

    const isServiceReg = registrationType === 'service';
    const photoRequiredMsg = isServiceReg ? t.servicePhotoRequired : t.photoRequired;

    const validationError = validateDirectoryRegistration(
      {
        name: regName,
        description: regDesc,
        state: regState,
        city: regCity,
        zipCode: regZipCode,
        address: regAddress,
        operatingHours: regHours,
        phone: regPhone,
        whatsapp: regWhatsapp,
        images: regImages,
        kind: registrationType || 'business',
      },
      {
        allFieldsRequired: t.allFieldsRequired,
        photoRequired: photoRequiredMsg,
        phoneInvalid: t.phoneInvalid,
        zipInvalid: t.zipInvalid,
        stateRequired: t.stateRequired,
        hoursRequired: t.hoursRequired,
      },
    );

    if (validationError) {
      if (validationError === photoRequiredMsg) setRegPhotoError(validationError);
      setRegError(validationError);
      return;
    }

    if (!apiToken) {
      setRegError(t.emailVerificationRequired);
      return;
    }

    const normalizedPhone = normalizeUSPhone(regPhone);
    const formattedPhone = `+${normalizedPhone}`;

    setIsSubmittingReg(true);
    setRegError('');

    const defaultLogo = regImages[0];
    const defaultCover = regCoverImages[0] || regImages[0];
    const gallery = regImages;
    const cat = categories.find((c) => c.id === regCatId);
    const categoryLabel = cat?.name.en || 'General';

    try {
      const res = await apiFetch('/api/directory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({
          businessName: regName,
          category: categoryLabel,
          description: regDesc,
          imageUrl: defaultLogo,
          coverUrl: defaultCover,
          address: regAddress,
          area: regZipCode,
          city: regCity,
          phone: formattedPhone,
          whatsapp: regWhatsapp.trim() || formattedPhone,
          website: regWeb,
          workingHours: regHours,
          subscriptionTier: registrationType === 'service' ? 30 : 50,
          listingType: registrationType,
          state: regState,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = String(data.error || '');
        if (res.status === 401 || /invalid token|log in again|authentication required/i.test(errMsg)) {
          await signOut();
          setRegError('Your session expired. Please sign in again, then submit your listing.');
          return;
        }
        setRegError(data.error || t.allFieldsRequired);
        return;
      }

      const newBiz: Business = {
        id: String(data.id ?? `biz-${Date.now()}`),
        ownerId: currentUser!.email,
        name: regName,
        logoUrl: defaultLogo,
        coverUrl: defaultCover,
        description: { en: regDesc, ar: regDesc },
        categoryId: regCatId,
        subcategory: { en: regState, ar: regState },
        listingType: registrationType || 'business',
        address: regAddress,
        city: regCity as Business['city'],
        area: regZipCode,
        isVerified: false,
        status: 'pending',
        phone: formattedPhone,
        whatsapp: regWhatsapp.trim() || formattedPhone,
        website: regWeb,
        workingHours: { en: regHours, ar: regHours },
        // 2 MONTHS FREE TRIAL: Set expiry to 60 days from today for all new registrations
      membershipExpiryDate: getTrialEndDate(),
        subscriptionTier: registrationType === 'service' ? 30 : 50,
        gallery,
        rating: 0,
        reviewsCount: 0,
      };
      addBusiness(newBiz);
      await refreshDirectory();
      setShowApprovalNotice(true);
      setRegError('');
      setRegPhotoError('');
    } catch {
      setRegError(language === 'en' ? 'Could not complete registration. Please try again.' : 'تعذر إكمال التسجيل. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmittingReg(false);
    }
  };

  const handleManageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myBusiness || !registrationType) return;
    setRegPhotoError('');

    const isServiceReg = registrationType === 'service';
    const photoRequiredMsg = isServiceReg ? t.servicePhotoRequired : t.photoRequired;

    const validationError = validateDirectoryRegistration(
      {
        name: regName,
        description: regDesc,
        state: regState,
        city: regCity,
        zipCode: regZipCode,
        address: regAddress,
        operatingHours: regHours,
        phone: regPhone,
        whatsapp: regWhatsapp,
        // Existing listings already have photos on the server — don't force re-upload
        images: regImages.length > 0
          ? regImages
          : (myBusiness.logoUrl || myBusiness.coverUrl ? ['existing'] : []),
        kind: registrationType,
      },
      {
        allFieldsRequired: t.allFieldsRequired,
        photoRequired: photoRequiredMsg,
        phoneInvalid: t.phoneInvalid,
        zipInvalid: t.zipInvalid,
        stateRequired: t.stateRequired,
        hoursRequired: t.hoursRequired,
      },
    );

    if (validationError) {
      if (validationError === photoRequiredMsg) setRegPhotoError(validationError);
      setRegError(validationError);
      return;
    }

    const cat = categories.find((c) => c.id === regCatId);
    const categoryLabel = cat?.name.en || myBusiness.subcategory.en;
    const uploadedLogo = regImages.find(isUsableUploadSrc);
    const uploadedCover = regCoverImages.find(isUsableUploadSrc);
    const formattedPhone = isValidUSPhone(regPhone) ? `+${normalizeUSPhone(regPhone)}` : regPhone.trim();

    setIsSavingManage(true);
    setRegError('');

    const updatedBiz: Business = {
      ...myBusiness,
      name: regName,
      description: bilingualEn(regDesc),
      subcategory: { en: regState, ar: regState },
      categoryId: regCatId,
      address: regAddress,
      city: regCity as Business['city'],
      area: regZipCode,
      phone: formattedPhone,
      whatsapp: regWhatsapp.trim() || formattedPhone,
      website: regWeb,
      workingHours: bilingualEn(regHours),
      logoUrl: uploadedLogo || myBusiness.logoUrl,
      coverUrl: uploadedCover || uploadedLogo || myBusiness.coverUrl,
      gallery: regImages.filter(isUsableUploadSrc).length > 0
        ? regImages.filter(isUsableUploadSrc)
        : myBusiness.gallery,
    };

    updateBusiness(updatedBiz);

    if (apiToken) {
      try {
        const body: Record<string, unknown> = {
          businessName: regName,
          category: categoryLabel,
          description: regDesc,
          address: regAddress,
          area: regZipCode,
          city: regCity,
          phone: formattedPhone,
          whatsapp: regWhatsapp.trim() || formattedPhone,
          website: regWeb,
          workingHours: regHours,
        };
        if (uploadedLogo) {
          body.imageUrl = uploadedLogo;
        }
        if (uploadedCover || uploadedLogo) {
          body.coverUrl = uploadedCover || uploadedLogo;
        }
        await apiFetch(`/api/directory/${myBusiness.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiToken}`,
          },
          body: JSON.stringify(body),
        });
        await refreshDirectory();
      } catch {
        console.warn('[ABN] Could not sync listing update to server.');
      }
    }

    setRegSuccess(t.profileUpdated || (language === 'en' ? 'Listing updated successfully!' : 'تم تحديث الإدراج بنجاح!'));
    setRegError('');
    setIsSavingManage(false);
    setTimeout(() => setRegSuccess(''), 4000);
  };

  // Profile update submit
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myBusiness) return;

    const uploadedLogo = editImages.find(isUsableUploadSrc);
    const uploadedCover = editImages.filter(isUsableUploadSrc)[1] || (isUsableUploadSrc(editCover) ? editCover : '');

    const updatedBiz: Business = {
      ...myBusiness,
      name: editName,
      description: bilingualEn(editDesc),
      phone: editPhone,
      whatsapp: editWhatsapp,
      workingHours: bilingualEn(editHours),
      logoUrl: uploadedLogo || myBusiness.logoUrl,
      coverUrl: uploadedCover || uploadedLogo || myBusiness.coverUrl,
      gallery: editImages.filter(isUsableUploadSrc).length > 0
        ? editImages.filter(isUsableUploadSrc)
        : myBusiness.gallery,
    };

    updateBusiness(updatedBiz);

    if (apiToken) {
      try {
        const body: Record<string, unknown> = {
          businessName: editName,
          description: editDesc,
          phone: editPhone,
          whatsapp: editWhatsapp,
          workingHours: editHours,
        };
        if (uploadedLogo) body.imageUrl = uploadedLogo;
        if (uploadedCover || uploadedLogo) body.coverUrl = uploadedCover || uploadedLogo;
        await apiFetch(`/api/directory/${myBusiness.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiToken}`,
          },
          body: JSON.stringify(body),
        });
        await refreshDirectory();
      } catch {
        console.warn('[ABN] Could not sync portal profile edit to server.');
      }
    }

    setEditSuccess(language === 'en' ? 'Profile details updated successfully!' : 'تم تحديث بيانات الصفحة بنجاح!');
    setTimeout(() => setEditSuccess(''), 4000);
    setActivePortalTab('dash');
  };

  // Filters payments matching current business
  const businessPayments = payments.filter((p) => p.businessId === (myBusiness?.id || ''));
  const isManageForm = Boolean(manageMode && myBusiness && canManageListing(myBusiness));

  const approvalNoticeModal = showApprovalNotice ? (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      id="registration-approval-notice"
      role="dialog"
      aria-modal="true"
      aria-labelledby="approval-notice-title"
    >
      <div className="relative w-full max-w-sm rounded-3xl bg-[#13110E] border border-[#2D2319] p-6 text-center shadow-xl">
        <Clock className="w-10 h-10 text-[#FFA048] mx-auto mb-3" />
        <h3 id="approval-notice-title" className="text-sm font-black text-white mb-2">
          Approval Time is 24 hours
        </h3>
        <p className="text-[11px] text-gray-400 leading-relaxed mb-5">
          {language === 'en'
            ? 'Your submission was received and is pending admin review. It will not appear in public search until approved.'
            : 'تم استلام طلبك وهو قيد مراجعة المسؤول. لن يظهر في البحث العام حتى الموافقة.'}
        </p>
        <button
          type="button"
          onClick={() => setShowApprovalNotice(false)}
          className="w-full py-2.5 rounded-xl bg-[#FFA048] text-black text-xs font-extrabold uppercase tracking-wide"
          id="btn-dismiss-approval-notice"
        >
          OK
        </button>
      </div>
    </div>
  ) : null;

  const backHeader = onBack ? (
    <div className="flex items-center gap-3 pb-3 border-b border-[#2D2319]">
      <button
        onClick={onBack}
        className="p-2 rounded-full bg-[#191613] hover:bg-[#2D251C] border border-[#2D2319] transition-colors"
        aria-label="Back"
      >
        <ArrowLeft className="w-4 h-4 text-[#FFA048]" />
      </button>
      <div>
        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
          {kind === 'service'
            ? (language === 'en' ? 'Manage Service' : 'إدارة الخدمة')
            : (language === 'en' ? 'Manage Business' : 'إدارة النشاط التجاري')}
        </span>
        {myBusiness && (
          <h2 className="text-base font-extrabold text-[#F4E3D7] leading-tight flex items-center gap-2">
            {kind === 'service'
              ? <Zap className="w-4 h-4 text-blue-400" />
              : <Briefcase className="w-4 h-4 text-[#FFA048]" />}
            {myBusiness.name}
          </h2>
        )}
      </div>
    </div>
  ) : null;

  if (manageMode && !myBusiness) {
    return (
      <>
        {approvalNoticeModal}
      <div className="space-y-6" id="portal-manage-empty">
        {backHeader}
        <div className="text-center py-12 px-6 rounded-3xl bg-[#13110E] border border-[#2D2319]">
          <Briefcase className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-xs text-gray-400">
            {language === 'en'
              ? 'No directory listing found for your account yet.'
              : 'لا يوجد إدراج في الدليل لحسابك بعد.'}
          </p>
        </div>
      </div>
      </>
    );
  }

  if (manageMode && myBusiness && !canManageListing(myBusiness)) {
    return (
      <>
        {approvalNoticeModal}
      <div className="space-y-6" id="portal-manage-pending">
        {backHeader}
        <div className="text-center py-12 px-6 rounded-3xl bg-[#13110E] border border-amber-700/30">
          <Clock className="w-10 h-10 text-amber-400 mx-auto mb-3" />
          <h3 className="text-sm font-black text-white mb-2">
            {kind === 'service' ? t.manageService : t.manageBusiness}
          </h3>
          <p className="text-xs text-amber-200/80 max-w-sm mx-auto">{t.listingPending}</p>
        </div>
      </div>
      </>
    );
  }

  if (registrationOnly && myBusiness) {
    return (
      <>
        {approvalNoticeModal}
      <div className="space-y-6" id="portal-registration-blocked">
        <div className="text-center py-12 px-6 rounded-3xl bg-[#13110E] border border-[#2D2319]">
          <AlertTriangle className="w-10 h-10 text-[#FFA048] mx-auto mb-3" />
          <p className="text-xs text-gray-300 max-w-sm mx-auto">
            {!canManageListing(myBusiness) ? t.listingPending : t.listingExists}
          </p>
        </div>
      </div>
      </>
    );
  }

  return (
    <>
      {approvalNoticeModal}
    <div className="space-y-6" id="portal-tab-container">

      {latestPortalAlert && (
        <div className="p-3.5 rounded-2xl bg-[#FFA048]/10 border border-[#FFA048]/30 flex gap-2.5 items-start">
          <AlertTriangle className="w-4 h-4 text-[#FFA048] shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-[10px] font-black text-[#FFA048] uppercase tracking-wider">{latestPortalAlert.title}</p>
            <p className="text-[10px] text-gray-300 mt-1 leading-relaxed">{latestPortalAlert.message}</p>
          </div>
        </div>
      )}

      {/* Back navigation header — only rendered when accessed as a sub-page */}
      {backHeader}

      {/* NO LISTING (register) OR MANAGE MODE (edit pre-filled onboarding form) */}
      {!myBusiness || isManageForm ? (
        !registrationType && !isManageForm ? (
          <div className="space-y-4 animate-fade-in-up" id="portal-registration-selection">
            <div className="pb-1 border-b border-[#2D2319]">
              <h2 className="text-xl font-extrabold text-[#F4E3D7]">
                {language === 'en' ? 'Choose Registration Type' : 'اختر نوع التسجيل'}
              </h2>
              <p className="text-[10px] text-gray-500 font-medium">
                {language === 'en' ? 'Select how you want to join the community directory.' : 'اختر كيف تريد الانضمام إلى دليل المجتمع.'}
              </p>
            </div>
            
            <div className="grid grid-cols-1 gap-4 mt-4">
              <button
                onClick={() => setRegistrationType('business')}
                className="p-5 rounded-3xl bg-[#13110E] border border-[#2D2319] hover:border-[#FFA048] transition-all flex flex-col text-left space-y-2 group shadow-sm active:scale-95"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-2xl bg-[#FFA048]/10 flex items-center justify-center border border-[#FFA048]/30 group-hover:scale-105 transition-transform">
                      <Briefcase className="w-5 h-5 text-[#FFA048]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white">{language === 'en' ? 'Register as a Business' : 'سجل كصاحب عمل'}</h3>
                      <span className="text-[10px] font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-md mt-1 inline-block border border-green-500/20">🎁 FREE 2 Months, then $50/mo</span>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-[#FFA048] transition-colors" />
                </div>
                <p className="text-[10px] text-gray-400 mt-2 ml-[52px]">
                  {language === 'en' ? 'Best for shops, restaurants, and physical store locations.' : 'الأفضل للمتاجر والمطاعم والمواقع التجارية الفعلية.'}
                </p>
              </button>

              <button
                onClick={() => setRegistrationType('service')}
                className="p-5 rounded-3xl bg-[#13110E] border border-[#2D2319] hover:border-blue-500 transition-all flex flex-col text-left space-y-2 group shadow-sm active:scale-95"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/30 group-hover:scale-105 transition-transform">
                      <UserCheck className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white">{language === 'en' ? 'Register as a Service Provider' : 'سجل كمقدم خدمة'}</h3>
                      <span className="text-[10px] font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-md mt-1 inline-block border border-green-500/20">🎁 FREE 2 Months, then $30/mo</span>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-blue-400 transition-colors" />
                </div>
                <p className="text-[10px] text-gray-400 mt-2 ml-[52px]">
                  {language === 'en' ? 'Best for independent professionals, plumbers, and freelancers.' : 'الأفضل للمهنيين المستقلين والحرفيين.'}
                </p>
              </button>
            </div>
          </div>
        ) : (
        <div className="space-y-4 animate-fade-in" id="portal-registration-form-section">
          <div className="flex items-center gap-3 pb-1 border-b border-[#2D2319]">
            {!isManageForm && (
            <button 
              onClick={() => {
                setRegistrationType(null);
                setRegError('');
                setRegPhotoError('');
                setRegSuccess('');
                setRegCoverImages([]);
              }}
              className="p-1.5 rounded-full bg-[#191613] hover:bg-[#2D251C] transition-colors border border-[#2D2319]"
            >
              <ArrowRight className="w-4 h-4 text-gray-400 rotate-180" />
            </button>
            )}
            <div>
              <h2 className="text-xl font-extrabold text-[#F4E3D7]">
                {isManageForm
                  ? (kind === 'service' ? t.manageService : t.manageBusiness)
                  : (registrationType === 'business' ? t.registerBusiness : t.registerService)}
              </h2>
              <p className="text-[10px] text-gray-500 font-medium">
                {isManageForm
                  ? (language === 'en' ? 'Update your directory listing details below.' : 'حدّث بيانات إدراجك في الدليل أدناه.')
                  : (language === 'en'
                    ? `Reach Shia community customers directly for $${registrationType === 'business' ? '50' : '30'}/month.`
                    : `انضم لدليل أعمال المجتمع وتواصل مع آلاف الزبائن بقيمة ${registrationType === 'business' ? '50$' : '30$'} شهرياً.`)}
              </p>
            </div>
          </div>

          <form onSubmit={isManageForm ? handleManageSubmit : handleRegisterSubmit} className="space-y-4 p-5 rounded-3xl bg-[#13110E] border border-[#2D2319]" id={registrationType === 'service' ? 'service-reg-form' : 'biz-reg-form'}>
            {regSuccess && <p className="p-3 bg-green-950/45 border border-green-900 text-green-300 text-xs rounded-xl">{regSuccess}</p>}
            {regError && <p className="p-3 bg-red-950/45 border border-red-900 text-red-300 text-xs rounded-xl">{regError}</p>}

            {/* ── Logo / profile photos ── */}
            <ImageUploadGrid
              id="reg-image-upload"
              images={regImages}
              onChange={(next) => {
                setRegImages(next);
                if (next.length > 0) setRegPhotoError('');
              }}
              language={language}
              required
              errorMessage={regPhotoError}
              label={
                registrationType === 'business'
                  ? (language === 'en' ? 'Business logo / photos' : 'شعار / صور النشاط')
                  : (language === 'en' ? 'Service provider photo' : 'صورة مزود الخدمة')
              }
              hint={
                language === 'en'
                  ? 'Up to 5 images · 1MB max each · First image is your profile logo.'
                  : 'حتى 5 صور · 1 ميجابايت كحد أقصى · الصورة الأولى هي الشعار.'
              }
            />

            {/* ── Separate cover / background banner ── */}
            <ImageUploadGrid
              id="reg-cover-upload"
              images={regCoverImages}
              onChange={setRegCoverImages}
              language={language}
              maxImages={1}
              label={
                language === 'en'
                  ? 'Background / cover photo (banner)'
                  : 'صورة الخلفية / الغلاف'
              }
              hint={
                language === 'en'
                  ? 'Wide banner shown at the top of your listing. Optional — if empty, your logo is used.'
                  : 'بانر عريض أعلى صفحة نشاطك. اختياري — إن تُرك فارغاً يُستخدم الشعار.'
              }
            />

            <div className={registrationType === 'business' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : ''}>
              <div className={registrationType === 'business' ? '' : 'w-full'}>
                <label className="block text-xs text-gray-400 mb-1">
                  {registrationType === 'business' ? t.businessName : t.serviceProviderName}*
                </label>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder={
                    registrationType === 'business'
                      ? (language === 'en' ? 'e.g. Al-Kawthar Grocery' : 'مثال: بقالة الكوثر')
                      : (language === 'en' ? 'e.g. Hassan Al-Rashid' : 'مثال: حسن الراشد')
                  }
                  className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-white outline-none focus:border-[#FFA048]"
                  required
                />
              </div>

              {registrationType === 'business' && (
                <div>
                  <label className="block text-xs app-label mb-1">{t.selectCategory}*</label>
                  <select
                    value={regCatId}
                    onChange={(e) => setRegCatId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border text-xs app-field outline-none focus:border-[#FFA048]"
                    required
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name.en}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">{t.description}*</label>
              <textarea
                value={regDesc}
                rows={3}
                placeholder={
                  registrationType === 'business'
                    ? (language === 'en' ? 'Describe your business, services, and what makes you stand out…' : 'صف نشاطك التجاري وخدماتك…')
                    : (language === 'en' ? 'Describe your professional services, skills, and service area…' : 'صف خدماتك المهنية ومجال عملك…')
                }
                onChange={(e) => setRegDesc(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-white placeholder-gray-600 outline-none focus:border-[#FFA048]/40 transition-colors resize-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs app-label mb-1">{t.state}*</label>
              <select
                value={regState}
                onChange={(e) => setRegState(e.target.value)}
                className="w-full p-2.5 rounded-xl border text-xs app-field outline-none focus:border-[#FFA048]"
                required
              >
                <option value="">{language === 'en' ? 'Select state…' : 'اختر الولاية…'}</option>
                {US_STATES.map(({ code, name }) => (
                  <option key={code} value={code}>
                    {code} — {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs app-label mb-1">{t.city}*</label>
                <select
                  value={regCity}
                  onChange={(e) => setRegCity(e.target.value)}
                  className="w-full p-2.5 rounded-xl border text-xs app-field outline-none focus:border-[#FFA048]"
                  required
                >
                  <option value="" disabled>{language === 'en' ? 'Select City' : 'اختر المدينة'}</option>
                  <option value="New York">{t.newyork}</option>
                  <option value="Los Angeles">{t.losangeles}</option>
                  <option value="Chicago">{t.chicago}</option>
                  <option value="Houston">{t.houston}</option>
                  <option value="Miami">{t.miami}</option>
                  <option value="Dearborn">{t.dearborn}</option>
                  <option value="Dallas">{t.dallas}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{t.zipCode}*</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{5}"
                  maxLength={5}
                  value={regZipCode}
                  onChange={(e) => setRegZipCode(formatZipInput(e.target.value))}
                  placeholder="77001"
                  className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-white placeholder-gray-600 outline-none focus:border-[#FFA048]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">{t.address}*</label>
              <input
                type="text"
                value={regAddress}
                onChange={(e) => setRegAddress(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-white outline-none focus:border-[#FFA048]"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">
                {registrationType === 'business' ? t.businessOperationalHours : t.serviceAvailabilityHours}*
              </label>
              <input
                type="text"
                value={regHours}
                onChange={(e) => setRegHours(e.target.value)}
                placeholder={language === 'en' ? 'e.g. Mon–Sat 9:00 AM – 9:00 PM' : 'مثال: الإثنين–السبت 9:00 ص – 9:00 م'}
                className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-white placeholder-gray-600 outline-none focus:border-[#FFA048]"
                required
              />
            </div>

            {isManageForm ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t.phone}*</label>
                  <input
                    type="tel"
                    value={regPhone}
                    placeholder={t.phoneHint}
                    onChange={(e) => setRegPhone(formatUSPhoneInput(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-white placeholder-gray-600 outline-none focus:border-[#FFA048]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t.whatsapp}</label>
                  <input
                    type="tel"
                    placeholder={t.phoneHint}
                    value={regWhatsapp}
                    onChange={(e) => setRegWhatsapp(formatUSPhoneInput(e.target.value))}
                    className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-white placeholder-gray-600 outline-none focus:border-[#FFA048]/40"
                  />
                </div>
              </div>
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">{t.phone}*</label>
                <input
                  type="tel"
                  value={regPhone}
                  placeholder={t.phoneHint}
                  onChange={(e) => setRegPhone(formatUSPhoneInput(e.target.value))}
                  className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-white placeholder-gray-600 outline-none focus:border-[#FFA048]"
                  required
                />
                <p className="mt-1 text-[9px] text-gray-600">{t.phoneHint}</p>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{t.whatsapp}</label>
                <input
                  type="tel"
                  placeholder={t.phoneHint}
                  value={regWhatsapp}
                  onChange={(e) => setRegWhatsapp(formatUSPhoneInput(e.target.value))}
                  className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-white placeholder-gray-600 outline-none focus:border-[#FFA048]/40"
                />
              </div>
            </div>
            )}

            <button
              type="submit"
              disabled={isManageForm ? isSavingManage : isSubmittingReg}
              className="w-full py-3 mt-4 bg-[#FFA048] hover:bg-opacity-95 text-black font-extrabold rounded-2xl text-xs tracking-wider uppercase transition-all shadow-[0_0_15px_rgba(255,160,72,0.4)] hover:shadow-[0_0_20px_rgba(255,160,72,0.6)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              id="btn-register-biz"
            >
              {isManageForm
                ? (isSavingManage ? (language === 'en' ? 'Saving…' : 'جاري الحفظ…') : (language === 'en' ? 'Save Changes' : 'حفظ التغييرات'))
                : (isSubmittingReg ? (language === 'en' ? 'Submitting…' : 'جارٍ الإرسال…') : t.submitApplication)}
            </button>
          </form>
        </div>
        )
      ) : (
        
        /* BUSINESS REGISTERED: DISPLAY DASHBOARD CONSOLE */
        <div className="space-y-5" id="portal-owner-dashboard">
          
          {/* Header row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#2D2319]">
            <div>
              <span className="text-[10px] text-[#FFA048] font-bold uppercase tracking-wider block">
                {t.businessPortal} Dashboard
              </span>
              <h2 className="text-xl font-bold text-[#F4E3D7] flex items-center gap-2">
                {myBusiness.name}
                {myBusiness.isVerified && (
                  <span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 text-[8px] font-bold tracking-wider border border-green-500/25 uppercase flex items-center gap-0.5">
                    <ShieldCheck className="w-2.5 h-2.5" /> VERIFIED
                  </span>
                )}
              </h2>
            </div>
            
            {/* Quick action buttons row */}
            <div className="flex gap-2" id="dash-quick-btns">
              <button
                onClick={() => {
                  setEditName(myBusiness.name);
                  setEditDesc(textEn(myBusiness.description));
                  setEditPhone(myBusiness.phone);
                  setEditWhatsapp(myBusiness.whatsapp);
                  setEditHours(textEn(myBusiness.workingHours));
                  setEditImages(buildListingImages(myBusiness.gallery, myBusiness.logoUrl));
                  setEditCover(myBusiness.coverUrl);
                  setActivePortalTab('edit');
                }}
                disabled={myBusiness.status === 'suspended'}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-colors ${
                  myBusiness.status === 'suspended'
                    ? 'bg-stone-900 border-stone-850 text-gray-600 cursor-not-allowed'
                    : 'bg-[#191613] border-[#2D2319] text-gray-300 hover:text-[#FFA048] hover:border-[#FFA048]/40'
                }`}
                title={myBusiness.status === 'suspended' ? 'Dashboard Locked due to Expired Subscription' : 'Edit profile'}
                id="btn-dash-edit"
              >
                <Edit className="w-3.5 h-3.5" />
                {language === 'en' ? 'Edit Details' : 'تعديل البيانات'}
              </button>

              <button
                onClick={() => setActivePortalTab('pay')}
                className="px-3 py-1.5 rounded-xl bg-[#FFA048] text-black hover:bg-opacity-95 transition-all text-xs font-extrabold flex items-center gap-1.5 shadow-[0_0_15px_rgba(255,160,72,0.4)] hover:shadow-[0_0_20px_rgba(255,160,72,0.6)] active:scale-95"
                id="btn-dash-renew"
              >
                <CreditCard className="w-3.5 h-3.5" />
                {language === 'en' ? 'Pay Membership' : 'دفع الاشتراك'}
              </button>
            </div>
          </div>

          {/* ── FREE TRIAL BANNER ── */}
          {isOnFreeTrial && (
            <div
              className="flex items-center gap-3 p-4 rounded-2xl border text-xs font-semibold bg-gradient-to-r from-green-950/60 to-emerald-950/40 border-green-700/40 text-green-300"
              id="dash-free-trial-banner"
            >
              <Gift className="w-5 h-5 text-green-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-black text-green-300 text-xs">
                  🎁 {language === 'en' ? 'FREE TRIAL ACTIVE' : 'الفترة التجريبية المجانية نشطة'}
                </p>
                <p className="text-[10px] text-green-400/80 mt-0.5">
                  {language === 'en'
                    ? `Your listing is completely FREE for ${trialDaysRemaining} more days. After your trial, subscribe to keep your listing visible.`
                    : `إدراجك مجاني تماماً لـ ${trialDaysRemaining} يوماً أخرى. بعد انتهاء الفترة التجريبية، اشترك لإبقاء إدراجك ظاهراً.`}
                </p>
              </div>
              <span className="text-green-400 font-black text-sm">{trialDaysRemaining}d</span>
            </div>
          )}

          {/* ── Subscription expiry warning banner ── */}
          {expiryWarning && (
            <div
              className={`flex items-center gap-3 p-4 rounded-2xl border text-xs font-semibold ${
                expiryWarning.type === 'expired'
                  ? 'bg-red-950/40 border-red-800/50 text-red-300'
                  : 'bg-amber-950/40 border-amber-700/50 text-amber-300'
              }`}
              id="dash-expiry-warning"
            >
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>
                {expiryWarning.type === 'expired'
                  ? '⚠️ Your subscription has expired! Your listing is hidden. Renew now to restore visibility.'
                  : `⏰ Your subscription expires in ${expiryWarning.days} day${expiryWarning.days !== 1 ? 's' : ''}! Renew before it expires to avoid downtime.`}
              </span>
              <button
                onClick={() => setActivePortalTab('pay')}
                className="ml-auto px-3 py-1 bg-[#FFA048] text-black text-[10px] font-black rounded-lg flex-shrink-0"
              >
                Renew Now
              </button>
            </div>
          )}

          {/* ACTIVE ACCOUNT STATUS COMPONENT (Section 7) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="dash-status-grid">
            
            {/* Subscription status display box */}
            <div className={`p-4 rounded-3xl border md:col-span-2 flex flex-col justify-between ${
              myBusiness.status === 'active'
                ? 'bg-[#142316]/30 border-green-950/60 text-green-300'
                : 'bg-red-950/25 border-red-900/40 text-red-300'
            }`} id="dash-status-box">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${myBusiness.status === 'active' ? 'bg-green-400 animate-pulse' : 'bg-red-500'}`}></div>
                  <span className="text-[10px] font-bold uppercase tracking-wider block text-gray-400">{t.membershipStatus}</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                  myBusiness.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {myBusiness.status === 'active' ? t.active : t.suspended}
                </span>
              </div>

              <div className="mt-4">
                {myBusiness.status === 'active' ? (
                  <p className="text-xs leading-relaxed text-gray-300">
                    {t.memberExpiry} <strong className="text-[#FFA048]">{myBusiness.membershipExpiryDate}</strong>.
                    <br />
                    {language === 'en'
                      ? '✓ Your page is actively appearing in directory search listings.'
                      : '✓ صفحتك نشطة للجميع وتظهر في نتائج بحث تطبيق مكاتب المجتمع.'}
                  </p>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs font-bold flex items-center gap-1.5 text-red-400">
                      <Lock className="w-4 h-4 text-red-400" />
                      {t.memberSuspended}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      {language === 'en'
                        ? `Under community regulations, your listing has disappeared from customer search until the monthly update of $${planAmount}/month is settled.`
                        : 'نزولاً عند شروط الدليل، تم إخفاء عملك مؤقتاً من القائمة العامة وسيتم تفعيله تلقائياً للزبائن فور إتمام السداد.'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Analytics — shown when real tracking is wired up */}
            <div className="p-4 rounded-3xl bg-[#13110E] border border-[#2D2319] space-y-3" id="dash-metrics">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block">
                {language === 'en' ? 'Listing Analytics' : 'إحصائيات الإدراج'}
              </span>
              <p className="text-[11px] text-gray-500 leading-relaxed">
                {language === 'en'
                  ? 'Page views and referral stats will appear here once analytics tracking is enabled.'
                  : 'ستظهر مشاهدات الصفحة وإحصائيات الإحالة هنا عند تفعيل التتبع.'}
              </p>
            </div>

          </div>

          {/* DYNAMIC PORTAL SUBSECTION SWITCHER: EDIT DETAILS FORM */}
          {activePortalTab === 'edit' && (
            <div className="p-5 rounded-3xl bg-[#13110E] border border-[#2D2319] space-y-4 animate-scale-up" id="subview-edit-profile">
              <div className="flex items-center gap-3 pb-2 border-b border-[#2D2319]/60">
                <button
                  onClick={() => setActivePortalTab('dash')}
                  className="p-1.5 rounded-full bg-[#191613] hover:bg-[#2D251C] border border-[#2D2319] transition-colors"
                  id="btn-edit-cancel"
                  aria-label="Back to dashboard"
                >
                  <ArrowLeft className="w-4 h-4 text-[#FFA048]" />
                </button>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#FFA048]">
                  {language === 'en' ? 'Profile Management' : 'إدارة بيانات صفحتك'}
                </h3>
              </div>

              {editSuccess && <p className="p-3 bg-green-950 text-green-300 text-xs rounded-xl">{editSuccess}</p>}

              <form onSubmit={handleProfileUpdate} className="space-y-4" id="form-edit-biz">
                <div>
                  <label className="block text-xs text-gray-450 mb-1">{t.businessName}</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-[#F4E3D7]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-450 mb-1">{t.description}</label>
                  <textarea
                    value={editDesc}
                    rows={3}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-[#F4E3D7]"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-450 mb-1">{t.phone}</label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-[#F4E3D7]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-450 mb-1">{t.whatsapp}</label>
                    <input
                      type="text"
                      value={editWhatsapp}
                      onChange={(e) => setEditWhatsapp(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-[#F4E3D7]"
                      required
                    />
                  </div>
                </div>

                {/* ── Logo / gallery ── */}
                <ImageUploadGrid
                  id="edit-portal-image-upload"
                  images={editImages}
                  onChange={setEditImages}
                  language={language}
                  label={language === 'en' ? 'Business logo / photos*' : 'شعار / صور النشاط*'}
                  hint={
                    language === 'en'
                      ? 'First image is your profile logo.'
                      : 'الصورة الأولى هي الشعار.'
                  }
                />

                {/* ── Separate background / cover banner ── */}
                <ImageUploadGrid
                  id="edit-cover-upload"
                  images={editCover && isUsableUploadSrc(editCover) ? [editCover] : (editCover ? [editCover] : [])}
                  onChange={(next) => setEditCover(next[0] || '')}
                  language={language}
                  maxImages={1}
                  label={
                    language === 'en'
                      ? 'Background / cover photo (banner)'
                      : 'صورة الخلفية / الغلاف'
                  }
                  hint={
                    language === 'en'
                      ? 'Wide banner at the top of your listing page.'
                      : 'بانر عريض أعلى صفحة نشاطك.'
                  }
                />

                <div>
                  <label className="block text-xs text-gray-450 mb-1">{t.workingHours}</label>
                  <input
                    type="text"
                    value={editHours}
                    onChange={(e) => setEditHours(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-[#F4E3D7]"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-[#FFA048] hover:bg-opacity-95 text-black font-extrabold rounded-xl text-xs transition-all shadow-md"
                  id="btn-edit-submit"
                >
                  {t.saveChanges}
                </button>
              </form>
            </div>
          )}

          {/* DYNAMIC PORTAL SUBSECTION SWITCHER: SUBSCRIBE / RENEW */}
          {activePortalTab === 'pay' && (
            <div className="p-5 rounded-3xl bg-[#13110E] border border-[#2D2319] space-y-4 animate-scale-up" id="subview-renew-payment">
              <div className="flex items-center gap-3 pb-2 border-b border-[#2D2319]/60">
                <button
                  onClick={() => setActivePortalTab('dash')}
                  className="p-1.5 rounded-full bg-[#191613] hover:bg-[#2D251C] border border-[#2D2319] transition-colors"
                  id="btn-pay-cancel"
                  aria-label="Back to dashboard"
                >
                  <ArrowLeft className="w-4 h-4 text-[#FFA048]" />
                </button>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#FFA048]">
                  {language === 'en' ? 'Subscribe to Keep Listing' : 'اشترك لإبقاء إدراجك'}
                </h3>
              </div>

              {/* Plan summary card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-[#1a1510] to-[#0F0E0C] border border-[#FFA048]/20 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#FFA048]/10 flex items-center justify-center border border-[#FFA048]/30">
                    {kind === 'service' ? <Zap className="w-5 h-5 text-blue-400" /> : <Briefcase className="w-5 h-5 text-[#FFA048]" />}
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white">
                      {kind === 'service'
                        ? (language === 'en' ? 'Service Provider Plan' : 'خطة مزود الخدمة')
                        : (language === 'en' ? 'Business Directory Plan' : 'خطة دليل الأعمال')}
                    </h4>
                    <span className="text-sm font-black text-[#FFA048]">${planAmount}.00 / month</span>
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  {language === 'en'
                    ? `Your listing stays active and visible to all community members for 30 days. Auto-renews monthly unless cancelled in your Apple ID or Google Play subscription settings at least 24 hours before renewal.`
                    : 'يبقى إدراجك نشطاً وظاهراً لجميع أفراد المجتمع لمدة 30 يوماً. يتجدد تلقائياً كل شهر.'}
                </p>
                <a href="/legal/subscription.html" target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#FFA048] font-bold hover:underline">
                  Read Subscription Terms
                </a>
                <a href="/legal/privacy.html" target="_blank" rel="noopener noreferrer" className="block text-[10px] text-gray-500 hover:text-[#FFA048]">
                  Privacy Policy
                </a>
              </div>

              {/* HOW PAYMENT WORKS — clarity box */}
              <div className="p-4 rounded-2xl bg-[#0F0E0C] border border-[#2D2319] space-y-2 text-[11px] text-gray-400 leading-relaxed">
                <div className="flex items-center gap-2 text-xs font-black text-white mb-2">
                  <Smartphone className="w-4 h-4 text-[#FFA048]" />
                  <span>{language === 'en' ? 'How Payments Work' : 'كيف تعمل المدفوعات'}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <BadgeCheck className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />
                    <p>{language === 'en' ? 'Payment is processed securely by Google Play (Android) or Apple App Store (iOS) — not collected by this app.' : 'تتم معالجة الدفع بشكل آمن عبر Google Play أو App Store.'}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <BadgeCheck className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />
                    <p>{language === 'en' ? 'Revenue is paid out to the app owner\'s linked bank account monthly by Google/Apple.' : 'تُحوَّل الإيرادات إلى الحساب البنكي للمطوّر شهرياً عبر Google/Apple.'}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <BadgeCheck className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />
                    <p>{language === 'en' ? 'You can cancel anytime from your device\'s subscription settings.' : 'يمكنك الإلغاء في أي وقت من إعدادات الاشتراك في جهازك.'}</p>
                  </div>
                </div>
              </div>

              {payError && <p className="p-3 bg-red-950 text-red-300 text-xs rounded-xl">{payError}</p>}
              {paySuccess && <p className="p-3 bg-green-950 text-green-300 text-xs rounded-xl">{paySuccess}</p>}

              {/* SUBSCRIBE BUTTON — triggers Google Play / Apple native payment sheet */}
              <button
                type="button"
                id="btn-iap-subscribe"
                onClick={handleIAPSubscribe}
                disabled={isProcessingPay}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#FFA048] to-[#FF8C00] hover:from-[#FF8C00] hover:to-[#FFA048] text-black font-extrabold text-sm uppercase tracking-wider shadow-[0_0_25px_rgba(255,160,72,0.5)] hover:shadow-[0_0_35px_rgba(255,160,72,0.7)] transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessingPay ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> {language === 'en' ? 'Processing...' : 'جاري المعالجة...'}</>
                ) : (
                  <><CreditCard className="w-4 h-4" /> {language === 'en' ? `Subscribe — $${planAmount}/month` : `اشترك — ${planAmount}$ شهرياً`}</>
                )}
              </button>

              {/* Restore purchases — required by Apple App Store */}
              <button
                type="button"
                id="btn-restore-purchases"
                onClick={handleRestorePurchases}
                disabled={isRestoringPurchases}
                className="w-full py-2.5 rounded-xl border border-[#2D2319] text-gray-500 hover:text-gray-300 hover:border-[#3A2E22] text-[10px] font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                {isRestoringPurchases ? (
                  <><RefreshCw className="w-3 h-3 animate-spin" /> {language === 'en' ? 'Restoring...' : 'جاري الاستعادة...'}</>
                ) : (
                  <>{language === 'en' ? '↩ Restore Previous Purchases' : '↩ استعادة الاشتراكات السابقة'}</>
                )}
              </button>
            </div>
          )}

          {/* PAYMENT HISTORY LISTING LOG */}
          <div className="p-5 rounded-3xl bg-[#13110E] border border-[#2D2319] space-y-3" id="dash-payments-history">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#FFA048] flex items-center gap-1.5">
              <History className="w-4 h-4" />
              {t.paymentHistory}
            </h3>

            <div className="overflow-x-auto" id="payments-history-table">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#2D2319] text-gray-500 text-[10px] uppercase font-semibold">
                    <th className="py-2">{t.refNo}</th>
                    <th className="py-2">{t.date}</th>
                    <th className="py-2">{t.amount}</th>
                    <th className="py-2">{language === 'en' ? 'Invoice / Action' : 'الفاتورة / إجراء'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2D2319]/45 text-gray-300">
                  {businessPayments.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-gray-500 font-medium">
                        {language === 'en' ? 'No membership charges recorded yet.' : 'لا يوجد سجل دفع مسجل لعضويتك بعد.'}
                      </td>
                    </tr>
                  ) : (
                    businessPayments.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2.5 font-mono text-[9px] text-[#FFA048] pr-2">{p.refNo}</td>
                        <td className="py-2.5 text-[10px]">{p.date}</td>
                        <td className="py-2.5 font-bold text-white">${p.amount}.00</td>
                        <td className="py-2.5">
                          <button
                            type="button"
                            onClick={() => setSelectedReceipt(p)}
                            className="text-[9px] font-extrabold uppercase bg-[#201B15] border border-[#3A2E22] hover:bg-[#FFA048] hover:text-black text-[#FFA048] px-2 py-0.5 rounded transition-all active:scale-95"
                          >
                            {language === 'en' ? 'View' : 'عرض'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* RECEIPT MODAL */}
          {selectedReceipt && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm" id="receipt-modal-overlay">
              <div className="relative w-full max-w-sm rounded-3xl bg-[#0F0E0C] border border-[#2D2319] p-6 text-[#F4E3D7] shadow-2xl flex flex-col font-sans">
                
                {/* Close Button */}
                <button
                  onClick={() => setSelectedReceipt(null)}
                  className="absolute top-4 right-4 p-1.5 rounded-full text-gray-500 hover:text-white"
                >
                  ✕
                </button>

                {/* Receipt Header Style */}
                <div className="text-center space-y-2 border-b border-[#2D2319]/60 pb-4 mb-4">
                  <div className="w-11 h-11 rounded-2xl bg-[#FFA048]/10 text-[#FFA048] flex items-center justify-center mx-auto border border-[#3A2E21]/60">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-black uppercase text-white tracking-wider">
                    {language === 'en' ? 'Transaction Invoice' : 'فاتورة الاشتراك الشهري'}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[8px] font-extrabold tracking-widest text-green-400 bg-green-500/10 border border-green-500/20 uppercase inline-block">
                    {language === 'en' ? 'SUCCESS / PERSISTED' : 'مكتمل ومسجل'}
                  </span>
                </div>

                {/* Invoice Core content explaining how amount is detected & where it goes */}
                <div className="space-y-3.5 text-xs">
                  <div className="flex justify-between items-center text-[10px] text-gray-500 pb-1.5 border-b border-[#2D2319]/30">
                    <span>{language === 'en' ? 'REF NUMBER' : 'رقم المرجع'}</span>
                    <span className="font-mono font-bold text-white">{selectedReceipt.refNo}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">{language === 'en' ? 'Billed Merchant' : 'اسم النشاط'}</span>
                    <span className="font-bold text-white">{myBusiness.name}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">{language === 'en' ? 'Payer Account' : 'حساب الدفع'}</span>
                    <span className="text-white truncate max-w-[150px]">{currentUser.email}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">{language === 'en' ? 'Payment Date' : 'تاريخ الدفع'}</span>
                    <span className="text-white">{selectedReceipt.date}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">{language === 'en' ? 'Detected Amount' : 'المبلغ المستكشف'}</span>
                    <span className="font-black text-[#FFA048]">${selectedReceipt.amount}.00 USD</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">{language === 'en' ? 'Billing Term' : 'فترة التغطية'}</span>
                    <span className="text-green-400 font-bold bg-[#142316]/30 px-2 py-0.5 rounded text-[10px]">30 Days Active Listing</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[#13110E] border border-[#2D2319] space-y-2 mt-4 text-[10px] text-gray-400 leading-relaxed font-sans">
                    <span className="font-bold text-[#FFA048] block text-[11px] uppercase tracking-wider">
                      {language === 'en' ? 'Payment recorded on server' : 'تم تسجيل الدفع على الخادم'}
                    </span>
                    <p>
                      {language === 'en'
                        ? 'This payment is stored in the ABN database and your listing membership was extended by 30 days.'
                        : 'تم حفظ هذا الدفع في قاعدة بيانات ABN وتم تمديد اشتراك إدراجك لمدة 30 يوماً.'}
                    </p>
                  </div>
                </div>

                {/* Print confirmation simulation */}
                <button
                  type="button"
                  onClick={() => {
                    const lines = [
                      'ABN Membership Receipt',
                      `Business: ${myBusiness?.name || ''}`,
                      `Plan: $${planAmount}/mo`,
                      `Date: ${new Date().toISOString().slice(0, 10)}`,
                      `Expiry: ${myBusiness?.membershipExpiryDate || ''}`,
                    ].join('\n');
                    void navigator.clipboard?.writeText(lines).catch(() => undefined);
                    window.print();
                  }}
                  className="mt-5 w-full py-2 bg-[#FFA048] hover:bg-opacity-95 text-black font-extrabold text-xs rounded-xl shadow transition-all active:scale-95"
                >
                  {language === 'en' ? 'Print Receipt Record' : 'طباعة وحفظ المستند'}
                </button>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
    </>
  );
};
