
import { StoreInfo } from './types';

export const INITIAL_STORES: StoreInfo[] = [
  {
    id: 'tateyama',
    name: '館山店',
    address: '〒294-0045 千葉県館山市北条1017',
    description: '館山裁判所前',
    tel: '0470-22-6808',
    hours: '平日7:30～19:00 / 祝日9:00～17:00',
    mapUrl: 'https://maps.google.com/maps?q=千葉県館山市北条1017&output=embed&hl=ja',
    externalMapUrl: 'https://maps.google.com/?q=千葉県館山市北条1017',
    prices: {
      regular: 172,
      diesel: 152
    },
    fireCorpsDiscount: {
      regular: 7,
      diesel: 7
    }
  },
  {
    id: 'miyoshi',
    name: '三芳店',
    address: '〒294-0822 千葉県南房総市本織370',
    description: '三芳郵便局となり',
    tel: '0470-36-3466',
    hours: '平日7:30～19:00 / 祝日9:00～17:00',
    mapUrl: 'https://maps.google.com/maps?q=千葉県南房総市本織370&output=embed&hl=ja',
    externalMapUrl: 'https://maps.google.com/?q=千葉県南房総市本織370',
    prices: {
      regular: 174,
      diesel: 154
    },
    fireCorpsDiscount: {
      regular: 7,
      diesel: 7
    }
  }
];

export const FUEL_LABELS: Record<string, { label: string; color: string }> = {
  regular: { label: 'レギュラー', color: 'bg-red-600' },
  diesel: { label: '軽油', color: 'bg-green-600' }
};
