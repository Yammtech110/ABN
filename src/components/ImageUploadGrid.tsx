import React, { useRef, useState, useCallback } from 'react';
import { Camera, ImageIcon, X, AlertCircle } from 'lucide-react';
import {
  MAX_UPLOAD_IMAGES,
  MAX_COUNT_MESSAGE,
  MAX_SIZE_MESSAGE,
  isImageWithinSizeLimit,
  remainingImageSlots,
} from '../utils/imageUploadValidation';

interface ImageUploadGridProps {
  images: string[];
  onChange: (images: string[]) => void;
  language: 'en';
  label?: string;
  id?: string;
  required?: boolean;
  errorMessage?: string | null;
}

export const ImageUploadGrid: React.FC<ImageUploadGridProps> = ({
  images,
  onChange,
  language,
  label,
  id = 'image-upload-grid',
  required = false,
  errorMessage = null,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [addSlotFlash, setAddSlotFlash] = useState(false);

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4000);
  }, []);

  const flashAddSlot = useCallback(() => {
    setAddSlotFlash(true);
    window.setTimeout(() => setAddSlotFlash(false), 600);
  }, []);

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    // Always clear native input so the same file can be re-selected after rejection
    if (fileInputRef.current) fileInputRef.current.value = '';

    if (files.length === 0) return;

    const slotsLeft = remainingImageSlots(images.length);

    if (slotsLeft === 0) {
      window.alert(MAX_COUNT_MESSAGE);
      showToast(MAX_COUNT_MESSAGE);
      flashAddSlot();
      return;
    }

    if (files.length > slotsLeft) {
      window.alert(MAX_COUNT_MESSAGE);
      showToast(MAX_COUNT_MESSAGE);
      flashAddSlot();
    }

    const batch = files.slice(0, slotsLeft);
    const nextImages = [...images];
    let addedCount = 0;
    let rejectedSize = false;

    for (const file of batch) {
      if (nextImages.length >= MAX_UPLOAD_IMAGES) {
        window.alert(MAX_COUNT_MESSAGE);
        showToast(MAX_COUNT_MESSAGE);
        flashAddSlot();
        break;
      }

      if (!isImageWithinSizeLimit(file)) {
        rejectedSize = true;
        // Oversized file is never added — input already cleared above
        continue;
      }

      try {
        const dataUrl = await readFileAsDataUrl(file);
        nextImages.push(dataUrl);
        addedCount += 1;
      } catch {
        showToast(language === 'en' ? 'Could not read image file.' : 'تعذر قراءة ملف الصورة.');
      }
    }

    if (rejectedSize) {
      showToast(MAX_SIZE_MESSAGE);
      flashAddSlot();
    }

    if (addedCount > 0) {
      onChange(nextImages);
    }
  };

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  const slots = Array.from({ length: MAX_UPLOAD_IMAGES }, (_, i) => images[i] ?? null);
  const canAddMore = images.length < MAX_UPLOAD_IMAGES;

  return (
    <div id={id}>
      {label && (
        <label className="block text-xs text-gray-400 mb-2">
          {label}
          {required && <span className="text-[#FFA048] ml-0.5">*</span>}
          <span className="ml-1 text-[10px] text-gray-600">
            ({images.length}/{MAX_UPLOAD_IMAGES})
          </span>
        </label>
      )}

      {errorMessage && (
        <p className="mb-2 text-[10px] font-bold text-red-400" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="grid grid-cols-5 gap-2" id={`${id}-grid`}>
        {slots.map((src, index) => {
          const isAddSlot = !src && index === images.length && canAddMore;
          const isEmptySlot = !src && !isAddSlot;

          if (isAddSlot) {
            return (
              <button
                key={`add-${index}`}
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`aspect-square rounded-xl bg-[#0F0E0C] border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-all ${
                  addSlotFlash || (required && images.length === 0 && errorMessage)
                    ? 'border-red-500/70 bg-red-950/20'
                    : 'border-[#2D2319] hover:border-[#FFA048]/50'
                }`}
                aria-label={language === 'en' ? 'Upload image' : 'رفع صورة'}
              >
                <Camera className={`w-4 h-4 ${addSlotFlash ? 'text-red-400' : 'text-[#FFA048]'}`} />
                <span className="text-[8px] text-gray-500 font-bold">
                  {language === 'en' ? 'Add' : 'إضافة'}
                </span>
              </button>
            );
          }

          if (isEmptySlot) {
            return (
              <div
                key={`empty-${index}`}
                className="aspect-square rounded-xl bg-[#0F0E0C]/40 border border-[#2D2319]/40 flex items-center justify-center opacity-40"
              >
                <ImageIcon className="w-4 h-4 text-gray-700" />
              </div>
            );
          }

          return (
            <div
              key={`img-${index}`}
              className="relative aspect-square rounded-xl bg-[#0F0E0C] border border-[#2D2319] overflow-hidden group"
            >
              <img src={src!} alt={`Upload ${index + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(index)}
                className="absolute top-1 right-1 p-0.5 rounded-full bg-black/70 text-white opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                aria-label={language === 'en' ? 'Remove image' : 'إزالة الصورة'}
              >
                <X className="w-3 h-3" />
              </button>
              {index === 0 && (
                <span className="absolute bottom-0 inset-x-0 bg-[#FFA048]/90 text-[7px] font-extrabold text-black text-center py-0.5">
                  {language === 'en' ? 'MAIN' : 'رئيسية'}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {canAddMore && images.length === 0 && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="mt-2 w-full py-2 rounded-xl bg-[#191613] border border-[#2D2319] text-xs text-gray-300 hover:text-white hover:border-[#FFA048]/40 transition-all flex items-center justify-center gap-2"
        >
          <Camera className="w-3.5 h-3.5 text-[#FFA048]" />
          {language === 'en' ? '📸 Upload Photos (max 5, 1MB each)' : '📸 رفع صور (5 كحد أقصى، 1MB لكل صورة)'}
        </button>
      )}

      <p className="mt-1.5 text-[9px] text-gray-600">
        {language === 'en'
          ? 'Up to 5 images · 1MB max each · First image is used as the listing thumbnail.'
          : 'حتى 5 صور · 1MB كحد أقصى · الصورة الأولى تُستخدم كصورة العرض.'}
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
        id={`${id}-file-input`}
      />

      {toast && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] max-w-[92vw] px-4 py-3 rounded-2xl text-xs font-bold shadow-xl border animate-fade-in bg-red-950/95 border-red-600 text-red-100 flex items-center gap-2.5"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-300" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
};
