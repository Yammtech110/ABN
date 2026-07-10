export const MAX_UPLOAD_IMAGES = 5;
export const MAX_IMAGE_BYTES = 1 * 1024 * 1024; // 1 MB

export const MAX_COUNT_MESSAGE = 'You can upload a maximum of 5 images.';
export const MAX_SIZE_MESSAGE = 'Each image must be smaller than 1MB.';

export function isImageWithinSizeLimit(file: File): boolean {
  return file.size <= MAX_IMAGE_BYTES;
}

export function canAddImages(currentCount: number, incomingCount: number): boolean {
  return currentCount + incomingCount <= MAX_UPLOAD_IMAGES;
}

export function remainingImageSlots(currentCount: number): number {
  return Math.max(0, MAX_UPLOAD_IMAGES - currentCount);
}
