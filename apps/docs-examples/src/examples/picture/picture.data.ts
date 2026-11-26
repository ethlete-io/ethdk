const photo = (id: string, params: string) => `https://images.unsplash.com/${id}?${params}&auto=format&q=80`;

const MOUNTAIN = 'photo-1506744038136-46273834b3fb';
const LAKE = 'photo-1469474968028-56623f02e42e';

export const PICTURE_WIDE_SRC = photo(MOUNTAIN, 'w=960&h=540&fit=crop');
export const PICTURE_TALL_SRC = photo(MOUNTAIN, 'w=600&h=800&fit=crop');
export const PICTURE_FALLBACK_SRC = photo(LAKE, 'w=960&h=540&fit=crop');

export const PICTURE_BROKEN_SRC = 'data:image/png;base64,this-is-not-an-image';
