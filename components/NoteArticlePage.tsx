import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { NoteArticle, ArticleCategory } from '../types';

interface NoteArticlePageProps {
  onBack: () => void;
}

const CATEGORY_LABELS: Record<ArticleCategory, { label: string; color: string }> = {
  service: { label: 'サービス紹介', color: 'bg-blue-600' },
  price: { label: '価格情報', color: 'bg-orange-600' },
  seasonal: { label: '季節のヒント', color: 'bg-green-600' },
  local: { label: '地域情報', color: 'bg-purple-600' },
  campaign: { label: 'キャンペーン', color: 'bg-red-600' },
};

const CATEGORY_PROMPTS: Record<ArticleCategory, string> = {
  service: '千葉県館山市・南房総市のフルサービスガソリンスタンド「(有)ヨシノ」のサービス内容（給油、窓拭き、タイヤ点検など）を紹介するnote記事を書いてください。',
  price: '(有)ヨシノのガソリン価格情報と、館山市消防団員への7円割引サービスを紹介するnote記事を書いてください。',
  seasonal: '季節に応じた自動車メンテナンスのヒントを、千葉県館山・南房総エリアのドライバー向けにnote記事として書いてください。',
  local: '千葉県館山市・南房総市の地域情報や観光スポット、ドライブコースを紹介するnote記事を書いてください。(有)ヨシノの店舗情報も自然に織り交ぜてください。',
  campaign: '(有)ヨシノのキャンペーン・お得情報を紹介するnote記事を書いてください。フルサービスの魅力や灯油・軽油の配達サービスも触れてください。',
};

const SUGGESTED_TAGS: Record<ArticleCategory, string[]> = {
  service: ['フルサービス', 'ガソリンスタンド', '館山市', '南房総市', '車検'],
  price: ['ガソリン価格', 'レギュラー', '軽油', '消防団割引', '館山'],
  seasonal: ['車のメンテナンス', '夏タイヤ', '冬タイヤ', 'タイヤ交換', '燃費'],
  local: ['館山市', '南房総市', 'ドライブ', '千葉', 'おでかけ'],
  campaign: ['キャンペーン', '割引', '灯油配達', 'お得情報', '南房総'],
};

const EMPTY_ARTICLE: Omit<NoteArticle, 'id' | 'createdAt' | 'updatedAt'> = {
  title: '',
  content: '',
  tags: [],
  status: 'draft',
  category: 'service',
};

