/**
 * pages/dictionary/index.tsx v2
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import Navbar from '../../components/layout/Navbar'
import DictionaryCard from '../../components/dictionary/DictionaryCard'
import { dictionaryApi, type DictionaryEntry } from '../../lib/api'

const RECENT_KEY = 'dict_recent'
const MAX_RECENT = 10
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'
const SAMPLE_WORDS = ['你好', '谢谢', '学习', '意思', '打', '朋友', '工作', '今天', '喜欢', '中文']

function getRecent(): string[] {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') } catch { return [] }
}
function addRecent(word: string) {
    const arr = [word, ...getRecent().filter(w => w !== word)].slice(0, MAX_RECENT)
    localStorage.setItem(RECENT_KEY, JSON.stringify(arr))
}

export default function DictionaryPage() {
    const router = useRouter()
    const [query, setQuery] = useState('')
    const [entry, setEntry] = useState<DictionaryEntry | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [recent, setRecent] = useState<string[]>([])

    const doSearch = useCallback(async (word: string) => {
        const w = word.trim()
        if (!w) return
        setLoading(true); setError(null); setEntry(null)
        try {
            const result = await dictionaryApi.lookup(w)
            setEntry(result)
            addRecent(w)
            setRecent(getRecent())
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Có lỗi xảy ra.')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        setRecent(getRecent())
    }, [])

    useEffect(() => {
        const q = router.query.q as string | undefined
        if (q) {
            setQuery(q)
            doSearch(q)
        }
    }, [router.query.q, doSearch])

    const handleKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter') doSearch(query) }

    const meanings = entry?.meanings_vi?.length
        ? entry.meanings_vi
        : entry?.meaning_vi ? [entry.meaning_vi] : []

    return (
        <>
            <Head><title>Từ điển tiếng Trung — 學中文</title></Head>
            <div className="min-h-screen flex flex-col">
                <Navbar />
                <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-10">

                    <div className="mb-8">
                        <h1 className="font-serif text-3xl font-bold text-snow mb-1">📖 Từ điển tiếng Trung</h1>
                        <p className="text-ghost text-sm">CC-CEDICT · 120,000+ từ · Đa nghĩa · Pinyin · Phát âm</p>
                    </div>

                    {/* Search */}
                    <div className="flex gap-3 mb-6">
                        <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ghost pointer-events-none">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                            </span>
                            <input
                                type="text" autoFocus
                                placeholder="Nhập từ tiếng Trung... (ví dụ: 学习)"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={handleKey}
                                className="url-input"
                                style={{ paddingLeft: '2.5rem' }}
                            />
                        </div>
                        <button onClick={() => doSearch(query)} disabled={loading || !query.trim()} className="btn-primary px-5 flex-shrink-0">
                            {loading
                                ? <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                                    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                                </svg>
                                : 'Tra'
                            }
                        </button>
                    </div>

                    {/* Recent */}
                    {!entry && !loading && recent.length > 0 && (
                        <div className="mb-5">
                            <p className="text-[11px] text-ghost uppercase tracking-wider mb-2">Tra gần đây</p>
                            <div className="flex flex-wrap gap-2">
                                {recent.map(w => (
                                    <button key={w} onClick={() => { setQuery(w); doSearch(w) }}
                                        className="font-serif text-base px-3 py-1.5 glass rounded-lg hover:bg-amber-glow/10 hover:text-amber-glow transition-colors text-snow">
                                        {w}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Sample */}
                    {!entry && !loading && (
                        <div className="mb-6">
                            <p className="text-[11px] text-ghost uppercase tracking-wider mb-2">Thử tra</p>
                            <div className="flex flex-wrap gap-2">
                                {SAMPLE_WORDS.map(w => (
                                    <button key={w} onClick={() => { setQuery(w); doSearch(w) }}
                                        className="font-serif text-sm px-3 py-1.5 bg-white/4 hover:bg-white/8 rounded-lg text-mist hover:text-snow transition-colors">
                                        {w}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="glass rounded-xl px-4 py-3 border border-red-500/20 text-red-400 text-sm animate-fade-in">
                            {error}
                        </div>
                    )}

                    {loading && (
                        <div className="glass rounded-2xl p-6 space-y-4 animate-pulse">
                            <div className="flex justify-between items-start">
                                <div className="space-y-2">
                                    <div className="skeleton h-12 w-28 rounded" />
                                    <div className="skeleton h-4 w-20 rounded" />
                                </div>
                                <div className="skeleton w-12 h-12 rounded-xl" />
                            </div>
                            <div className="skeleton h-px w-full rounded" />
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="flex gap-3">
                                    <div className="skeleton w-5 h-5 rounded-full flex-shrink-0" />
                                    <div className="skeleton h-5 rounded flex-1" />
                                </div>
                            ))}
                        </div>
                    )}

                    {entry && !loading && <DictionaryCard entry={entry} backendUrl={BACKEND_URL} />}

                </main>
            </div>
        </>
    )
}