
import React, { useState } from 'react';

const InstagramReelSearch: React.FC = () => {
  const defaultDate = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  };

  const [keyword, setKeyword] = useState('');
  const [afterDate, setAfterDate] = useState(defaultDate());
  const [copied, setCopied] = useState(false);

  const buildQuery = () =>
    `site:www.instagram.com/reel/ ${keyword.trim()} after:${afterDate}`;

  const handleSearch = () => {
    if (!keyword.trim()) return;
    const url = `https://www.google.com/search?q=${encodeURIComponent(buildQuery())}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopy = async () => {
    if (!keyword.trim()) return;
    await navigator.clipboard.writeText(buildQuery());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="py-24 bg-gray-950 text-white">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="text-center mb-14">
          <span className="text-red-500 font-black text-xs uppercase tracking-[0.4em] block mb-4">Instagram Reel Search</span>
          <h3 className="text-4xl md:text-6xl font-black tracking-tighter mb-6">
            Reel を絞り込み検索
          </h3>
          <p className="text-gray-400 text-lg font-bold leading-relaxed">
            キーワードと日付を指定して、Google で Instagram Reel を絞り込みます。
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-[3rem] p-10 space-y-8 shadow-2xl">
          {/* Keyword input */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-3">
              ジャンル / キーワード
            </label>
            <input
              type="text"
              placeholder="例: ガソリンスタンド 館山"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full bg-black/40 border-2 border-white/10 focus:border-red-500 outline-none rounded-2xl px-6 py-5 text-xl font-bold text-white placeholder-gray-600 transition-all"
            />
          </div>

          {/* Date input */}
          <div>
            <label className="block text-xs font-black uppercase tracking-widest text-gray-400 mb-3">
              この日以降 (after:)
            </label>
            <input
              type="date"
              value={afterDate}
              onChange={(e) => setAfterDate(e.target.value)}
              className="w-full bg-black/40 border-2 border-white/10 focus:border-red-500 outline-none rounded-2xl px-6 py-5 text-xl font-bold text-white transition-all [color-scheme:dark]"
            />
          </div>

          {/* Generated query preview */}
          {keyword.trim() && (
            <div className="bg-black/60 border border-white/5 rounded-2xl px-6 py-4">
              <p className="text-[11px] font-black uppercase tracking-widest text-gray-500 mb-2">検索クエリ</p>
              <code className="text-green-400 text-sm font-mono break-all leading-relaxed">
                {buildQuery()}
              </code>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleSearch}
              disabled={!keyword.trim()}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-black py-5 rounded-2xl text-lg transition-all active:scale-95 shadow-xl"
            >
              Google で検索を開く
            </button>
            <button
              onClick={handleCopy}
              disabled={!keyword.trim()}
              className="flex-1 bg-white/10 hover:bg-white/20 disabled:bg-gray-800 disabled:cursor-not-allowed text-white font-black py-5 rounded-2xl text-lg transition-all active:scale-95"
            >
              {copied ? 'コピーしました ✓' : 'クエリをコピー'}
            </button>
          </div>
        </div>

        <p className="text-center text-gray-600 text-xs font-bold mt-8 tracking-wide">
          Google の site: 演算子と after: フィルタを使って Instagram Reel を日付絞り込みで検索します。
        </p>
      </div>
    </section>
  );
};

export default InstagramReelSearch;
