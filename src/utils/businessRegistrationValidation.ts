export type RegistrationKind = 'business' | 'service';

export interface DirectoryRegistrationInput {
  name: string;
  description: string;
  state: string;
  city: string;
  zipCode: string;
  address: string;
  operatingHours: string;
  phone: string;
  whatsapp: string;
  images: string[];
  kind: RegistrationKind;
}

export interface DirectoryRegistrationMessages {
  allFieldsRequired: string;
  photoRequired: string;
  phoneInvalid: string;
  zipInvalid: string;
  stateRequired: string;
  hoursRequired: string;
  otpRequired: string;
  phoneVerificationRequired: string;
}

const ZIP_PATTERN = /^\d{5}$/;

/** Strip to digits only */
export const digitsOnly = (value: string): string => value.replace(/\D/g, '');

/** Format partial US phone as +1 (XXX) XXX-XXXX */
export const formatUSPhoneInput = (value: string): string => {
  const digits = digitsOnly(value).slice(0, 11);
  if (digits.length === 0) return '';

  const national = digits.startsWith('1') ? digits.slice(1) : digits;
  const d = national.slice(0, 10);

  if (d.length <= 3) return `+1 (${d}`;
  if (d.length <= 6) return `+1 (${d.slice(0, 3)}) ${d.slice(3)}`;
  return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};

/** Normalize to E.164-style storage: 11 digits starting with 1 */
export const normalizeUSPhone = (value: string): string => {
  const digits = digitsOnly(value);
  if (digits.length === 10) return `1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return digits;
  return digits;
};

export const isValidUSPhone = (value: string): boolean => {
  const digits = normalizeUSPhone(value);
  return digits.length === 11 && digits.startsWith('1');
};

export const formatOtpInput = (value: string): string => digitsOnly(value).slice(0, 6);

export const formatZipInput = (value: string): string => digitsOnly(value).slice(0, 5);

export const validateDirectoryRegistration = (
  input: DirectoryRegistrationInput,
  messages: DirectoryRegistrationMessages,
): string | null => {
  if (input.images.length === 0) return messages.photoRequired;

  if (!input.name.trim() || !input.description.trim() || !input.city.trim() || !input.address.trim()) {
    return messages.allFieldsRequired;
  }

  if (!input.state.trim()) return messages.stateRequired;

  if (!ZIP_PATTERN.test(input.zipCode.trim())) return messages.zipInvalid;

  if (!input.operatingHours.trim()) return messages.hoursRequired;

  const phoneDigits = normalizeUSPhone(input.phone);
  if (phoneDigits.length !== 11 || !phoneDigits.startsWith('1')) {
    return messages.phoneInvalid;
  }

  return null;
};

/** @deprecated Use validateDirectoryRegistration */
export const validateBusinessRegistration = validateDirectoryRegistration;

/** @deprecated Use DirectoryRegistrationInput */
export type BusinessRegistrationInput = DirectoryRegistrationInput;

/** @deprecated Use DirectoryRegistrationMessages */
export type BusinessRegistrationMessages = DirectoryRegistrationMessages;