const NoteArticlePage: React.FC<NoteArticlePageProps> = ({ onBack }) => {
  const [articles, setArticles] = useState<NoteArticle[]>(() => {
    const saved = localStorage.getItem('yoshino_note_articles');
    return saved ? JSON.parse(saved) : [];
  });
  const [showEditor, setShowEditor] = useState(false);
  const [editingArticle, setEditingArticle] = useState<NoteArticle | null>(null);
  const [form, setForm] = useState(EMPTY_ARTICLE);
  const [tagInput, setTagInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'published'>('all');

  useEffect(() => {
    localStorage.setItem('yoshino_note_articles', JSON.stringify(articles));
  }, [articles]);

  const openNew = () => {
    setForm(EMPTY_ARTICLE);
    setTagInput('');
    setEditingArticle(null);
    setShowEditor(true);
  };

  const openEdit = (article: NoteArticle) => {
    setForm({
      title: article.title,
      content: article.content,
      tags: article.tags,
      status: article.status,
      category: article.category,
    });
    setTagInput('');
    setEditingArticle(article);
    setShowEditor(true);
  };

  const closeEditor = () => {
    setShowEditor(false);
    setEditingArticle(null);
    setForm(EMPTY_ARTICLE);
    setTagInput('');
  };

  const saveArticle = () => {
    if (!form.title.trim()) return;
    const now = new Date().toISOString();
    if (editingArticle) {
      setArticles(prev =>
        prev.map(a =>
          a.id === editingArticle.id
            ? { ...editingArticle, ...form, updatedAt: now }
            : a
        )
      );
    } else {
      const newArticle: NoteArticle = {
        ...form,
        id: `article_${Date.now()}`,
        createdAt: now,
        updatedAt: now,
      };
      setArticles(prev => [newArticle, ...prev]);
    }
    closeEditor();
  };

  const deleteArticle = (id: string) => {
    setArticles(prev => prev.filter(a => a.id !== id));
    setDeleteConfirmId(null);
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !form.tags.includes(tag)) {
      setForm(prev => ({ ...prev, tags: [...prev.tags, tag] }));
    }
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    setForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  const addSuggestedTag = (tag: string) => {
    if (!form.tags.includes(tag)) {
      setForm(prev => ({ ...prev, tags: [...prev.tags, tag] }));
    }
  };

  const generateWithAI = async () => {
    setIsGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = form.title
        ? `以下のタイトルでnote記事を書いてください。\nタイトル：「${form.title}」\n\n${CATEGORY_PROMPTS[form.category]}\n\n記事の長さは800〜1200文字程度にしてください。見出しや箇条書きを使って読みやすくしてください。`
        : `${CATEGORY_PROMPTS[form.category]}\n\n記事の長さは800〜1200文字程度にしてください。見出しや箇条書きを使って読みやすくしてください。タイトルも提案してください。`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      });
      const text = response.text || '';

      if (!form.title) {
        const titleMatch = text.match(/^#\s+(.+)$/m) || text.match(/タイトル[：:]\s*「?(.+?)」?$/m);
        if (titleMatch) {
          setForm(prev => ({ ...prev, title: titleMatch[1].trim(), content: text }));
        } else {
          setForm(prev => ({ ...prev, content: text }));
        }
      } else {
        setForm(prev => ({ ...prev, content: text }));
      }
    } catch {
      setForm(prev => ({
        ...prev,
        content: prev.content + '\n\n（AI生成に失敗しました。手動で入力してください。）',
      }));
    } finally {
      setIsGenerating(false);
    }
  };

  const copyForNote = async (article: NoteArticle) => {
    const text = `# ${article.title}\n\n${article.content}\n\n---\n${article.tags.map(t => `#${t}`).join(' ')}`;
    await navigator.clipboard.writeText(text);
    setCopiedId(article.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredArticles = articles.filter(a =>
    filterStatus === 'all' ? true : a.status === filterStatus
  );

  const draftCount = articles.filter(a => a.status === 'draft').length;
  const publishedCount = articles.filter(a => a.status === 'published').length;

  return (
    <div className="min-h-screen bg-gray-50 font-['Noto_Sans_JP']">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="flex items-center space-x-2 text-gray-500 hover:text-red-600 transition-colors font-black text-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
              </svg>
              <span>戻る</span>
            </button>
            <div className="w-px h-6 bg-gray-200" />
            <div className="flex items-center space-x-2">
              <div className="bg-red-600 text-white w-8 h-8 rounded-lg flex items-center justify-center font-black text-base shadow">N</div>
              <h1 className="font-black text-gray-900 text-lg tracking-tight">note記事管理</h1>
            </div>
          </div>
          <button
            onClick={openNew}
            className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-full font-black text-sm shadow-lg transition-all active:scale-95"
          >
            + 新規作成
          </button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: '全記事', count: articles.length, filter: 'all' as const, color: 'text-gray-900' },
            { label: '下書き', count: draftCount, filter: 'draft' as const, color: 'text-orange-600' },
            { label: '公開済み', count: publishedCount, filter: 'published' as const, color: 'text-green-600' },
          ].map(({ label, count, filter, color }) => (
            <button
              key={filter}
              onClick={() => setFilterStatus(filter)}
              className={`bg-white rounded-2xl p-5 shadow-sm border-2 text-center transition-all ${
                filterStatus === filter ? 'border-red-600 shadow-md' : 'border-transparent hover:border-gray-200'
              }`}
            >
              <p className={`text-3xl font-black ${color}`}>{count}</p>
              <p className="text-gray-500 text-sm font-bold mt-1">{label}</p>
            </button>
          ))}
        </div>

        {/* Article List */}
        {filteredArticles.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-gray-200">
            <div className="text-6xl mb-6">📝</div>
            <h3 className="text-2xl font-black text-gray-300 mb-4">記事がありません</h3>
            <button
              onClick={openNew}
              className="bg-red-600 text-white px-8 py-3 rounded-full font-black text-sm shadow-lg hover:bg-red-700 transition-all active:scale-95"
            >
              最初の記事を作成
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredArticles.map(article => (
              <div
                key={article.id}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`${CATEGORY_LABELS[article.category].color} text-white text-[10px] font-black px-2.5 py-0.5 rounded-full`}>
                        {CATEGORY_LABELS[article.category].label}
                      </span>
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                        article.status === 'published'
                          ? 'border-green-200 text-green-700 bg-green-50'
                          : 'border-orange-200 text-orange-700 bg-orange-50'
                      }`}>
                        {article.status === 'published' ? '公開済み' : '下書き'}
                      </span>
                    </div>
                    <h3 className="font-black text-gray-900 text-lg leading-tight mb-2 truncate">
                      {article.title || '（タイトルなし）'}
                    </h3>
                    <p className="text-gray-400 text-sm font-medium line-clamp-2 mb-3">
                      {article.content.replace(/[#*`]/g, '').substring(0, 100)}...
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {article.tags.slice(0, 5).map(tag => (
                        <span key={tag} className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded font-bold">
                          #{tag}
                        </span>
                      ))}
                      <span className="text-[11px] text-gray-400 font-medium ml-auto">
                        {new Date(article.updatedAt).toLocaleDateString('ja-JP')}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => openEdit(article)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-black text-xs transition-all"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => copyForNote(article)}
                      className={`px-4 py-2 rounded-xl font-black text-xs transition-all ${
                        copiedId === article.id
                          ? 'bg-green-100 text-green-700'
                          : 'bg-blue-50 hover:bg-blue-100 text-blue-700'
                      }`}
                    >
                      {copiedId === article.id ? 'コピー済！' : 'コピー'}
                    </button>
                    {deleteConfirmId === article.id ? (
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => deleteArticle(article.id)}
                          className="px-4 py-1.5 bg-red-600 text-white rounded-xl font-black text-xs"
                        >
                          削除確認
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-4 py-1.5 bg-gray-100 text-gray-500 rounded-xl font-black text-xs"
                        >
                          キャンセル
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirmId(article.id)}
                        className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-black text-xs transition-all"
                      >
                        削除
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl my-8">
            {/* Modal Header */}
            <div className="bg-red-600 p-6 rounded-t-3xl flex items-center justify-between">
              <h2 className="text-white font-black text-xl tracking-tight">
                {editingArticle ? '記事を編集' : '新しい記事を作成'}
              </h2>
              <button onClick={closeEditor} className="text-white/70 hover:text-white transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Category + Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">カテゴリ</label>
                  <select
                    value={form.category}
                    onChange={e => setForm(prev => ({ ...prev, category: e.target.value as ArticleCategory }))}
                    className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 font-bold text-sm bg-gray-50 focus:border-red-600 focus:bg-white outline-none transition-all"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([val, { label }]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">ステータス</label>
                  <div className="flex rounded-2xl border-2 border-gray-100 overflow-hidden">
                    {(['draft', 'published'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => setForm(prev => ({ ...prev, status: s }))}
                        className={`flex-1 py-3 font-black text-sm transition-all ${
                          form.status === s
                            ? s === 'published' ? 'bg-green-600 text-white' : 'bg-orange-500 text-white'
                            : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                        }`}
                      >
                        {s === 'draft' ? '下書き' : '公開済み'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">タイトル</label>
                <input
                  type="text"
                  placeholder="記事タイトルを入力..."
                  value={form.title}
                  onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 font-bold text-base bg-gray-50 focus:border-red-600 focus:bg-white outline-none transition-all"
                />
              </div>

              {/* AI Generation */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-black text-gray-500 uppercase tracking-widest">AI記事生成</p>
                  <button
                    onClick={generateWithAI}
                    disabled={isGenerating}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-full font-black text-xs transition-all ${
                      isGenerating
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-red-600 hover:bg-red-700 text-white shadow-lg active:scale-95'
                    }`}
                  >
                    {isGenerating ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span>生成中...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>Gemini AIで生成</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-400 font-medium">
                  カテゴリとタイトルを元に、Gemini AIが記事本文を自動生成します。
                </p>
              </div>

              {/* Content */}
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">本文</label>
                <textarea
                  placeholder="記事の本文をここに入力...（マークダウン記法対応）"
                  value={form.content}
                  onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))}
                  rows={12}
                  className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 font-medium text-sm bg-gray-50 focus:border-red-600 focus:bg-white outline-none transition-all resize-none leading-relaxed"
                />
                <p className="text-xs text-gray-400 font-medium mt-1 text-right">
                  {form.content.length}文字
                </p>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">タグ</label>
                <div className="flex gap-2 mb-3 flex-wrap">
                  {form.tags.map(tag => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-bold"
                    >
                      #{tag}
                      <button onClick={() => removeTag(tag)} className="text-gray-400 hover:text-red-600 transition-colors ml-1">×</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="タグを追加..."
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    className="flex-1 border-2 border-gray-100 rounded-2xl px-4 py-2.5 font-medium text-sm bg-gray-50 focus:border-red-600 focus:bg-white outline-none transition-all"
                  />
                  <button
                    onClick={addTag}
                    className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-2xl font-black text-sm transition-all"
                  >
                    追加
                  </button>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  <span className="text-xs text-gray-400 font-bold self-center">候補：</span>
                  {SUGGESTED_TAGS[form.category].map(tag => (
                    <button
                      key={tag}
                      onClick={() => addSuggestedTag(tag)}
                      disabled={form.tags.includes(tag)}
                      className={`text-xs px-2.5 py-1 rounded-full font-bold transition-all ${
                        form.tags.includes(tag)
                          ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                          : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                      }`}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={saveArticle}
                  disabled={!form.title.trim()}
                  className={`flex-1 py-4 rounded-2xl font-black text-base transition-all shadow-lg active:scale-95 ${
                    form.title.trim()
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  {editingArticle ? '変更を保存' : '記事を作成'}
                </button>
                <button
                  onClick={closeEditor}
                  className="px-8 py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-2xl font-black text-base transition-all"
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

export default NoteArticlePage;
