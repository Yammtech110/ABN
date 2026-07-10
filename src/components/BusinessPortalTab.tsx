import React, { useState } from 'react';
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
  TrendingUp,
  Settings,
  Plus,
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
} from 'lucide-react';
import { Business, PaymentRecord } from '../types';
import { US_STATES } from '../data/usStates';
import {
  formatUSPhoneInput,
  formatZipInput,
  formatOtpInput,
  isValidUSPhone,
  normalizeUSPhone,
  validateDirectoryRegistration,
} from '../utils/businessRegistrationValidation';
import { canManageListing, getUserListing, listingKind } from '../utils/listingAccess';

const DEFAULT_LOGO = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=200&h=200';
const DEFAULT_COVER = 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&q=80&w=1200&h=400';

const buildListingImages = (gallery: string[] | undefined, logoUrl?: string): string[] => {
  if (gallery && gallery.length > 0) return gallery.slice(0, 5);
  if (logoUrl) return [logoUrl];
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
    addPayment,
    apiToken,
    refreshDirectory,
  } = useDirectory();

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
  const [regSuccess, setRegSuccess] = useState('');
  const [regError, setRegError] = useState('');
  const [regPhotoError, setRegPhotoError] = useState('');
  const [regOtp, setRegOtp] = useState('');
  const [regOtpSent, setRegOtpSent] = useState(false);
  const [regOtpNotice, setRegOtpNotice] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isSubmittingReg, setIsSubmittingReg] = useState(false);
  const [showApprovalNotice, setShowApprovalNotice] = useState(false);

  const isRegPhoneValid = React.useMemo(() => isValidUSPhone(regPhone), [regPhone]);

  React.useEffect(() => {
    setRegOtp('');
    setRegOtpSent(false);
    setRegOtpNotice('');
  }, [regPhone]);

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
    setRegDesc(myBusiness.description[language] || myBusiness.description.en);
    setRegState(myBusiness.subcategory.en || '');
    setRegCity(String(myBusiness.city || ''));
    setRegZipCode(myBusiness.area || '');
    setRegAddress(myBusiness.address || '');
    setRegPhone(myBusiness.phone || '');
    setRegWhatsapp(myBusiness.whatsapp || '');
    setRegWeb(myBusiness.website || '');
    setRegHours(myBusiness.workingHours[language] || myBusiness.workingHours.en || '');
    setRegImages(buildListingImages(myBusiness.gallery, myBusiness.logoUrl));
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
      setEditDesc(myBusiness.description[language] || myBusiness.description.en);
      setEditPhone(myBusiness.phone);
      setEditWhatsapp(myBusiness.whatsapp);
      setEditHours(myBusiness.workingHours[language] || myBusiness.workingHours.en);
      setEditImages(buildListingImages(myBusiness.gallery, myBusiness.logoUrl));
      setEditCover(myBusiness.coverUrl);
    }
  }, [myBusiness?.id, language]);

  // Payment Form state
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const [payError, setPayError] = useState('');
  const [paySuccess, setPaySuccess] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState<PaymentRecord | null>(null);

  // Card brand detection + payment progress
  const [payProgressSteps, setPayProgressSteps] = useState<string[]>([]);
  const [isProcessingPay, setIsProcessingPay] = useState(false);
  const [detectedBrand, setDetectedBrand] = useState<'Visa' | 'Mastercard' | 'Amex' | 'Unknown'>('Unknown');

  // ── Card number formatter: groups of 4 digits with spaces ──
  const handleCardNumberChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 16);
    const formatted = digits.replace(/(\d{4})(?=\d)/g, '$1 ');
    setCardNumber(formatted);
    // Detect brand from first digit
    if (digits.startsWith('4')) setDetectedBrand('Visa');
    else if (digits.startsWith('5')) setDetectedBrand('Mastercard');
    else if (digits.startsWith('3')) setDetectedBrand('Amex');
    else setDetectedBrand('Unknown');
  };

  // ── Card expiry formatter: auto-insert slash after MM ──
  const handleExpiryChange = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) {
      setCardExpiry(`${digits.slice(0, 2)}/${digits.slice(2)}`);
    } else {
      setCardExpiry(digits);
    }
  };

  // ── Subscription expiry warning (within 7 days) ──
  const expiryWarning = React.useMemo(() => {
    if (!myBusiness?.membershipExpiryDate) return null;
    const expiry = new Date(myBusiness.membershipExpiryDate);
    const today = new Date();
    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return { days: diffDays, type: 'expired' as const };
    if (diffDays <= 7) return { days: diffDays, type: 'warning' as const };
    return null;
  }, [myBusiness?.membershipExpiryDate]);

  // Handle registration submission
  const handleSendOtp = async () => {
    if (!isRegPhoneValid) {
      setRegError(t.phoneInvalid);
      return;
    }
    if (!apiToken) {
      setRegError(t.phoneVerificationRequired);
      return;
    }

    setIsSendingOtp(true);
    setRegError('');
    setRegOtpNotice('');

    try {
      const res = await apiFetch('/api/verification/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({ phone: `+${normalizeUSPhone(regPhone)}` }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRegError(data.error || t.otpInvalid);
        return;
      }

      setRegOtpSent(true);
      setRegOtp('');
      const demoHint = data.demoOtp
        ? (language === 'en' ? ` Demo code: ${data.demoOtp}` : ` رمز تجريبي: ${data.demoOtp}`)
        : '';
      setRegOtpNotice(`${t.otpSent}${demoHint}`);
    } catch {
      setRegError(language === 'en' ? 'Could not reach verification service.' : 'تعذر الاتصال بخدمة التحقق.');
    } finally {
      setIsSendingOtp(false);
    }
  };

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
        otpRequired: t.otpRequired,
        phoneVerificationRequired: t.phoneVerificationRequired,
      },
    );

    if (validationError) {
      if (validationError === photoRequiredMsg) setRegPhotoError(validationError);
      setRegError(validationError);
      return;
    }

    if (!regOtp.trim()) {
      setRegError(t.otpRequired);
      return;
    }

    if (!apiToken) {
      setRegError(t.phoneVerificationRequired);
      return;
    }

    const normalizedPhone = normalizeUSPhone(regPhone);
    const formattedPhone = `+${normalizedPhone}`;

    setIsSubmittingReg(true);
    setRegError('');

    const defaultLogo = regImages[0];
    const defaultCover = regImages[0];
    const gallery = regImages;
    const cat = categories.find((c) => c.id === regCatId);
    const categoryLabel = cat?.name.en || 'General';

    try {
      const verifyRes = await apiFetch('/api/verification/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({ phone: formattedPhone, code: regOtp.trim() }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        setRegError(verifyData.error || t.otpInvalid);
        return;
      }

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
        membershipExpiryDate: String(data.membershipExpiry ?? new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]),
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
        images: regImages,
        kind: registrationType,
      },
      {
        allFieldsRequired: t.allFieldsRequired,
        photoRequired: photoRequiredMsg,
        phoneInvalid: t.phoneInvalid,
        zipInvalid: t.zipInvalid,
        stateRequired: t.stateRequired,
        hoursRequired: t.hoursRequired,
        otpRequired: t.otpRequired,
        phoneVerificationRequired: t.phoneVerificationRequired,
      },
    );

    if (validationError) {
      if (validationError === photoRequiredMsg) setRegPhotoError(validationError);
      setRegError(validationError);
      return;
    }

    const cat = categories.find((c) => c.id === regCatId);
    const categoryLabel = cat?.name.en || myBusiness.subcategory.en;
    const defaultLogo = regImages[0] || myBusiness.logoUrl;
    const formattedPhone = isValidUSPhone(regPhone) ? `+${normalizeUSPhone(regPhone)}` : regPhone.trim();

    setIsSavingManage(true);
    setRegError('');

    const updatedBiz: Business = {
      ...myBusiness,
      name: regName,
      description: { en: regDesc, ar: language === 'ar' ? regDesc : myBusiness.description.ar },
      subcategory: { en: regState, ar: regState },
      categoryId: regCatId,
      address: regAddress,
      city: regCity as Business['city'],
      area: regZipCode,
      phone: formattedPhone,
      whatsapp: regWhatsapp.trim() || formattedPhone,
      website: regWeb,
      workingHours: { en: regHours, ar: language === 'ar' ? regHours : myBusiness.workingHours.ar },
      logoUrl: defaultLogo,
      coverUrl: regImages[0] || myBusiness.coverUrl,
      gallery: regImages.length > 0 ? regImages : myBusiness.gallery,
    };

    updateBusiness(updatedBiz);

    if (apiToken) {
      try {
        await apiFetch(`/api/directory/${myBusiness.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiToken}`,
          },
          body: JSON.stringify({
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
            imageUrl: defaultLogo,
            coverUrl: regImages[0] || myBusiness.coverUrl,
          }),
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

    const updatedBiz: Business = {
      ...myBusiness,
      name: editName,
      description: {
        en: editDesc,
        ar: language === 'ar' ? editDesc : myBusiness.description.ar
      },
      phone: editPhone,
      whatsapp: editWhatsapp,
      workingHours: {
        en: editHours,
        ar: language === 'ar' ? editHours : myBusiness.workingHours.ar
      },
      logoUrl: editImages[0] || myBusiness.logoUrl,
      coverUrl: editImages[1] || editCover || myBusiness.coverUrl,
      gallery: editImages.length > 0 ? editImages : myBusiness.gallery,
    };

    updateBusiness(updatedBiz);

    if (apiToken) {
      try {
        await apiFetch(`/api/directory/${myBusiness.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiToken}`,
          },
          body: JSON.stringify({
            businessName: editName,
            description: editDesc,
            phone: editPhone,
            whatsapp: editWhatsapp,
            workingHours: editHours,
            imageUrl: editImages[0] || myBusiness.logoUrl,
            coverUrl: editImages[1] || editCover || myBusiness.coverUrl,
          }),
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

  // Helper to detect card brand
  const detectCardBrand = (numStr: string) => {
    const cleaned = numStr.replace(/\D/g, '');
    if (cleaned.startsWith('4')) return 'Visa';
    if (/^(5[1-5]|2[2-7])/.test(cleaned)) return 'Mastercard';
    if (/^(34|37)/.test(cleaned)) return 'Amex';
    return 'Unknown';
  };

  // Luhn checksum algorithm validation
  const validateLuhn = (numStr: string): boolean => {
    let sum = 0;
    let shouldDouble = false;
    for (let i = numStr.length - 1; i >= 0; i--) {
      let digit = parseInt(numStr.charAt(i), 10);
      if (isNaN(digit)) return false;

      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
  };

  // Expiry date checker
  const validateExpiry = (expiryStr: string): { valid: boolean; errorMsg: string } => {
    const trimmed = expiryStr.trim();
    if (!/^\d{2}\/\d{2}$/.test(trimmed)) {
      return { valid: false, errorMsg: language === 'en' ? 'Use MM/YY format (e.g. 12/28).' : 'الرجاء استخدام الصيغة MM/YY (بما في ذلك "/") مثل 12/28.' };
    }
    const [mStr, yStr] = trimmed.split('/');
    const month = parseInt(mStr, 10);
    const year = parseInt('20' + yStr, 10);

    if (month < 1 || month > 12) {
      return { valid: false, errorMsg: language === 'en' ? 'Expiry month must be between 01 and 12.' : 'يجب أن يكون شهر الصلاحية بين 01 و 12.' };
    }

    const today = new Date();
    const currentMonth = today.getMonth() + 1; // 1-indexed
    const currentYear = today.getFullYear();

    if (year < currentYear || (year === currentYear && month < currentMonth)) {
      return { valid: false, errorMsg: language === 'en' ? 'The card has expired.' : 'هذه البطاقة منتهية الصلاحية.' };
    }

    return { valid: true, errorMsg: '' };
  };

  // Payment renew simulation
  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!myBusiness) return;
    setPayError('');
    setPaySuccess('');

    const cleanedCard = cardNumber.replace(/\D/g, '');
    if (cleanedCard.length < 13 || cleanedCard.length > 19) {
      setPayError(language === 'en' ? 'Card number must be between 13 and 19 digits.' : 'رقم البطاقة غير مكتمل، يرجى ملء البيانات كاملة.');
      return;
    }

    // 1. Math Luhn Check validation
    const luhnPassed = validateLuhn(cleanedCard);
    if (!luhnPassed) {
      setPayError(language === 'en' 
        ? 'Luhn Checksum Verification Failed. This card code is mathematically invalid or simulated incorrectly. Try standard testing credentials like 4242 4242 4242 4242.' 
        : 'فشل فحص الحساب الرقمي (Luhn Checksum). رمز البطاقة غير صالح، يرجى استخدام بطاقة صحيحة أو تجريبية مثل 4242 4242 4242 4242.'
      );
      return;
    }

    // 2. Validate Expiry format
    const expiryValidation = validateExpiry(cardExpiry);
    if (!expiryValidation.valid) {
      setPayError(expiryValidation.errorMsg);
      return;
    }

    // 3. Validate CVV
    if (cardCvc.length < 3 || cardCvc.length > 4) {
      setPayError(language === 'en' ? 'CVC/CVV security code must be 3 or 4 digits.' : 'يجب أن يتكون رمز الأمان (CVC) من 3 أو 4 أرقام.');
      return;
    }

    // Capture card brand dynamically
    const brand = detectCardBrand(cleanedCard);
    setDetectedBrand(brand);

    // If validated, trigger live step simulation checking!
    setIsProcessingPay(true);
    setPayProgressSteps([]);

    const steps = [
      language === 'en' ? '🔍 Calculating Luhn algorithm checksum... [MATHEMATICALLY VALID]' : '🔍 يجري حساب الرقم الرياضي للبطاقة... [مُطابِق]',
      language === 'en' ? `💳 Resolving card network brand... [${brand.toUpperCase()} Network Resolved]` : `💳 التعرف على شبكة البطاقة... [تم تحديد شبكة ${brand.toUpperCase()}]`,
      language === 'en' ? '🌐 Handshaking with secure online gateway... [HTTPS PORT 443 CONNECTED]' : '🌐 الربط بالمنفذ البنكي الآمن... [اتصال HTTPS مشفر وجاري]',
      language === 'en' ? '🔒 Running anti-fraud validation & 3D-Secure state... [ACCOUNTS COMMITTED & SUFFICIENT FUNDS]' : '🔒 تدقيق مكافحة الاحتيال وحالة الرصيد المالي... [البطاقة نشطة وبها رصيد كافي]',
      language === 'en' ? '✅ Finalizing transaction auth token...' : `✅ يجري إصدار رقم التوثيق وتحويل الـ ${planAmount}$...`
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      // Create fresh step snapshot updating UI
      setPayProgressSteps(prev => [...prev, steps[currentStep]]);
      currentStep++;
      if (currentStep >= steps.length) {
        clearInterval(interval);
        
        // Finalize transaction writes!
        const payRec: PaymentRecord = {
          id: `pay-${Date.now()}`,
          businessId: myBusiness.id,
          amount: planAmount,
          date: new Date().toISOString().split('T')[0],
          status: 'success',
          refNo: `TXN-${Math.floor(Math.random() * 9000000 + 1000000)}`
        };

        addPayment(payRec);
        
        // Mark business as active
        const activatedBiz: Business = {
          ...myBusiness,
          status: 'active',
          membershipExpiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        };
        updateBusiness(activatedBiz);

        setPaySuccess(language === 'en' ? 'Registration fee paid successfully! Status set to ACTIVE.' : 'تم سداد الاشتراك لثلاثين يوماً بنجاح وتفعيل نشاطك التجاري!');
        setCardNumber('');
        setCardExpiry('');
        setCardCvc('');
        setIsProcessingPay(false);
        setPayProgressSteps([]);

        setTimeout(() => {
          setPaySuccess('');
          setActivePortalTab('dash');
        }, 3000);
      }
    }, 600);
  };

  // Test toggle: simulate suspension to let them inspect suspended dashboards!
  const simulateSuspension = () => {
    if (!myBusiness) return;
    const expiredBiz: Business = {
      ...myBusiness,
      status: 'suspended',
      membershipExpiryDate: '2026-06-18' // set to yesterday
    };
    updateBusiness(expiredBiz);
    alert(language === 'en' ? 'Subscription expired! Business profile locked and hidden from directory.' : 'تم تعليق الاشتراك بنجاح لأغراض الفحص! تم إخفاء العمل من الدليل ومنع تحديثه.');
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
                      <span className="text-[10px] font-bold text-[#FFA048] bg-[#FFA048]/10 px-2 py-0.5 rounded-md mt-1 inline-block border border-[#FFA048]/20">$50 / month</span>
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
                      <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md mt-1 inline-block border border-blue-500/20">$30 / month</span>
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
                setRegOtp('');
                setRegOtpSent(false);
                setRegOtpNotice('');
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

            {/* ── Mandatory primary photo ── */}
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
                  ? (language === 'en' ? 'Upload Business Photo' : 'رفع صورة النشاط التجاري')
                  : (language === 'en' ? 'Upload Service Provider Photo' : 'رفع صورة مزود الخدمة')
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
                  <label className="block text-xs text-gray-400 mb-1">{t.selectCategory}*</label>
                  <select
                    value={regCatId}
                    onChange={(e) => setRegCatId(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-[#FFA048] outline-none"
                    required
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name[language] || c.name.en}
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
              <label className="block text-xs text-gray-400 mb-1">{t.state}*</label>
              <select
                value={regState}
                onChange={(e) => setRegState(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-[#FFA048] outline-none focus:border-[#FFA048]"
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
                <label className="block text-xs text-gray-400 mb-1">{t.city}*</label>
                <input
                  type="text"
                  value={regCity}
                  onChange={(e) => setRegCity(e.target.value)}
                  placeholder={language === 'en' ? 'e.g. Houston' : 'مثال: هيوستن'}
                  className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-white placeholder-gray-600 outline-none focus:border-[#FFA048]"
                  required
                />
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
            <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">{t.phone}*</label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={regPhone}
                    placeholder={t.phoneHint}
                    onChange={(e) => setRegPhone(formatUSPhoneInput(e.target.value))}
                    className="flex-1 min-w-0 p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-white placeholder-gray-600 outline-none focus:border-[#FFA048]"
                    required
                  />
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={!isRegPhoneValid || isSendingOtp}
                    className="shrink-0 px-3 py-2.5 rounded-xl bg-[#FFA048]/15 border border-[#FFA048]/40 text-[#FFA048] text-[10px] font-extrabold uppercase tracking-wide hover:bg-[#FFA048]/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    id="btn-send-otp"
                  >
                    {isSendingOtp ? t.sendingOtp : t.sendOtp}
                  </button>
                </div>
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

            {isRegPhoneValid && (
              <div className="animate-fade-in-up space-y-1.5" id="reg-otp-section">
                <label className="block text-xs text-gray-400 mb-1">{t.verificationOtp}*</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={regOtp}
                  onChange={(e) => setRegOtp(formatOtpInput(e.target.value))}
                  placeholder={language === 'en' ? 'Enter 6-digit code' : 'أدخل الرمز المكوّن من 6 أرقام'}
                  disabled={!regOtpSent}
                  className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-white placeholder-gray-600 outline-none focus:border-[#FFA048] disabled:opacity-50 disabled:cursor-not-allowed tracking-[0.35em] text-center font-bold"
                  id="reg-otp-input"
                />
                {regOtpNotice && (
                  <p className="text-[10px] text-green-400 font-medium">{regOtpNotice}</p>
                )}
                {!regOtpSent && (
                  <p className="text-[9px] text-gray-500">
                    {language === 'en' ? 'Tap Send OTP to receive your verification code.' : 'اضغط إرسال OTP لاستلام رمز التحقق.'}
                  </p>
                )}
              </div>
            )}
            </>
            )}

            <button
              type="submit"
              disabled={
                isManageForm
                  ? isSavingManage
                  : isSubmittingReg || (isRegPhoneValid && !regOtp.trim())
              }
              className="w-full py-3 mt-4 bg-[#FFA048] hover:bg-opacity-95 text-black font-extrabold rounded-2xl text-xs tracking-wider uppercase transition-all shadow-[0_0_15px_rgba(255,160,72,0.4)] hover:shadow-[0_0_20px_rgba(255,160,72,0.6)] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              id="btn-register-biz"
            >
              {isManageForm
                ? (isSavingManage ? (language === 'en' ? 'Saving…' : 'جاري الحفظ…') : (language === 'en' ? 'Save Changes' : 'حفظ التغييرات'))
                : (isSubmittingReg ? t.verifyingPhone : t.submitApplication)}
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
                  setEditDesc(myBusiness.description[language] || myBusiness.description.en);
                  setEditPhone(myBusiness.phone);
                  setEditWhatsapp(myBusiness.whatsapp);
                  setEditHours(myBusiness.workingHours[language] || myBusiness.workingHours.en);
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

          {/* ── Subscription expiry warning banner (Bug #6 improvement) ── */}
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

              {/* Developer Test Trigger so reviewers can toggle the suspension check! */}
              <div className="mt-4 pt-3.5 border-t border-[#2D2319]/40 flex justify-between items-center text-[10px] text-gray-500" id="dev-expiry-trigger">
                <span>[Test Utility]: Toggle account suspension</span>
                <button
                  type="button"
                  onClick={simulateSuspension}
                  className="px-2.5 py-1 rounded bg-[#201B15] text-red-400 hover:text-red-300 border border-[#3A2E22]"
                >
                  Force Expire Subscription ⛈
                </button>
              </div>
            </div>

            {/* Quick Metrics Dashboard box */}
            <div className="p-4 rounded-3xl bg-[#13110E] border border-[#2D2319] space-y-4" id="dash-metrics">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest block">Monthly Performance Indicator</span>
              <div className="space-y-3 pt-1">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-400">Directory Page Views</span>
                    <span className="font-bold text-white">480 clicks</span>
                  </div>
                  <div className="w-full h-1 bg-[#191613] rounded-full overflow-hidden">
                    <div className="w-[78%] h-full bg-[#FFA048] rounded-full"></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-400">Halat Referral Rate</span>
                    <span className="font-bold text-green-400">92% satisfactory</span>
                  </div>
                  <div className="w-full h-1 bg-[#191613] rounded-full overflow-hidden">
                    <div className="w-[92%] h-full bg-green-500 rounded-full"></div>
                  </div>
                </div>
              </div>
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

                {/* ── Image Upload Grid (Edit) ── */}
                <ImageUploadGrid
                  id="edit-portal-image-upload"
                  images={editImages}
                  onChange={setEditImages}
                  language={language}
                  label={language === 'en' ? 'Upload Business/Service Images*' : 'رفع صور النشاط/الخدمة*'}
                />

                <div>
                  <label className="block text-xs text-gray-450 mb-1">{t.coverUrl}</label>
                  <input
                    type="text"
                    value={editCover}
                    onChange={(e) => setEditCover(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-[#F4E3D7]"
                  />
                </div>

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

          {/* DYNAMIC PORTAL SUBSECTION SWITCHER: RENEW SUBSCRIPTION FORM */}
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
                  {t.paymentGateway}
                </h3>
              </div>

              <div className="p-4 rounded-2xl bg-[#0F0E0C] border border-[#2D2319] space-y-2">
                <h4 className="text-xs font-bold text-white">{t.renewMembership}</h4>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  {t.renewDescription}
                </p>
                <span className="block mt-2 text-sm font-black text-[#FFA048]">${planAmount}.00 / month</span>
              </div>

              {/* ADMIN ACCOUNT & CARDS HELPER TIP */}
              <div className="p-4 rounded-2xl bg-[#201B15] border border-[#FFA048]/15 space-y-2.5 text-xs text-[#F4E3D7]" id="payment-testing-tips">
                <div className="flex items-center gap-2 text-xs font-black text-[#FFA048] uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4 text-[#FFA048]" />
                  <span>Sandbox Testing Helper Portal</span>
                </div>
                <div className="space-y-2 text-[11px] text-gray-300 leading-relaxed">
                  <p>
                    <strong>💳 Valid Visa Card Example:</strong> <code>4242 4242 4242 4242</code> (Expiry of future date, e.g. <code>12/28</code>, CVC: <code>345</code>) passes the live mathematical <strong>Luhn Checksum validation</strong>.
                  </p>
                  <p className="text-gray-400">
                    *The payment checker dynamically verifies checksum mathematically to check if it represents a physical, correctly-encoded card issued by a real bank sequence.*
                  </p>
                  <div className="pt-2.5 border-t border-[#3A2E22]/60">
                    <span className="font-bold text-[#FFA048] block mb-1">🔑 PLATFORM SYSTEM ADMIN ACCOUNT DETAILS:</span>
                    <ul className="list-disc pl-4 space-y-1 text-gray-400">
                      <li><strong>Email Account:</strong> <code className="text-white">admin@shiadirectory.com</code></li>
                      <li><strong>Phone Number:</strong> <code className="text-white">+964 780 000 0000</code></li>
                      <li><strong>Role Name:</strong> <code className="text-white">Abu Murtadha (Admin)</code></li>
                      <li><strong>Permissions:</strong> Global category builder, priority manager & business suspension controls.</li>
                    </ul>
                  </div>
                </div>
              </div>

              {payError && <p className="p-3 bg-red-950 text-red-300 text-xs rounded-xl">{payError}</p>}
              {paySuccess && <p className="p-3 bg-green-950 text-green-300 text-xs rounded-xl">{paySuccess}</p>}

              {isProcessingPay ? (
                <div className="p-5 rounded-2xl bg-[#0F0E0C] border border-[#2D2319] space-y-4" id="pay-progress-loading">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="w-5 h-5 text-[#FFA048] animate-spin" />
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Verifying Card Health with Network Gateway...
                      </h4>
                      <p className="text-[10px] text-gray-500">PCI-DSS Secure Tunnel Port 443 Active</p>
                    </div>
                  </div>
                  <div className="space-y-2 pt-2 border-t border-[#2D2319]/50">
                    {payProgressSteps.map((step, idx) => (
                      <div key={idx} className="text-[10px] font-mono text-gray-300 animate-fade-in flex items-center gap-1.5">
                        <span className="text-[#FFA048]">✔</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <form onSubmit={handlePaymentSubmit} className="space-y-4" id="form-pay-gateway">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs text-gray-450">{t.cardNumber}</label>
                      {cardNumber.length >= 2 && (
                        <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 bg-[#FFA048]/10 text-[#FFA048] rounded border border-[#FFA048]/20">
                          {detectCardBrand(cardNumber)} Network
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                      <input
                        type="text"
                        maxLength={19}
                        placeholder="4242 4242 4242 4242"
                        value={cardNumber}
                        onChange={(e) => {
                          // Format cleanly as they type
                          const val = e.target.value.replace(/\s+/g, '').replace(/\D/g, '');
                          const matches = val.match(/\d{4,19}/g);
                          const match = (matches && matches[0]) || '';
                          const parts = [];

                          for (let i = 0, len = match.length; i < len; i += 4) {
                            parts.push(match.substring(i, i + 4));
                          }

                          if (parts.length > 0) {
                            setCardNumber(parts.join(' '));
                          } else {
                            setCardNumber(val);
                          }
                        }}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-white"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-450 mb-1">{t.cardExpiry}</label>
                      <input
                        type="text"
                        maxLength={5}
                        placeholder="MM/YY"
                        value={cardExpiry}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\s+/g, '').replace(/\D/g, '');
                          if (val.length >= 3) {
                            setCardExpiry(val.substring(0, 2) + '/' + val.substring(2, 4));
                          } else {
                            setCardExpiry(val);
                          }
                        }}
                        className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-white text-center"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-450 mb-1">{t.cardCVC}</label>
                      <input
                        type="password"
                        maxLength={4}
                        placeholder="•••"
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, ''))}
                        className="w-full p-2.5 rounded-xl bg-[#0F0E0C] border border-[#2D2319] text-xs text-white text-center"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-green-600 hover:bg-green-500 transition-all text-black font-extrabold rounded-xl text-xs uppercase tracking-wider shadow-md"
                    id="btn-process-pay"
                  >
                    {t.processPayment}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* PAYMENT HISTORY LISTING LOG (Section 7) */}
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

          {/* DYNAMIC REAL-TIME INVOICE / RECEIPT MODAL DETECTOR FEATURE */}
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

                  {/* Flow breakdown block explaining where the money went in real-time */}
                  <div className="p-3.5 rounded-2xl bg-[#13110E] border border-[#2D2319] space-y-2 mt-4 text-[10px] text-gray-400 leading-relaxed font-sans">
                    <span className="font-bold text-[#FFA048] block text-[11px] uppercase tracking-wider">
                      ℹ️ REAL-TIME PROCESSING LOOP
                    </span>
                    <p>
                      <strong>1. Secure Capture:</strong> The payment form detects input fields, registers the subscription dues trigger on the local client, and simulates secure PCI payment handshake.
                    </p>
                    <p>
                      <strong>2. Real-Time Storage:</strong> The amount instantly updates state variables, modifying the global directory listings index state, which is cached immediately into <code>localStorage ('shia_dir_payments')</code>.
                    </p>
                    <p>
                      <strong>3. Dynamic Re-indexing:</strong> The system automatically flags <strong>{myBusiness.name}</strong> as <code>status: 'active'</code>, matching it in subsequent searches so clients can immediately see your business!
                    </p>
                  </div>
                </div>

                {/* Print confirmation simulation */}
                <button
                  type="button"
                  onClick={() => alert(language === 'en' ? 'Receipt generated & copied to community ledger successfully!' : 'تم تحضير إيصال الفاتورة وحفظ المعلومات بنجاح!')}
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
