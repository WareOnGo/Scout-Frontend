/**
 * Parse media from the new JSONB column, falling back to parsing legacy photos CSV.
 * @param {{ media?: { images?: string[], videos?: string[], docs?: string[] } | null, photos?: string | null }} warehouse
 * @returns {{ images: string[], videos: string[], docs: string[] }}
 */
export const getMediaFromWarehouse = (warehouse) => {
  if (warehouse.media) return warehouse.media;

  // Fallback: parse legacy photos CSV into media shape
  if (warehouse.photos && typeof warehouse.photos === 'string') {
    const urls = warehouse.photos.split(',').map(u => u.trim()).filter(Boolean);
    return { images: urls, videos: [], docs: [] };
  }

  return { images: [], videos: [], docs: [] };
};
