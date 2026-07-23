export const MAX_UPLOAD_IMAGES = 5;
export const MAX_IMAGE_BYTES = 1 * 1024 * 1024; // 1 MB

export const MAX_COUNT_MESSAGE = 'You can upload a maximum of 5 images.';
export const MAX_SIZE_MESSAGE = 'Each image must be smaller than 1MB.';

export function isImageWithinSizeLimit(file: File): boolean {
  return file.size <= MAX_IMAGE_BYTES;
}

export function canAddImages(currentCount: number, incomingCount: number, max = MAX_UPLOAD_IMAGES): boolean {
  return currentCount + incomingCount <= max;
}

export function remainingImageSlots(currentCount: number, max = MAX_UPLOAD_IMAGES): number {
  return Math.max(0, max - currentCount);
}

export function maxCountMessage(max: number): string {
  return max === 1
    ? 'You can upload only 1 image here.'
    : `You can upload a maximum of ${max} images.`;
}
