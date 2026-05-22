
export type FuelType = 'regular' | 'diesel';

export interface FuelPrice {
  id: FuelType;
  label: string;
  price: number;
  color: string;
}

export interface StoreInfo {
  id: string;
  name: string;
  address: string;
  tel: string;
  hours: string;
  description?: string; // Landmark or feature (e.g., "Next to post office")
  mapUrl: string;
  prices: Record<FuelType, number>;
  fireCorpsDiscount: Record<FuelType, number>; // Discount amount (e.g., 7 means 7 yen off)
}

export interface AppState {
  stores: StoreInfo[];
}

export type ArticleCategory = 'service' | 'price' | 'seasonal' | 'local' | 'campaign';

export interface NoteArticle {
  id: string;
  title: string;
  content: string;
  tags: string[];
  status: 'draft' | 'published';
  category: ArticleCategory;
  createdAt: string;
  updatedAt: string;
}
