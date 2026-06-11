
import { StoreInfo } from './types';

export const INITIAL_STORES: StoreInfo[] = [
  {
    id: 'tateyama',
    name: '館山店',
    address: '〒294-0045 千葉県館山市北条1017',
    description: '館山裁判所前',
    tel: '0470-22-6808',
    hours: '平日7:30～19:00 / 祝日9:00～17:00',
    mapUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3265.845689539316!2d139.8656623!3d34.9980685!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x6017e8913996590b%3A0xc6c76615b8160913!2z5pyJ6ZmQ5Lya56S-44Ki44K344OO!5e0!3m2!1sja!2sjp!4v1700000000000!5m2!1sja!2sjp',
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
    mapUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3264.4533134952445!2d139.89201557672224!3d35.03403337280338!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x6017e937d5303c73%3A0x696874837839352c!2z44CSMjk0LTA4MjIg5Y2D6JGJ55yM5Y2X5oi_57eP5biC5pys57mRMzcwaQ!5e0!3m2!1sja!2sjp!4v1716300000000!5m2!1sja!2sjp',
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
