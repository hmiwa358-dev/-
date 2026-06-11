import React, { useState, useEffect, useMemo } from 'react';
import { GoogleGenAI } from '@google/genai';
import { INITIAL_STORES } from './constants';
import { StoreInfo, FuelType, NewsItem } from './types';
import PriceBoard from './components/PriceBoard';
import ServiceCard from './components/ServiceCard';

const App: React.FC = () => {
  const [stores, setStores] = useState<StoreInfo[]>(INITIAL_STORES);
  const [newsList, setNewsList] = useState<NewsItem[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [showAdminConfirm, setShowAdminConfirm] = useState(false);
  const [mgmtUnlocked, setMgmtUnlocked] = useState(() => {
    return localStorage.getItem('yoshino_mgmt_unlocked') === 'true';
  });
  const [logoClicks, setLogoClicks] = useState(0);
  const [adminPassword, setAdminPassword] = useState('');
  const [passError, setPassError] = useState(false);

  // 新規お知らせ入力用
  const [newNewsDate, setNewNewsDate] = useState('');
  const [newNewsContent, setNewNewsContent] = useState('');
  const [newNewsCategory, setNewNewsCategory] = useState<'important' | 'normal'>('normal');
  const [showAllNews, setShowAllNews] = useState(false);

  const [aiTip, setAiTip] = useState<string>('読み込み中...');
  const [groundingLinks, setGroundingLinks] = useState<{uri: string, title: string}[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);

  // Image optimization state
  const [heroImageLoaded, setHeroImageLoaded] = useState(false);
  const [saveToast, setSaveToast] = useState(false);

  // 管理モード設定
  const SECRET_CODE = (typeof process !== 'undefined' ? process.env?.ADMIN_PASSWORD : undefined) || import.meta.env.VITE_ADMIN_PASSWORD || "ty226808";

  // サーバーからデータ取得
  useEffect(() => {
    setIsDataLoading(true);
    fetch('/api/data')
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then(data => {
        if (data.stores && data.stores.length > 0) setStores(data.stores);
        if (data.news) setNewsList(data.news);
      })
      .catch(err => console.error("Data fetch error:", err))
      .finally(() => setIsDataLoading(false));
  }, []);

  // サーバーへ保存
  const saveData = async (updatedStores: StoreInfo[], updatedNews: NewsItem[]) => {
    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stores: updatedStores, news: updatedNews }),
      });
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 2000);
    } catch (err) {
      console.error("Save error:", err);
    }
  };

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
    setStores(prev => {
      const updated = prev.map(store =>
        store.id === storeId
          ? { ...store, prices: { ...store.prices, [type]: newPrice } }
          : store
      );
      saveData(updated, newsList);
      return updated;
    });
  };

  const handleDiscountUpdate = (storeId: string, type: FuelType, newDiscount: number) => {
    setStores(prev => {
      const updated = prev.map(store =>
        store.id === storeId
          ? { ...store, fireCorpsDiscount: { ...store.fireCorpsDiscount, [type]: newDiscount } }
          : store
      );
      saveData(updated, newsList);
      return updated;
    });
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
          model: 'gemini-2.0-flash',
          contents: '千葉県館山・南房総エリアのドライバーに向けて、現在の天気や周辺の交通状況、またはドライブに役立つ地域情報を1つ、50文字程度 for short simple tip. 挨拶は不要です。',
          config: {
            tools: [{ googleSearch: {} }],
          },
        });
        setAiTip(response.text || '安全運転で、今日も一日お気をつけて！');
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (chunks) {
          const links = chunks
            .filter((c: any) => c.web)
            .map((c: any) => ({ uri: c.web.uri, title: c.web.title }));
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

      // 編集画面を開いた瞬間に今日の日付をセット (YYYY-MM-DD形式)
      const today = new Date().toISOString().split('T')[0];
      setNewNewsDate(today);
    } else {
      setPassError(true);
      setTimeout(() => setPassError(false), 2000);
    }
  };

  // お知らせ追加
  const addNews = () => {
    if (!newNewsContent.trim()) return;
    const newItem: NewsItem = {
      id: Date.now().toString(),
      date: newNewsDate,
      content: newNewsContent,
      category: newNewsCategory
    };
    const updated = [newItem, ...newsList]; // 新しいものを上に
    setNewsList(updated);
    saveData(stores, updated);
    setNewNewsContent('');
    setNewNewsCategory('normal');
  };

  // お知らせ削除
  const deleteNews = (id: string) => {
    const updated = newsList.filter(item => item.id !== id);
    setNewsList(updated);
    saveData(stores, updated);
  };

  // 表示用リスト（最新5件 or 全件）
  const displayNews = useMemo(() => {
    const sorted = [...newsList].sort((a, b) => b.date.localeCompare(a.date));
    return showAllNews ? sorted : sorted.slice(0, 5);
  }, [newsList, showAllNews]);

  return (
    <div className="min-h-screen flex flex-col font-['Noto_Sans_JP'] bg-white overflow-x-hidden">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-md shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 md:px-6 min-h-16 md:min-h-20 h-auto py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2 md:space-x-3 shrink-0 flex-wrap">
            <button
              onClick={handleLogoClick}
              className="bg-red-600 text-white w-10 h-10 md:w-12 md:h-12 flex items-center justify-center font-black rounded-lg md:rounded-xl text-xl md:text-3xl shadow-lg transform rotate-3 active:scale-90 transition-transform"
            >
              Y
            </button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg md:text-2xl font-black tracking-tighter text-gray-900 leading-none break-words">有限会社 ヨシノ</h1>
              <p className="text-[7px] sm:text-[9px] md:text-[10px] font-bold text-red-600 mt-0.5 md:mt-1 uppercase tracking-widest break-words">Semi-Self Service Station</p>
            </div>
          </div>
          <nav className="hidden lg:flex space-x-6 xl:space-x-10 font-black text-sm uppercase tracking-tighter">
            <a href="#prices" className="text-gray-600 hover:text-red-600 transition-colors">Prices</a>
            <a href="#our-service" className="text-gray-600 hover:text-red-600 transition-colors">Our Service</a>
            <a href="#delivery" className="text-gray-600 hover:text-red-600 transition-colors">Delivery</a>
            <a href="#stores" className="text-gray-600 hover:text-red-600 transition-colors">Access</a>
          </nav>
          <div className="flex items-center space-x-2 md:space-x-4">
            <a
              href="https://lin.ee/oE5U1Qv"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#06C755] text-white p-2 md:px-4 md:py-2 rounded-full md:rounded-lg flex items-center shadow-md active:scale-95 transition-transform"
            >
              <svg className="w-5 h-5 md:w-6 md:h-6 md:mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 10.304c0-5.369-5.383-9.738-12-9.738-6.616 0-12 4.369-12 9.738 0 4.814 4.269 8.846 10.036 9.608.391.084.922.258 1.057.592.121.303.079.778.039 1.085l-.171 1.027c-.053.303-.242 1.185 1.039.646 1.281-.539 6.905-4.066 9.408-6.958 1.838-2.122 2.592-4.041 2.592-6.2z"/>
              </svg>
              <span className="hidden md:inline font-black text-xs">LINE追加</span>
            </a>
            {mgmtUnlocked && (
              <button
                onClick={() => setShowAdminConfirm(true)}
                className={`px-3 py-1.5 md:px-4 md:py-2 rounded-full text-[8px] md:text-[10px] font-black tracking-widest transition-all animate-fadeIn ${
                  isAdminMode ? 'bg-red-600 text-white shadow-inner' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {isAdminMode ? 'ADMIN: ON' : 'MGMT'}
              </button>
            )}
            <a href="tel:0470-22-6808" className="bg-gray-900 text-white p-2.5 md:hidden rounded-full shadow-lg active:scale-90 transition-transform">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-[480px] sm:min-h-[600px] md:min-h-[750px] h-auto py-16 sm:py-24 md:py-32 flex items-center justify-center overflow-hidden bg-gray-900">
        <div className="absolute inset-0">
          <img
            src="input_file_0.png"
            alt="有限会社ヨシノ 店舗外観"
            fetchPriority="high"
            decoding="async"
            onLoad={() => setHeroImageLoaded(true)}
            className={`w-full h-full object-cover scale-105 transition-opacity duration-1000 ease-in-out ${heroImageLoaded ? 'opacity-100 animate-[pulse_15s_ease-in-out_infinite]' : 'opacity-0'}`}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/80"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-red-900/30 to-transparent"></div>
        </div>

        <div className="relative container mx-auto px-4 text-center text-white min-w-0">
          <div className="inline-flex items-center justify-center flex-wrap gap-1.5 md:gap-2 bg-red-600 text-white text-[9px] sm:text-[10px] md:text-[11px] font-black px-4 py-1.5 md:px-6 md:py-2 rounded-full mb-6 md:mb-10 tracking-[0.2em] md:tracking-[0.3em] shadow-[0_0_40px_rgba(220,38,38,0.5)] animate-fadeIn break-words max-w-full">
            <span className="relative flex h-1.5 w-1.5 md:h-2 md:w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 md:h-2 md:w-2 bg-white"></span>
            </span>
            <span className="break-words">館山市・南房総市のセミセルフサービスのガソリンスタンド</span>
          </div>

          <h2 className="text-3xl sm:text-5xl md:text-6xl lg:text-8xl font-black mb-6 md:mb-8 drop-shadow-[0_10px_10px_rgba(0,0,0,0.8)] tracking-tighter leading-[1.1] animate-fadeIn break-words" style={{ animationDelay: '0.2s' }}>
            安心・便利！<br />
            ご自宅・事業所まで<br />
            <span className="text-red-500">灯油・軽油</span>をお届け
          </h2>

          <p className="text-sm sm:text-lg md:text-2xl lg:text-3xl font-medium mb-8 md:mb-12 max-w-3xl mx-auto drop-shadow-lg text-gray-100 leading-relaxed animate-fadeIn px-2 md:px-0 break-words" style={{ animationDelay: '0.4s' }}>
            地域密着のセミセルフサービスガソリンスタンド<br className="hidden md:block" />
            確かな品質と安全な配送で、お客様の快適な暮らしをサポートいたします。
          </p>

          <div className="flex flex-col sm:flex-row gap-4 md:gap-6 justify-center animate-fadeIn px-6 md:px-0 max-w-md mx-auto sm:max-w-none" style={{ animationDelay: '0.6s' }}>
            <a href="#prices" className="bg-red-600 hover:bg-red-700 text-white px-8 py-4 md:px-14 md:py-6 rounded-full font-black text-lg md:text-2xl shadow-[0_15px_30px_rgba(220,38,38,0.4)] transition-all transform hover:scale-105 active:scale-95 text-center">
              本日の価格を見る
            </a>
            <a href="#our-service" className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white border-2 border-white/50 px-8 py-4 md:px-14 md:py-6 rounded-full font-black text-lg md:text-2xl shadow-2xl transition-all transform hover:scale-105 active:scale-95 text-center">
              当店のこだわり
            </a>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 w-full h-20 md:h-32 bg-gradient-to-t from-gray-900 to-transparent"></div>
      </section>

      {/* Local Info Bar */}
      <div className="bg-gray-900 py-4 md:py-5 border-y border-white/5 shadow-2xl relative z-20">
        <div className="container mx-auto px-4 flex flex-col md:flex-row flex-wrap items-center justify-center gap-4 md:gap-8 min-w-0">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 md:gap-4">
            <span className="bg-red-600 text-white text-[8px] sm:text-[9px] md:text-[10px] font-black px-2 md:px-3 py-1 rounded tracking-widest shadow-lg shrink-0">REGION AI TIP</span>
            <p className="text-gray-300 text-[11px] sm:text-sm md:text-base font-bold tracking-tight text-center md:text-left leading-snug break-words">{aiTip}</p>
          </div>
          {groundingLinks.length > 0 && (
            <div className="flex flex-wrap justify-center gap-3 md:gap-6">
              {groundingLinks.slice(0, 2).map((link, idx) => (
                <a key={idx} href={link.uri} target="_blank" rel="noopener noreferrer" className="text-[10px] md:text-xs text-red-400 font-black underline hover:text-red-300 flex items-center transition-colors break-all">
                  <span className="mr-1 md:mr-2">📍</span> {link.title}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fuel Price Section */}
      <section id="prices" className="py-16 md:py-24 bg-gray-900 text-white scroll-mt-16 md:scroll-mt-24">
        <div className="container mx-auto px-4 md:px-8">

          {/* News Section */}
          <div className="max-w-4xl mx-auto mb-12 md:mb-16 px-4 animate-fadeIn">
            <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 md:p-10 border border-gray-700 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-red-600"></div>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <span className="bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded tracking-widest uppercase">News</span>
                    <h4 className="text-white text-sm md:text-lg font-black tracking-tighter">お知らせ</h4>
                  </div>
                  {isDataLoading ? (
                    <span className="h-6 w-16 bg-white/10 rounded-full animate-pulse inline-block"></span>
                  ) : (
                    <span className="bg-gray-800 text-gray-400 text-[10px] font-bold px-2 py-1 rounded-full border border-white/5">
                      全 {newsList.length} 件
                    </span>
                  )}
                </div>
              </div>

              {/* 管理モード：新規投稿フォーム */}
              {isAdminMode && (
                <div className="mb-12 p-6 md:p-8 bg-white/5 rounded-2xl border border-red-600/30 shadow-inner">
                  <h5 className="text-red-500 font-black text-xs md:text-sm mb-6 flex items-center">
                    <span className="w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></span>
                    新規お知らせ追加
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 mb-6">
                    <div className="md:col-span-3">
                      <label className="block text-gray-500 text-[10px] font-black uppercase tracking-widest mb-2">日付</label>
                      <input
                        type="date"
                        value={newNewsDate}
                        onChange={(e) => setNewNewsDate(e.target.value)}
                        className="w-full bg-black/40 text-white p-3 rounded-xl border border-white/10 outline-none font-bold focus:border-red-600 transition-colors"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-gray-500 text-[10px] font-black uppercase tracking-widest mb-2">カテゴリ</label>
                      <select
                        value={newNewsCategory}
                        onChange={(e) => setNewNewsCategory(e.target.value as 'important' | 'normal')}
                        className="w-full bg-black/40 text-white p-3 rounded-xl border border-white/10 outline-none font-bold focus:border-red-600 transition-colors appearance-none"
                      >
                        <option value="normal">通常</option>
                        <option value="important">重要</option>
                      </select>
                    </div>
                    <div className="md:col-span-6">
                      <label className="block text-gray-500 text-[10px] font-black uppercase tracking-widest mb-2">内容</label>
                      <textarea
                        value={newNewsContent}
                        onChange={(e) => setNewNewsContent(e.target.value)}
                        placeholder="お知らせ内容を入力..."
                        className="w-full bg-black/40 text-white p-3 rounded-xl border border-white/10 outline-none font-bold min-h-[80px] focus:border-red-600 transition-colors"
                      />
                    </div>
                  </div>
                  <button
                    onClick={addNews}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-xl transition-all active:scale-95 shadow-lg shadow-red-900/20"
                  >
                    リストに追加
                  </button>
                </div>
              )}

              {/* リスト表示 */}
              <ul className="space-y-0">
                {isDataLoading ? (
                  Array.from({ length: 3 }).map((_, idx) => (
                    <li key={`skeleton-${idx}`} className={`py-6 md:py-8 border-b border-white/5 last:border-0 ${idx === 0 ? 'pt-0' : ''}`}>
                      <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-8 animate-pulse">
                        <div className="shrink-0 md:w-48 flex items-center space-x-3">
                          <div className="h-5 bg-white/10 rounded w-24 md:w-32"></div>
                          {idx === 0 && (
                            <div className="h-4 w-10 bg-red-600/20 rounded"></div>
                          )}
                        </div>
                        <div className="flex-1 flex items-start gap-4">
                          <span className="text-white/10 mt-1 md:mt-2 shrink-0">•</span>
                          <div className="flex-1 space-y-2.5 py-1">
                            <div className="h-5 bg-white/10 rounded w-5/6"></div>
                            {idx % 2 === 0 && <div className="h-5 bg-white/10 rounded w-2/3"></div>}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))
                ) : displayNews.length > 0 ? (
                  displayNews.map((item, idx) => (
                    <li key={item.id} className={`group relative py-6 md:py-8 border-b border-white/5 last:border-0 ${idx === 0 ? 'pt-0' : ''}`}>
                      <div className="flex flex-col md:flex-row md:items-start gap-3 md:gap-8">
                        <div className="flex items-center space-x-3 shrink-0 md:w-48">
                          <span className="text-red-500 font-mono font-black text-xs md:text-lg tracking-tighter">
                            {item.date.replace(/-/g, '.')}
                          </span>
                          {item.category === 'important' && (
                            <span className="bg-red-600/20 text-red-500 text-[8px] md:text-[10px] font-black px-2 py-0.5 rounded border border-red-600/30 animate-pulse">重要</span>
                          )}
                        </div>
                        <div className="flex-1 flex items-start gap-4">
                          <span className="text-red-600 mt-1.5 md:mt-2.5 shrink-0">•</span>
                          <p className="text-white text-sm md:text-xl font-bold leading-relaxed whitespace-pre-wrap flex-1 group-hover:text-red-50 transition-colors">
                            {item.content}
                          </p>
                          {isAdminMode && (
                            <button
                              onClick={() => deleteNews(item.id)}
                              className="text-gray-600 hover:text-red-500 text-[10px] font-black uppercase tracking-widest transition-colors py-1 px-2 bg-white/5 rounded hover:bg-white/10"
                            >
                              削除
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))
                ) : (
                  <p className="text-gray-500 italic text-center py-8 font-bold">現在お知らせはありません。</p>
                )}
              </ul>

              {!isDataLoading && newsList.length > 5 && (
                <div className="mt-8 pt-8 border-t border-white/5 text-center">
                  <button
                    onClick={() => setShowAllNews(!showAllNews)}
                    className="inline-flex items-center space-x-2 text-gray-400 hover:text-white font-black text-xs md:text-sm transition-all group"
                  >
                    <span>{showAllNews ? '閉じる' : 'もっと見る'}</span>
                    <svg className={`w-4 h-4 transition-transform duration-300 ${showAllNews ? 'rotate-180' : 'group-hover:translate-y-1'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="text-center mb-12 md:mb-16">
            <h3 className="text-3xl sm:text-5xl md:text-7xl font-black mb-6 md:mb-12 tracking-tighter uppercase italic">Daily Prices</h3>
            <div className="w-16 md:w-24 h-1.5 md:h-2 bg-red-600 mx-auto rounded-full mb-12 md:mb-16"></div>

            {/* LARGE Fire Corps Support Banner */}
            <div className="max-w-6xl mx-auto mb-16 md:mb-20">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-orange-600 to-red-600 rounded-3xl md:rounded-[4rem] blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                <div className="relative inline-flex flex-col items-center bg-white/5 backdrop-blur-2xl px-5 py-8 sm:px-10 sm:py-12 md:px-24 md:py-16 rounded-3xl md:rounded-[4rem] border border-white/10 shadow-2xl overflow-hidden w-full">
                  <div className="absolute top-0 left-0 w-full h-2 md:h-3 bg-gradient-to-r from-orange-500 via-red-600 to-orange-500"></div>

                  <div className="flex flex-col items-center mb-8 md:mb-10 w-full min-w-0">
                    <span className="bg-orange-600 text-white text-base sm:text-lg md:text-4xl font-black px-6 py-2 md:px-10 md:py-4 rounded-full mb-6 md:mb-8 shadow-xl animate-pulse tracking-tighter break-words text-center max-w-full">
                      館山市消防団サポート
                    </span>
                    <h4 className="text-white font-black text-lg sm:text-2xl md:text-6xl tracking-tighter italic leading-tight text-center px-2 break-words">
                      地域を守る皆様を<br />
                      <span className="text-red-500">最大級の割引</span>で強力支援
                    </h4>
                  </div>

                  <div className="flex flex-col items-center justify-center mb-10 md:mb-12 w-full min-w-0">
                    <span className="text-gray-300 text-[11px] sm:text-sm md:text-4xl font-bold mb-4 md:mb-6 uppercase tracking-widest break-words text-center">対象：レギュラー・軽油</span>
                    <div className="flex flex-wrap items-center justify-center bg-black/40 px-4 py-6 sm:px-8 sm:py-8 md:px-12 md:py-10 rounded-2xl md:rounded-[3rem] border border-white/5 w-full md:w-auto overflow-hidden gap-4 md:gap-8">
                      <span className="text-white text-[9px] sm:text-xs md:text-4xl lg:text-5xl font-black italic tracking-tighter leading-snug whitespace-normal break-words text-center">セルフガソリンスタンド価格より</span>
                      <div className="flex items-baseline flex-wrap justify-center">
                        <span className="text-orange-500 text-5xl sm:text-7xl md:text-[10rem] lg:text-[12rem] font-black tracking-tighter drop-shadow-[0_0_30px_rgba(249,115,22,0.5)] leading-none">
                          7
                        </span>
                        <span className="text-orange-500 text-base sm:text-xl md:text-6xl font-black ml-1 md:ml-2 whitespace-nowrap">円引き</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-orange-500/10 rounded-2xl md:rounded-[2rem] p-5 sm:p-6 md:p-8 border border-orange-500/20 max-w-2xl w-full min-w-0">
                    <p className="text-[11px] sm:text-sm md:text-xl text-orange-200 font-black tracking-widest leading-relaxed text-center break-words">
                      ※消防団員カードのご提示をお願いします（現金精算のみ）<br />
                      (有)ヨシノは館山市消防団サポート事業の協力企業です。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 lg:gap-16 max-w-7xl mx-auto">
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

      {/* Service Benefits Section */}
      <section id="our-service" className="py-20 md:py-32 bg-white relative overflow-hidden scroll-mt-16 md:scroll-mt-24">
        <div className="container mx-auto px-4 md:px-8 relative z-10">
          <div className="max-w-5xl mx-auto text-center">
            <span className="text-red-600 font-black text-[10px] md:text-sm uppercase tracking-[0.4em] block mb-4 md:mb-6">Staff on Duty</span>
            <h3 className="text-3xl sm:text-5xl md:text-7xl font-black mb-8 md:mb-10 tracking-tighter leading-tight text-gray-900">
              対面ならではの安心と、<br />心地よいサービス。
            </h3>
            <p className="text-gray-500 text-sm sm:text-lg md:text-2xl font-medium leading-relaxed mb-12 md:mb-20 max-w-3xl mx-auto px-4 md:px-0">
              セルフスタンドが主流の今だからこそ、(有)ヨシノは対面サービスにこだわります。プロのスタッフがあなたに代わって、安全・確実・快適な給油を提供します。
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10 text-left">
              {[
                { title: "雨でも寒くても、車内で待つだけ", desc: "悪天候の日でも、お客様は快適な車内でお待ちいただくだけ。スタッフが迅速に給油します。" },
                { title: "給油の合間に「灰皿」や「ゴミ」も", desc: "ゴミの回収、タイヤ点検など、セルフにはない付加価値を提供します。" },
                { title: "地域貢献への強い想い", desc: "消防団サポートをはじめ、地元の安全を守る活動を積極的に支援。地域のインフラを支えます。" }
              ].map((item, i) => (
                <div key={i} className="flex flex-col space-y-4 p-6 md:p-10 rounded-2xl md:rounded-[3rem] bg-gray-50 border border-gray-100 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group min-w-0">
                  <div className="bg-red-600 text-white w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center shrink-0 font-black text-lg md:text-2xl shadow-lg group-hover:rotate-12 transition-transform">{i+1}</div>
                  <div>
                    <h4 className="font-black text-gray-900 text-lg md:text-2xl mb-2 md:mb-4 leading-tight break-words">{item.title}</h4>
                    <p className="text-xs sm:text-sm md:text-base text-gray-500 leading-relaxed font-bold break-words">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Delivery Section */}
      <section id="delivery" className="py-20 md:py-24 bg-red-600 text-white relative overflow-hidden shadow-[inset_0_0_100px_rgba(0,0,0,0.1)] scroll-mt-16 md:scroll-mt-24">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-red-700/30 skew-x-12 transform translate-x-1/4"></div>
        <div className="container mx-auto px-4 md:px-8 relative z-10">
          <div className="flex flex-col lg:flex-row items-center gap-12 md:gap-20">
            <div className="lg:w-3/5 text-center lg:text-left">
              <div className="inline-block bg-white text-red-600 font-black text-[9px] sm:text-[10px] md:text-[11px] px-4 py-1.5 md:px-5 md:py-2 rounded-full mb-6 md:mb-8 tracking-[0.3em] md:tracking-[0.4em] shadow-xl uppercase">Home Delivery</div>
              <h3 className="text-3xl sm:text-5xl md:text-8xl font-black mb-6 md:mb-10 tracking-tighter leading-tight">
                冬の灯油も、<br />現場の軽油も。
              </h3>
              <p className="text-base sm:text-xl md:text-3xl font-bold mb-8 md:mb-12 text-white/95 leading-relaxed">
                重いポリタンクの運搬、ヨシノにおまかせください。<br />
                ご自宅、店舗、建設現場まで迅速にお届けします。
              </p>
            </div>
            <div className="lg:w-2/5 w-full max-w-lg mx-auto lg:mx-0">
              <div className="bg-white p-8 md:p-12 rounded-3xl md:rounded-[4rem] shadow-2xl text-gray-900 text-center transform hover:scale-[1.02] transition-transform">
                <p className="text-red-600 font-black text-[9px] sm:text-[10px] md:text-sm tracking-[0.2em] md:tracking-[0.3em] mb-6 md:mb-10 uppercase">お電話一本で配送手配</p>

                <div className="space-y-6 md:space-y-10 mb-8 md:mb-12">
                  <div className="flex flex-col items-center group">
                    <span className="text-[10px] md:text-xs text-gray-400 font-black mb-1 md:mb-2 uppercase tracking-widest">館山店</span>
                    <a href="tel:0470226808" className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter text-gray-900 hover:text-red-600 transition-colors leading-none">0470-22-6808</a>
                  </div>
                  <div className="flex flex-col items-center group">
                    <span className="text-[10px] md:text-xs text-gray-400 font-black mb-1 md:mb-2 uppercase tracking-widest">三芳店</span>
                    <a href="tel:0470363466" className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter text-gray-900 hover:text-red-600 transition-colors leading-none">0470-36-3466</a>
                  </div>
                </div>

                <div className="space-y-4 md:space-y-6 mb-8 md:mb-10 text-left border-t border-gray-100 pt-8">
                  <div className="flex items-center justify-between text-xs sm:text-sm md:text-base border-b border-gray-100 pb-2 md:pb-3">
                    <span className="text-gray-400 font-bold shrink-0 mr-4">配送エリア</span>
                    <span className="font-black text-right leading-tight">館山市内・南房総市内・鋸南町<br /><span className="text-[10px] md:text-xs font-medium text-gray-500 italic">（その他市町村もご要望に応じて相談可）</span></span>
                  </div>
                  <div className="flex items-center justify-between text-xs sm:text-sm md:text-base border-b border-gray-100 pb-2 md:pb-3">
                    <span className="text-gray-400 font-bold">最小配送量</span>
                    <span className="font-black">ポリタンク２缶（36L）〜</span>
                  </div>
                  <div className="flex flex-col border-b border-gray-100 pb-2 md:pb-3">
                    <span className="text-gray-400 font-bold text-xs sm:text-sm md:text-base mb-2">配送時のお支払い方法</span>
                    <div className="flex gap-2">
                       <span className="bg-gray-100 px-3 py-1 rounded-full text-[10px] md:text-xs font-black">現金</span>
                       <span className="bg-gray-100 px-3 py-1 rounded-full text-[10px] md:text-xs font-black text-[#00a6ed]">PayPay</span>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 font-bold text-center italic">※配送状況によりお時間をいただく場合がございます。</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Access Section */}
      <section id="stores" className="py-20 md:py-32 bg-white scroll-mt-16 md:scroll-mt-24">
        <div className="container mx-auto px-4 md:px-8">
          <div className="max-w-5xl mx-auto text-center mb-16 md:mb-24">
            <h3 className="text-3xl sm:text-5xl md:text-7xl font-black mb-6 md:mb-8 tracking-tighter text-gray-900 uppercase italic">Our Locations</h3>
            <p className="text-gray-500 mb-10 md:mb-16 font-bold text-sm sm:text-base md:text-lg tracking-wide max-w-2xl mx-auto leading-relaxed px-4">館山市、南房総市で皆様のカーライフをサポート。</p>

            <div className="relative max-w-2xl mx-auto px-2 md:px-0">
              <div className="absolute inset-y-0 left-0 pl-6 md:pl-8 flex items-center pointer-events-none">
                <svg className="h-5 w-5 md:h-8 md:w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="店名やエリアで検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-14 md:pl-20 pr-6 py-4 md:py-7 border-2 md:border-4 border-gray-100 rounded-2xl md:rounded-[3rem] bg-gray-50 focus:border-red-600 focus:bg-white transition-all outline-none text-base sm:text-lg md:text-2xl shadow-xl font-black placeholder-gray-300"
              />
            </div>
          </div>

          {filteredStores.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 lg:gap-16 max-w-[1400px] mx-auto">
              {filteredStores.map(store => (
                <div key={store.id} className="bg-white rounded-3xl md:rounded-[4rem] overflow-hidden shadow-xl md:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] flex flex-col border border-gray-100 transition-all duration-500 animate-fadeIn group">
                  <div className="p-6 sm:p-10 md:p-16 flex flex-col">
                    <div className="flex items-center justify-between mb-6 md:mb-8">
                      <span className="bg-red-600 text-white text-[9px] md:text-[11px] font-black px-3 py-1.5 md:px-5 md:py-2 rounded-full uppercase tracking-widest shadow-lg">
                        SEMI-SELF
                      </span>
                      <a href={`tel:${store.tel.replace(/-/g, '')}`} className="text-red-600 font-black text-sm md:text-xl hover:underline">{store.tel}</a>
                    </div>
                    <h4 className="text-xl sm:text-3xl md:text-5xl font-black mb-6 md:mb-8 group-hover:text-red-600 transition-colors tracking-tighter leading-none">ヨシノ {store.name}</h4>
                    <ul className="space-y-4 md:space-y-8 text-gray-600 text-xs sm:text-sm md:text-lg font-bold">
                      {store.description && (
                        <li className="flex items-start font-black text-red-600 bg-red-50 p-4 md:p-6 rounded-2xl border border-red-100/50 shadow-sm">
                          <svg className="w-4 h-4 md:w-7 md:h-7 text-red-600 mt-0.5 md:mt-1 mr-3 md:mr-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          <span>{store.description}</span>
                        </li>
                      )}
                      <li className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1 md:px-2 py-2 w-full min-w-0">
                        <div className="flex items-start min-w-0 flex-1 break-words">
                          <svg className="w-4 h-4 md:w-6 md:h-6 text-red-600 mt-0.5 md:mt-1 mr-3 md:mr-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                          <span className="leading-snug break-words whitespace-normal">{store.address}</span>
                        </div>
                        <a
                          href={store.externalMapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1.5 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 font-black text-[10px] md:text-sm px-4 py-2.5 rounded-xl transition-all border border-red-200/50 hover:border-red-300 relative self-start sm:self-auto shrink-0 md:ml-5 shadow-sm active:scale-95 whitespace-nowrap"
                        >
                          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                          </svg>
                          <span>Googleマップを開く</span>
                        </a>
                      </li>
                      <li className="flex items-start px-1 md:px-2">
                        <svg className="w-4 h-4 md:w-6 md:h-6 text-red-600 mt-0.5 md:mt-1 mr-3 md:mr-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <p className="leading-snug">{store.hours}</p>
                      </li>
                      <li className="flex flex-col px-1 md:px-2 border-t border-gray-100 pt-6">
                        <span className="text-[10px] md:text-xs text-gray-400 font-black mb-3 uppercase tracking-widest">店頭でのお支払い方法</span>
                        <div className="flex flex-wrap gap-2 md:gap-3">
                          <span className="bg-gray-900 text-white px-3 py-1 md:px-4 md:py-1.5 rounded-full text-[10px] md:text-xs font-black shadow-sm">現金</span>
                          <span className="bg-[#00a6ed] text-white px-3 py-1 md:px-4 md:py-1.5 rounded-full text-[10px] md:text-xs font-black shadow-sm">PayPay</span>
                          <div className="flex items-center bg-gray-100 px-3 py-1 md:px-4 md:py-1.5 rounded-full shadow-sm">
                             <svg className="w-3 h-3 md:w-4 md:h-4 text-gray-600 mr-1.5" fill="currentColor" viewBox="0 0 24 24"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/></svg>
                             <span className="text-gray-900 text-[10px] md:text-xs font-black">クレジットカード</span>
                          </div>
                        </div>
                      </li>
                    </ul>
                    <a
                      href={store.externalMapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.address)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-8 md:mt-16 flex items-center justify-center space-x-3 w-full bg-gray-900 text-white hover:bg-red-600 font-black py-4 md:py-7 rounded-2xl md:rounded-[2.5rem] transition-all shadow-xl active:scale-95 text-base md:text-xl"
                    >
                      <svg className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                      <span>地図アプリで見る</span>
                    </a>
                  </div>
                  {/* Googleマップ埋め込み */}
                  <div className="w-full aspect-video my-4 rounded-lg overflow-hidden shadow-md">
                    <iframe
                      title={`${store.name} Map`}
                      src={store.mapUrl}
                      className="w-full h-full border-0 grayscale hover:grayscale-0 transition-all duration-[2s]"
                      allowFullScreen={true}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    ></iframe>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 md:py-40 bg-gray-50 rounded-[2rem] md:rounded-[5rem] border-4 md:border-8 border-dashed border-gray-100 animate-fadeIn mx-4 md:mx-0">
              <h4 className="text-lg sm:text-2xl md:text-4xl font-black text-gray-300 mb-6 md:mb-8 tracking-tighter">店舗が見つかりませんでした</h4>
              <button
                onClick={() => setSearchQuery('')}
                className="bg-red-600 text-white px-8 py-3.5 md:px-16 md:py-6 rounded-full font-black text-sm md:text-xl transition-all shadow-xl hover:bg-red-700 active:scale-95"
              >
                検索条件をリセット
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16 md:py-32 mt-auto relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1.5 md:h-2 bg-gradient-to-r from-red-600 to-orange-500"></div>
        <div className="container mx-auto px-4 md:px-8 text-center md:text-left relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start gap-12 md:gap-20 border-b border-white/5 pb-16 md:pb-24 mb-12 md:mb-20">
            <div className="max-w-xl w-full">
              <div className="flex items-center justify-center md:justify-start space-x-4 md:space-x-6 mb-8 md:mb-12">
                <div className="bg-red-600 text-white w-12 h-12 md:w-16 md:h-16 flex items-center justify-center font-black rounded-xl md:rounded-2xl text-2xl md:text-4xl shadow-xl transform -rotate-3">Y</div>
                <span className="text-xl sm:text-2xl md:text-5xl font-black tracking-tighter">有限会社 ヨシノ</span>
              </div>
              <div className="space-y-6 md:space-y-8 font-bold text-gray-400 text-sm sm:text-base md:text-lg">
                <div className="flex items-start justify-center md:justify-start">
                  <span className="bg-white/5 p-2 md:p-3 rounded-xl md:rounded-2xl mr-4 md:mr-6 mt-0.5 text-center shadow-inner shrink-0">📍</span>
                  <span className="text-left">〒294-0045 千葉県館山市北条1017<br /><span className="text-[10px] md:text-xs text-gray-500 font-medium uppercase tracking-widest mt-1 md:mt-2 block">Tateyama Branch</span></span>
                </div>
                <div className="flex items-center justify-center md:justify-start">
                  <span className="bg-white/5 p-2 md:p-3 rounded-xl md:rounded-2xl mr-4 md:mr-6 text-center shadow-inner shrink-0">📞</span>
                  <span className="text-2xl sm:text-3xl md:text-4xl text-white font-black tracking-tighter leading-none">0470-22-6808</span>
                </div>

                {/* Official LINE Button */}
                <div className="flex flex-col items-center md:items-start pt-4">
                  <a
                    href="https://lin.ee/oE5U1Qv"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-[#06C755] hover:bg-[#05b34c] text-white px-6 py-3 md:px-8 md:py-4 rounded-xl md:rounded-2xl font-black flex items-center shadow-lg transition-all active:scale-95 group mb-3"
                  >
                    <svg className="w-6 h-6 md:w-8 md:h-8 mr-3 md:mr-4 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 10.304c0-5.369-5.383-9.738-12-9.738-6.616 0-12 4.369-12 9.738 0 4.814 4.269 8.846 10.036 9.608.391.084.922.258 1.057.592.121.303.079.778.039 1.085l-.171 1.027c-.053.303-.242 1.185 1.039.646 1.281-.539 6.905-4.066 9.408-6.958 1.838-2.122 2.592-4.041 2.592-6.2z"/>
                    </svg>
                    <span className="text-sm md:text-xl">公式LINE 友だち追加</span>
                  </a>
                  <p className="text-[10px] md:text-xs font-bold text-gray-400 tracking-wider">
                    公式LINEからでもお問い合わせ可能です
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-gray-600 text-[8px] sm:text-[9px] md:text-[10px] font-black tracking-[0.4em] md:tracking-[0.6em] uppercase text-center md:text-left">
            <span>&copy; {new Date().getFullYear()} YOSHINO CO., LTD. ALL RIGHTS RESERVED.</span>
            <div className="flex items-center space-x-6">
              <a href="#" className="hover:text-red-600 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-red-600 transition-colors">Corporate Site</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Save Toast */}
      {saveToast && (
        <div className="fixed bottom-6 right-6 z-[200] bg-gray-900 text-white text-sm font-black px-6 py-3 rounded-2xl shadow-2xl flex items-center space-x-2 animate-fadeIn border border-white/10">
          <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
          </svg>
          <span>保存しました</span>
        </div>
      )}

      {/* Admin Confirmation Modal with Password */}
      {showAdminConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-white rounded-3xl md:rounded-[4rem] shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 transition-all">
            <div className="bg-red-600 p-8 md:p-12 text-white text-center">
              <div className="w-16 h-16 md:w-24 md:h-24 bg-white/20 rounded-2xl md:rounded-[2rem] flex items-center justify-center mx-auto mb-6 md:mb-8 shadow-xl">
                <svg className="w-8 h-8 md:w-12 md:h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-2xl md:text-4xl font-black tracking-tighter">管理モード認証</h3>
            </div>
            <div className="p-8 md:p-12 text-center">
              <p className="text-gray-600 text-sm md:text-lg font-bold mb-6 md:mb-8 leading-relaxed px-2">
                {isAdminMode
                  ? "管理モードを終了し、通常表示に戻ります。編集内容は保存されます。"
                  : "管理モードを有効にするには、アクセスコードを入力してください。"}
              </p>

              {!isAdminMode && (
                <div className="mb-6 md:mb-8">
                  <input
                    type="password"
                    placeholder="アクセスコード"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && tryEnterAdminMode()}
                    className={`block w-full text-center py-4 md:py-5 border-2 md:border-4 rounded-2xl md:rounded-3xl text-xl md:text-2xl font-black outline-none transition-all ${
                      passError ? 'border-red-500 bg-red-50 animate-bounce' : 'border-gray-100 bg-gray-50 focus:border-red-600 focus:bg-white'
                    }`}
                  />
                  {passError && <p className="text-red-600 font-bold mt-2 text-xs md:text-sm">コードが正しくありません</p>}
                </div>
              )}

              <div className="flex flex-col gap-3 md:gap-4">
                <button
                  onClick={tryEnterAdminMode}
                  className="bg-red-600 hover:bg-red-700 text-white font-black py-5 md:py-7 rounded-2xl md:rounded-[2rem] transition-all shadow-xl active:scale-95 text-lg md:text-2xl"
                >
                  {isAdminMode ? "管理モードを終了" : "認証して進む"}
                </button>
                <button
                  onClick={() => {
                    setShowAdminConfirm(false);
                    setAdminPassword('');
                  }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-500 font-black py-5 md:py-7 rounded-2xl md:rounded-[2rem] transition-all active:scale-95 text-base md:text-xl"
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
