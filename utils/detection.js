/**
 * detection.js
 *
 * Arabic labels keyed by coco-ssd string class names.
 * 'door' is not in COCO-80 so it cannot be detected by this model.
 */

export const ARABIC_LABELS = {
  person:  'شخص',
  car:     'سيارة',
  bottle:  'زجاجة',
  chair:   'كرسي',
};

export const TARGET_CLASSES = new Set(Object.keys(ARABIC_LABELS));

/**
 * Estimate distance from the bounding box height relative to image height.
 * bbox height and image height are both in pixels.
 */
export function estimateDistance(bboxHeight, imageHeight) {
  const normH = bboxHeight / imageHeight;
  if (normH > 0.55) return 'قريب جداً';
  if (normH > 0.25) return 'قريب';
  return 'بعيد';
}
