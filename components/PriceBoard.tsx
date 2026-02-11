
import React from 'react';
import { FuelType } from '../types';
import { FUEL_LABELS } from '../constants';

interface PriceBoardProps {
  prices: Record<FuelType, number>;
  fireCorpsDiscount: Record<FuelType, number>;
  storeName: string;
  isEditable: boolean;
  onPriceChange?: (type: FuelType, newPrice: number) => void;
  onDiscountChange?: (type: FuelType, newDiscount: number) => void;
}

const PriceBoard: React.FC<PriceBoardProps> = ({ 
  prices, 
  fireCorpsDiscount,
  storeName, 
  isEditable, 
  onPriceChange,
  onDiscountChange 
}) => {
  return (
    <div className="bg-gray-900 p-6 rounded-2xl shadow-2xl border-4 border-gray-800">
      <div className="flex justify-between items-center mb-6 border-b border-gray-700 pb-2">
        <h3 className="text-white text-xl font-bold">{storeName} 価格表</h3>
        <span className="text-gray-400 text-sm">税込価格</span>
      </div>
      
      <div className="space-y-6">
        {(Object.entries(prices) as [FuelType, number][]).map(([type, price]) => {
          const fcDiscount = fireCorpsDiscount[type] || 0;
          const fcPrice = price - fcDiscount;

          return (
            <div key={type} className="bg-black rounded-xl p-5 border border-gray-800 transition-all hover:border-gray-600">
              <div className="flex items-center justify-between mb-4">
                <div className={`px-5 py-1.5 rounded text-white font-black text-lg ${FUEL_LABELS[type].color}`}>
                  {FUEL_LABELS[type].label}
                </div>
                <div className="text-gray-400 text-xs font-bold flex flex-col items-end">
                  <span className="mb-1 text-[10px] uppercase tracking-widest text-gray-500">Normal / Cash Member</span>
                  <div className="flex items-baseline">
                    <span className="text-gray-400 text-sm mr-2 font-medium">一般現金</span>
                    {isEditable ? (
                      <input
                        type="number"
                        value={price}
                        onChange={(e) => onPriceChange?.(type, Number(e.target.value))}
                        className="bg-gray-800 text-yellow-400 text-3xl font-bold w-24 text-right rounded px-2"
                      />
                    ) : (
                      <span className="text-yellow-400 text-4xl font-black led-font tracking-tighter">{price}</span>
                    )}
                    <span className="text-gray-400 text-xs ml-1">円</span>
                  </div>
                </div>
              </div>

              {/* Fire Corps Member Special Price Section */}
              <div className="flex items-center justify-between bg-orange-950/20 rounded-lg px-4 py-3 border border-orange-500/30 shadow-[inset_0_0_20px_rgba(249,115,22,0.05)]">
                <div className="flex flex-col">
                  <div className="flex items-center mb-1">
                    <span className="text-orange-400 text-[10px] font-black uppercase tracking-wider border border-orange-400/30 px-1.5 rounded mr-2">
                      Card Benefit
                    </span>
                    <span className="text-red-500 text-[10px] font-black">7円引き適用中</span>
                  </div>
                  <span className="text-white text-sm font-bold leading-tight">消防団員価格 <span className="text-gray-500 text-[10px] font-normal">(現金精算)</span></span>
                </div>
                <div className="flex items-baseline text-orange-500">
                  {isEditable ? (
                    <div className="flex items-center text-xs">
                      <span className="text-gray-400 mr-2 font-medium">値引額:</span>
                      <input
                        type="number"
                        value={fcDiscount}
                        onChange={(e) => onDiscountChange?.(type, Number(e.target.value))}
                        className="bg-gray-700 text-orange-400 text-xl font-bold w-16 text-right rounded px-1"
                      />
                    </div>
                  ) : (
                    <>
                      <span className="text-3xl font-black led-font tracking-tighter">{fcPrice}</span>
                      <span className="text-xs ml-1 font-bold">円</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="mt-6 pt-4 border-t border-gray-800 space-y-2">
        <div className="flex items-start">
          <span className="text-red-500 text-[10px] mr-1">※</span>
          <p className="text-[10px] text-gray-500 leading-relaxed">
            消防団員価格の適用には「消防団員カード」の提示が必要です。
          </p>
        </div>
        <div className="flex items-start">
          <span className="text-red-500 text-[10px] mr-1">※</span>
          <p className="text-[10px] text-gray-400 italic font-bold leading-relaxed">
            ガソリン（レギュラー）・軽油のみ一般価格より7円引きとなります（現金精算のみ）。
          </p>
        </div>
      </div>
    </div>
  );
};

export default PriceBoard;
