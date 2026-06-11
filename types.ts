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
  description?: string;
  mapUrl: string;
  externalMapUrl?: string;
  prices: Record<FuelType, number>;
  fireCorpsDiscount: Record<FuelType, number>;
}

export interface NewsItem {
  id: string;
  date: string;
  content: string;
  category: 'important' | 'normal';
}

export interface AppState {
  stores: StoreInfo[];
}
