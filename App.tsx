
import React, { useState, useEffect, useMemo } from 'react';
import { GoogleGenAI } from '@google/genai';
import { INITIAL_STORES } from './constants';
import { StoreInfo, FuelType } from './types';
import PriceBoard from './components/PriceBoard';
import ServiceCard from './components/ServiceCard';

const App: React.FC = () => {
  const [stores, setStores] = useState<StoreInfo[]>(() => {
    const saved = localStorage.getItem('yoshino_stores_data');
    return saved ? JSON.parse(saved) : INITIAL_STORES;
  });
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showAdminConfirm, setShowAdminConfirm] = useState(false);
  const [mgmtUnlocked, setMgmtUnlocked] = useState(() => {
    return localStorage.getItem('yoshino_mgmt_unlocked') === 'true';
  });
  const [logoClicks, setLogoClicks] = useState(0);
  const [adminPassword, setAdminPassword] = useState('');
  const [passError, setPassError] = useState(false);
  
  const [aiTip, setAiTip] = useState<string>('読み込み中...');
  const [groundingLinks, setGroundingLinks] = useState<{uri: string, title: string}[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

  // 管理モード設定
  const SECRET_CODE = "yoshino777"; // 管理者用パスワード

  useEffect(() => {
    localStorage.setItem('yoshino_stores_data', JSON.stringify(stores));
  }, [stores]);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.debug("Geolocation not available or denied:", error);
          setUserLocation({ lat: 34.996176, lng: 139.858713 });
        }
      );
    } else {
      setUserLocation({ lat: 34.996176, lng: 139.858713 });
    }
  }, []);

  const handleLogoClick = () => {
    const newCount = logoClicks + 1;
    setLogoClicks(newCount);
    if (newCount >= 5) {
      setMgmtUnlocked(true);
      localStorage.setItem('yoshino_mgmt_unlocked', 'true');
      setLogoClicks(0);
    }
    // 3秒後にクリックカウントをリセット
    setTimeout(() => setLogoClicks(0), 3000);
  };

  const handlePriceUpdate = (storeId: string, type: FuelType, newPrice: number) => {
    setStores(prev => prev.map(store => 
      store.id === storeId 
        ? { ...store, prices: { ...store.prices, [type]: newPrice } }
        : store
    ));
  };

  const handleDiscountUpdate = (storeId: string, type: FuelType, newDiscount: number) => {
    setStores(prev => prev.map(store => 
      store.id === storeId 
        ? { ...store, fireCorpsDiscount: { ...store.fireCorpsDiscount, [type]: newDiscount } }
        : store
    ));
  };

  const filteredStores = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return stores;
    return stores.filter(store => 
      store.name.toLowerCase().includes(query) || 
      store.address.toLowerCase().includes(query) ||
      (store.description && store.description.toLowerCase().includes(query))
    );
  }, [stores, searchQuery]);

  useEffect(() => {
    const fetchAiTip = async () => {
      if (!userLocation) return;
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: '千葉県館山・南房総エリアのドライバーに向けて、現在の天気や周辺の交通状況、またはドライブに役立つ地域情報を1つ、50文字程度で簡潔に教えてください。挨拶は不要です。',
          config: {
            tools: [{ googleMaps: {} }],
            toolConfig: {
              retrievalConfig: {
                latLng: {
                  latitude: userLocation.lat,
                  longitude: userLocation.lng
                }
              }
            }
          },
        });
        setAiTip(response.text || '安全運転で、今日も一日お気をつけて！');
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks) {
          const links = chunks
            .filter(c => c.maps)
            .map(c => ({ uri: c.maps.uri, title: c.maps.title }));
          setGroundingLinks(links);
        }
      } catch (error) {
        setAiTip('タイヤの空気圧チェックは燃費向上に効果的です。定期的な点検を！');
      }
    };
    if (userLocation) fetchAiTip();
  }, [userLocation]);

  const tryEnterAdminMode = () => {
    if (isAdminMode) {
      // すでに管理モードなら終了するだけ
      setIsAdminMode(false);
      setShowAdminConfirm(false);
      setAdminPassword('');
      return;
    }
    
    if (adminPassword === SECRET_CODE) {
      setIsAdminMode(true);
      setShowAdminConfirm(false);
      setAdminPassword('');
      setPassError(false);
    } else {
      setPassError(true);
      setTimeout(() => setPassError(false), 2000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-['Noto_Sans_JP'] bg-white">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-md shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button 
              onClick={handleLogoClick}
              className="bg-red-600 text-white w-12 h-12 flex items-center justify-center font-black rounded-xl text-3xl shadow-lg transform rotate-3 active:scale-90 transition-transform"
            >
              Y
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tighter text-gray-900 leading-none">有限会社 ヨシノ</h1>
              <p className="text-[10px] font-bold text-red-600 mt-1 uppercase tracking-widest">Full Service Station</p>
            </div>
          </div>
          <nav className="hidden lg:flex space-x-10 font-black text-sm uppercase tracking-tighter">
            <a href="#prices" className="text-gray-600 hover:text-red-600 transition-colors">Prices</a>
            <a href="#full-service" className="text-gray-600 hover:text-red-600 transition-colors">Our Service</a>
            <a href="#delivery" className="text-gray-600 hover:text-red-600 transition-colors">Delivery</a>
            <a href="#stores" className="text-gray-600 hover:text-red-600 transition-colors">Access</a>
          </nav>
          <div className="flex items-center space-x-4">
            {mgmtUnlocked && (
              <button 
                onClick={() => setShowAdminConfirm(true)}
                className={`px-4 py-2 rounded-full text-[10px] font-black tracking-widest transition-all animate-fadeIn ${
                  isAdminMode ? 'bg-red-600 text-white shadow-inner' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {isAdminMode ? 'ADMIN: ON' : 'MGMT'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative h-[600px] md:h-[750px] flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img 
            src="input_file_0.png" 
            alt="有限会社ヨシノ 店舗外観" 
            className="w-full h-full object-cover scale-105 animate-[pulse_10s_ease-in-out_infinite]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-red-900/20 to-transparent"></div>
        </div>

        <div className="relative container mx-auto px-4 text-center text-white">
          <div className="inline-flex items-center space-x-3 bg-red-600 text-white text-[11px] font-black px-6 py-2 rounded-full mb-10 tracking-[0.3em] shadow-[0_0_40px_rgba(220,38,38,0.5)] animate-fadeIn">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            <span>館山市・南房総市のフルサービスSS</span>
          </div>
          
          <h2 className="text-5xl md:text-9xl font-black mb-8 drop-shadow-[0_10px_10px_rgba(0,0,0,0.8)] tracking-tighter leading-tight animate-fadeIn" style={{ animationDelay: '0.2s' }}>
            真心の給油、<br />
            <span className="text-red-500">この街</span>の安心。
          </h2>
          
          <p className="text-lg md:text-3xl font-medium mb-12 max-w-3xl mx-auto drop-shadow-lg text-gray-100 leading-relaxed animate-fadeIn" style={{ animationDelay: '0.4s' }}>
            (有)ヨシノは、お客様が車から降りずに完結する<br className="hidden md:block" />
            「フルサービス」にこだわり、半世紀にわたり地域を支え続けます。
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center animate-fadeIn" style={{ animationDelay: '0.6s' }}>
            <a href="#prices" className="bg-red-600 hover:bg-red-700 text-white px-14 py-6 rounded-full font-black text-2xl shadow-[0_15px_30px_rgba(220,38,38,0.4)] transition-all transform hover:scale-105 active:scale-95 text-center">
              本日の価格を見る
            </a>
            <a href="#full-service" className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border-2 border-white/50 px-14 py-6 rounded-full font-black text-2xl shadow-2xl transition-all transform hover:scale-105 active:scale-95 text-center">
              当店のこだわり
            </a>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-gray-900 to-transparent"></div>
      </section>

      {/* Local Info Bar */}
      <div className="bg-gray-900 py-5 border-y border-white/5 shadow-2xl relative z-20">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-center gap-6">
          <div className="flex items-center space-x-4">
            <span className="bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded tracking-widest shadow-lg">REGION AI TIP</span>
            <p className="text-gray-300 text-sm md:text-base font-bold tracking-tight text-center md:text-left">{aiTip}</p>
          </div>
          {groundingLinks.length > 0 && (
            <div className="flex flex-wrap justify-center gap-6">
              {groundingLinks.slice(0, 2).map((link, idx) => (
                <a key={idx} href={link.uri} target="_blank" rel="noopener noreferrer" className="text-xs text-red-400 font-black underline hover:text-red-300 flex items-center transition-colors">
                  <span className="mr-2">📍</span> {link.title}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fuel Price Section */}
      <section id="prices" className="py-24 bg-gray-900 text-white scroll-mt-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h3 className="text-5xl md:text-7xl font-black mb-6 tracking-tighter">DAILY PRICES</h3>
            <div className="w-24 h-2 bg-red-600 mx-auto rounded-full mb-10"></div>
            
            <div className="inline-flex flex-col items-center bg-white/5 backdrop-blur-xl px-12 py-10 rounded-[4rem] border border-white/10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden group hover:border-orange-500/50 transition-all duration-700">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-500 via-red-600 to-orange-500"></div>
              <div className="flex items-center mb-6">
                <span className="bg-orange-600 text-white text-xs font-black px-4 py-1.5 rounded-full mr-4 shadow-xl">館山市消防団サポート</span>
                <p className="text-white font-black text-2xl tracking-tighter italic">地域を守る皆様を強力支援</p>
              </div>
              <p className="text-gray-300 text-xl md:text-2xl font-medium mb-4 text-center">
                レギュラー・軽油：一般価格より<span className="text-orange-500 text-6xl font-black mx-3 underline decoration-orange-500/20">7円引き</span>
              </p>
              <div className="bg-white/5 rounded-3xl p-6 border border-white/5">
                <p className="text-sm text-orange-200 font-bold tracking-widest leading-relaxed text-center">
                  ※消防団員カードのご提示をお願いします（現金精算のみ）<br />
                  (有)ヨシノは館山市消防団サポート事業の協力企業です。
                </p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 max-w-7xl mx-auto">
            {stores.map(store => (
              <PriceBoard 
                key={store.id}
                storeName={store.name}
                prices={store.prices}
                fireCorpsDiscount={store.fireCorpsDiscount}
                isEditable={isAdminMode}
                onPriceChange={(type, newPrice) => handlePriceUpdate(store.id, type, newPrice)}
                onDiscountChange={(type, newDiscount) => handleDiscountUpdate(store.id, type, newDiscount)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Full Service Benefits */}
      <section id="full-service" className="py-32 bg-white relative overflow-hidden scroll-mt-24">
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-5xl mx-auto text-center">
            <span className="text-red-600 font-black text-sm uppercase tracking-[0.4em] block mb-6">Staff on Duty</span>
            <h3 className="text-5xl md:text-7xl font-black mb-10 tracking-tighter leading-tight text-gray-900">
              「車から降りない」<br className="md:hidden" />という贅沢と安全。
            </h3>
            <p className="text-gray-500 text-xl md:text-2xl font-medium leading-relaxed mb-20 max-w-3xl mx-auto">
              セルフスタンドが主流の今だからこそ、(有)ヨシノは対面サービスにこだわります。プロのスタッフがあなたに代わって、安全・確実・快適な給油を提供します。
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 text-left">
              {[
                { title: "雨でも寒くても、車内で待つだけ", desc: "悪天候の日でも、お客様は快適な車内でお待ちいただくだけ。スタッフが迅速に給油します。" },
                { title: "給油の合間に「窓」も「灰皿」も", desc: "フロントガラスの拭き上げ、ゴミの回収、タイヤ点検など、セルフにはない付加価値を提供。" },
                { title: "国家資格整備士による「安心点検」", desc: "ただ給油するだけではありません。日常点検を通じて、お車の不調を未然に察知します。" },
                { title: "地域貢献への強い想い", desc: "消防団サポートをはじめ、地元の安全を守る活動を積極的に支援。地域のインフラを支えます。" }
              ].map((item, i) => (
                <div key={i} className="flex space-x-8 p-10 rounded-[3rem] bg-gray-50 border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-2 group">
                  <div className="bg-red-600 text-white w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 font-black text-2xl shadow-lg group-hover:rotate-12 transition-transform">{i+1}</div>
                  <div>
                    <h4 className="font-black text-gray-900 text-2xl mb-4 leading-tight">{item.title}</h4>
                    <p className="text-base text-gray-500 leading-relaxed font-bold">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Delivery Section */}
      <section id="delivery" className="py-24 bg-red-600 text-white relative overflow-hidden shadow-[inset_0_0_100px_rgba(0,0,0,0.2)] scroll-mt-24">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-red-700/30 skew-x-12 transform translate-x-1/4"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-20">
            <div className="lg:w-3/5 text-center lg:text-left">
              <div className="inline-block bg-white text-red-600 font-black text-[11px] px-5 py-2 rounded-full mb-8 tracking-[0.4em] shadow-2xl">HOME DELIVERY</div>
              <h3 className="text-5xl md:text-8xl font-black mb-10 tracking-tighter leading-tight">
                冬の灯油も、<br />現場の軽油も。
              </h3>
              <p className="text-2xl md:text-3xl font-bold mb-12 text-white/95 leading-relaxed">
                重いポリタンクの運搬、ヨシノにおまかせください。<br />
                ご自宅、店舗、建設現場まで迅速にお届けします。
              </p>
            </div>
            <div className="lg:w-2/5 w-full">
              <div className="bg-white p-12 rounded-[4rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] text-gray-900 text-center transform hover:scale-105 transition-transform">
                <p className="text-red-600 font-black text-sm tracking-[0.3em] mb-6">お電話一本で配送手配</p>
                <a href="tel:0470-22-6808" className="text-5xl font-black tracking-tighter text-gray-900 mb-10 block hover:text-red-600 transition-colors leading-none">0470-22-6808</a>
                <div className="space-y-6 mb-10">
                  <div className="flex items-center justify-between text-base border-b border-gray-100 pb-3">
                    <span className="text-gray-400 font-bold">配送エリア</span>
                    <span className="font-black">館山市・南房総市</span>
                  </div>
                  <div className="flex items-center justify-between text-base border-b border-gray-100 pb-3">
                    <span className="text-gray-400 font-bold">最小配送量</span>
                    <span className="font-black">ポリタンク1缶(18L)～</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Access Section */}
      <section id="stores" className="py-32 bg-white scroll-mt-24">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto text-center mb-24">
            <h3 className="text-5xl md:text-7xl font-black mb-8 tracking-tighter text-gray-900 uppercase">Our Locations</h3>
            <p className="text-gray-500 mb-16 font-bold text-lg tracking-wide max-w-2xl mx-auto leading-relaxed">館山市、南房総市で皆様のカーライフをサポート。</p>
            
            <div className="relative max-w-2xl mx-auto transition-all duration-500 transform-gpu focus-within:scale-[1.05]">
              <div className="absolute inset-y-0 left-0 pl-8 flex items-center pointer-events-none">
                <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="店名やエリアで検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-20 pr-10 py-7 border-4 border-gray-100 rounded-[3rem] bg-gray-50 focus:border-red-600 focus:bg-white focus:ring-[20px] focus:ring-red-600/5 transition-all outline-none text-2xl shadow-2xl font-black placeholder-gray-300"
              />
            </div>
          </div>

          {filteredStores.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 max-w-[1400px] mx-auto">
              {filteredStores.map(store => (
                <div key={store.id} className="bg-white rounded-[4rem] overflow-hidden shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] flex flex-col border border-gray-100 transition-all duration-500 animate-fadeIn hover:shadow-red-900/10 group">
                  <div className="p-16 flex flex-col">
                    <div className="flex items-center justify-between mb-8">
                      <span className="bg-red-600 text-white text-[11px] font-black px-5 py-2 rounded-full uppercase tracking-widest shadow-xl">
                        FULL SERVICE
                      </span>
                      <a href={`tel:${store.tel.replace(/-/g, '')}`} className="text-red-600 font-black text-xl hover:underline">{store.tel}</a>
                    </div>
                    <h4 className="text-5xl font-black mb-8 group-hover:text-red-600 transition-colors tracking-tighter leading-none">ヨシノ {store.name}</h4>
                    <ul className="space-y-8 text-gray-600 text-lg font-bold">
                      {store.description && (
                        <li className="flex items-start font-black text-red-600 bg-red-50 p-6 rounded-3xl border border-red-100/50 shadow-sm transform -rotate-1">
                          <svg className="w-7 h-7 text-red-600 mt-1 mr-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          <span>{store.description}</span>
                        </li>
                      )}
                      <li className="flex items-start px-2">
                        <svg className="w-6 h-6 text-red-600 mt-1 mr-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                        {store.address}
                      </li>
                      <li className="flex items-start px-2">
                        <svg className="w-6 h-6 text-red-600 mt-1 mr-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <p>{store.hours}</p>
                      </li>
                    </ul>
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.address)}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="mt-16 flex items-center justify-center space-x-3 w-full bg-gray-900 text-white hover:bg-red-600 font-black py-7 rounded-[2.5rem] transition-all shadow-2xl active:scale-95 text-xl"
                    >
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                      <span>地図アプリで見る</span>
                    </a>
                  </div>
                  <div className="h-[500px] w-full border-t border-gray-100">
                    <iframe 
                      title={`${store.name} Map`}
                      src={store.mapUrl}
                      className="w-full h-full border-0 grayscale hover:grayscale-0 transition-all duration-[2s]"
                      allowFullScreen={true}
                      loading="lazy"
                    ></iframe>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-40 bg-gray-50 rounded-[5rem] border-8 border-dashed border-gray-100 animate-fadeIn">
              <h4 className="text-4xl font-black text-gray-300 mb-8 tracking-tighter">店舗が見つかりませんでした</h4>
              <button 
                onClick={() => setSearchQuery('')}
                className="bg-red-600 text-white px-16 py-6 rounded-full font-black text-xl transition-all shadow-2xl hover:bg-red-700 active:scale-95"
              >
                検索条件をリセット
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-32 mt-auto relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-600 to-orange-500"></div>
        <div className="container mx-auto px-4 text-center md:text-left relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start gap-20 border-b border-white/5 pb-24 mb-20">
            <div className="max-w-xl">
              <div className="flex items-center space-x-6 mb-12">
                <div className="bg-red-600 text-white w-16 h-16 flex items-center justify-center font-black rounded-2xl text-4xl shadow-[0_15px_30px_rgba(220,38,38,0.4)] transform -rotate-3">Y</div>
                <span className="text-5xl font-black tracking-tighter">有限会社 ヨシノ</span>
              </div>
              <div className="space-y-8 font-bold text-gray-400 text-lg">
                <p className="flex items-start">
                  <span className="bg-white/5 p-3 rounded-2xl mr-6 mt-0.5 text-center shadow-inner">📍</span>
                  <span>〒294-0045 千葉県館山市北条1017<br /><span className="text-xs text-gray-500 font-medium uppercase tracking-widest mt-2 block">Tateyama Branch</span></span>
                </p>
                <p className="flex items-center">
                  <span className="bg-white/5 p-3 rounded-2xl mr-6 text-center shadow-inner">📞</span>
                  <span className="text-4xl text-white font-black tracking-tighter">0470-22-6808</span>
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-center gap-10 text-gray-600 text-xs font-black tracking-[0.6em] uppercase text-center md:text-left">
            &copy; {new Date().getFullYear()} YOSHINO CO., LTD. ALL RIGHTS RESERVED.
          </div>
        </div>
      </footer>

      {/* Admin Confirmation Modal with Password */}
      {showAdminConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-[4rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] max-w-lg w-full overflow-hidden border border-gray-100 transition-all">
            <div className="bg-red-600 p-12 text-white text-center">
              <div className="w-24 h-24 bg-white/20 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-4xl font-black tracking-tighter">管理モード認証</h3>
            </div>
            <div className="p-12 text-center">
              <p className="text-gray-600 text-lg font-bold mb-8 leading-relaxed px-4">
                {isAdminMode 
                  ? "管理モードを終了し、通常表示に戻ります。編集内容は保存されます。" 
                  : "管理モードを有効にするには、アクセスコードを入力してください。"}
              </p>
              
              {!isAdminMode && (
                <div className="mb-8">
                  <input
                    type="password"
                    placeholder="アクセスコード"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && tryEnterAdminMode()}
                    className={`block w-full text-center py-5 border-4 rounded-3xl text-2xl font-black outline-none transition-all ${
                      passError ? 'border-red-500 bg-red-50 animate-bounce' : 'border-gray-100 bg-gray-50 focus:border-red-600 focus:bg-white'
                    }`}
                  />
                  {passError && <p className="text-red-600 font-bold mt-2 text-sm">コードが正しくありません</p>}
                </div>
              )}

              <div className="flex flex-col gap-4">
                <button 
                  onClick={tryEnterAdminMode}
                  className="bg-red-600 hover:bg-red-700 text-white font-black py-7 rounded-[2rem] transition-all shadow-2xl active:scale-95 text-2xl"
                >
                  {isAdminMode ? "管理モードを終了" : "認証して進む"}
                </button>
                <button 
                  onClick={() => {
                    setShowAdminConfirm(false);
                    setAdminPassword('');
                  }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-500 font-black py-7 rounded-[2rem] transition-all active:scale-95 text-xl"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
