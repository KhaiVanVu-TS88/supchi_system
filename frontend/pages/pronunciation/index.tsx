/**
 * pages/pronunciation/index.tsx
 *
 * Trang luyện phát âm tiếng Trung độc lập.
 *
 * Luồng:
 * 1) Nhập chữ Hán (và pinyin tương ứng) vào ô input
 * 2) Nhấn nút 🎤 để ghi âm giọng nói realtime
 * 3) Nhấn "Kiểm tra phát âm" → gửi lên backend
 * 4) Hiển thị kết quả: điểm tổng, feedback tone từng âm tiết, gợi ý cải thiện
 *
 * Cùng bậc với /ocr, /dictionary
 */
import React, { useState, useCallback } from 'react'
import Head from 'next/head'
import dynamic from 'next/dynamic'
import Navbar from '../../components/layout/Navbar'
import VoiceRecorder from '../../components/pronunciation/VoiceRecorder'
import { pronunciationApi, type PronunciationCheckResponse } from '../../lib/api'
import { dictionaryApi } from '../../lib/api'

// ── TTS helper: đọc câu tiếng Trung bằng edge-tts ──
async function playReferenceAudio(text: string): Promise<void> {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'
    const res = await fetch(`${backendUrl}/api/audio/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang: 'zh-CN' }),
    })
    if (!res.ok) throw new Error('TTS error')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audio.onended = () => URL.revokeObjectURL(url)
    await audio.play()
  } catch {
    // TTS không bắt buộc — fail silently
  }
}

// ── Parse pinyin để lấy tone ──
function extractToneFromPinyin(pinyin: string): string | null {
  const m = pinyin.match(/[1-4]/)
  if (m) return m[0]
  // fallback tone mark
  const marks: Record<string, string> = {
    'ā':'1','ē':'1','ī':'1','ō':'1','ū':'1','ǖ':'1',
    'á':'2','é':'2','í':'2','ó':'2','ú':'2','ǘ':'2',
    'ǎ':'3','ě':'3','ǐ':'3','ǒ':'3','ǔ':'3','ǚ':'3',
    'à':'4','è':'4','ì':'4','ò':'4','ù':'4','ǜ':'4',
  }
  for (const ch of pinyin) {
    if (marks[ch]) return marks[ch]
  }
  return null
}

export default function PronunciationPage() {
  const [inputText, setInputText]   = useState('')
  const [inputPinyin, setInputPinyin] = useState('')
  const [recordedFile, setRecordedFile] = useState<File | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [result, setResult]         = useState<PronunciationCheckResponse | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [isPlayingRef, setIsPlayingRef] = useState(false)

  // ── Khi ghi âm xong ──
  const handleRecorded = useCallback((file: File) => {
    setRecordedFile(file)
    setError(null)
    setResult(null)
  }, [])

  // ── Xoá bản ghi ──
  const handleReset = useCallback(() => {
    setRecordedFile(null)
    setResult(null)
    setError(null)
  }, [])

  // ── Check phát âm ──
  const handleCheck = useCallback(async () => {
    if (!inputText.trim()) {
      setError('Vui lòng nhập chữ Hán cần luyện phát âm.')
      return
    }
    if (!recordedFile) {
      setError('Vui lòng ghi âm giọng nói trước.')
      return
    }

    setIsChecking(true)
    setError(null)
    setResult(null)

    try {
      const response = await pronunciationApi.check({
        userAudio: recordedFile,
        referenceText: inputText.trim(),
        referencePinyin: inputPinyin.trim() || undefined,
      })
      setResult(response)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chấm phát âm thất bại.')
    } finally {
      setIsChecking(false)
    }
  }, [inputText, inputPinyin, recordedFile])

  // ── Nghe mẫu ──
  const handlePlayReference = useCallback(async () => {
    if (!inputText.trim()) return
    setIsPlayingRef(true)
    await playReferenceAudio(inputText.trim())
    setIsPlayingRef(false)
  }, [inputText])

  // ── Tra từ điển cho từng chữ ──
  const [selectedChar, setSelectedChar] = useState<string | null>(null)
  const [dictEntry, setDictEntry] = useState<{
    word: string; pinyin: string; meanings_vi: string[]
  } | null>(null)
  const [dictLoading, setDictLoading] = useState(false)

  const handleCharClick = useCallback(async (char: string) => {
    if (!/[\u4e00-\u9fff]/.test(char)) return
    setSelectedChar(char)
    setDictEntry(null)
    setDictLoading(true)
    try {
      const entry = await dictionaryApi.lookup(char)
      setDictEntry({
        word: entry.word,
        pinyin: entry.pinyin,
        meanings_vi: entry.meanings_vi ?? (entry.meaning_vi ? [entry.meaning_vi] : []),
      })
    } catch {
      setDictEntry(null)
    } finally {
      setDictLoading(false)
    }
  }, [])

  const segmentedChars = inputText.split('')

  return (
    <>
      <Head><title>Phát âm — 學中文</title></Head>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-xl mx-auto w-full px-6 py-10">

          {/* ── Header ── */}
          <div className="mb-8">
            <h1 className="font-serif text-3xl font-bold text-snow mb-1">
              🎤 Luyện phát âm
            </h1>
            <p className="text-ghost text-sm">
              Nhập chữ Hán · Ghi âm · Kiểm tra thanh điệu
            </p>
          </div>

          {/* ── Input card ── */}
          <div className="glass rounded-2xl p-5 border border-white/6 space-y-4 mb-6">

            {/* Chữ Hán */}
            <div>
              <label className="block text-xs text-ghost uppercase tracking-wider mb-2">
                Chữ Hán
              </label>
              <textarea
                value={inputText}
                onChange={e => { setInputText(e.target.value); setResult(null); setSelectedChar(null) }}
                placeholder="VD: 你好"
                rows={2}
                className="w-full resize-none bg-white/5 border border-white/10 rounded-xl
                           px-4 py-3 text-2xl font-serif text-snow
                           placeholder:text-ghost/40 focus:outline-none
                           focus:border-amber-glow/50 transition-colors"
              />
              {/* Clickable chars */}
              {inputText && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {segmentedChars.map((ch, i) => (
                    <button
                      key={i}
                      onClick={() => handleCharClick(ch)}
                      className={`text-lg font-serif px-1 py-0.5 rounded
                                  transition-colors hover:bg-amber-glow/20
                                  ${/[\u4e00-\u9fff]/.test(ch)
                                    ? 'text-amber-glow cursor-pointer'
                                    : 'text-ghost/50 cursor-default'
                                  }`}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Pinyin */}
            <div>
              <label className="block text-xs text-ghost uppercase tracking-wider mb-2">
                Pinyin <span className="text-ghost/40 normal-case">(tuỳ chọn)</span>
              </label>
              <input
                value={inputPinyin}
                onChange={e => { setInputPinyin(e.target.value); setResult(null) }}
                placeholder="VD: ni3 hao3"
                className="w-full bg-white/5 border border-white/10 rounded-xl
                           px-4 py-3 text-sm font-mono text-snow
                           placeholder:text-ghost/40 focus:outline-none
                           focus:border-amber-glow/50 transition-colors"
              />
            </div>

            {/* Dict popup */}
            {dictLoading && (
              <div className="text-xs text-ghost animate-pulse">Đang tra từ điển...</div>
            )}
            {dictEntry && selectedChar && (
              <div className="bg-amber-glow/5 border border-amber-glow/20 rounded-xl p-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <p className="text-amber-glow font-serif text-xl">{dictEntry.word}</p>
                    <p className="text-ghost text-xs font-mono mt-0.5">{dictEntry.pinyin}</p>
                    <ul className="mt-2 space-y-1">
                      {dictEntry.meanings_vi.slice(0, 3).map((m, i) => (
                        <li key={i} className="text-snow text-xs flex gap-2">
                          <span className="text-amber-glow/60">{i + 1}.</span>
                          <span>{m}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    onClick={() => { setSelectedChar(null); setDictEntry(null) }}
                    className="text-ghost hover:text-snow p-1"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              </div>
            )}

            {/* Nghe mẫu */}
            {inputText && (
              <button
                onClick={handlePlayReference}
                disabled={isPlayingRef}
                className="flex items-center gap-2 text-xs text-ghost
                           hover:text-amber-glow transition-colors disabled:opacity-50"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
                {isPlayingRef ? 'Đang phát...' : '🔊 Nghe mẫu phát âm'}
              </button>
            )}
          </div>

          {/* ── Ghi âm card ── */}
          <div className="glass rounded-2xl p-5 border border-white/6 space-y-4 mb-6">
            <p className="text-xs text-ghost uppercase tracking-wider">
              Ghi âm giọng nói
            </p>

            <VoiceRecorder onRecorded={handleRecorded} disabled={isChecking} />

            {recordedFile && (
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" className="text-jade">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <span className="text-xs text-jade truncate">
                  Đã ghi: {recordedFile.name}
                </span>
                <button
                  onClick={handleReset}
                  className="ml-auto text-xs text-ghost hover:text-red-400 transition-colors"
                >
                  Xoá
                </button>
              </div>
            )}
          </div>

          {/* ── Nút Check ── */}
          <button
            onClick={handleCheck}
            disabled={isChecking || !inputText.trim() || !recordedFile}
            className="w-full btn-primary py-3 text-sm disabled:opacity-40"
          >
            {isChecking ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
                </svg>
                Đang chấm phát âm...
              </span>
            ) : 'Kiểm tra phát âm'}
          </button>

          {/* ── Lỗi ── */}
          {error && (
            <div className="mt-4 glass rounded-xl px-4 py-3 border border-red-500/20">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* ── Kết quả ── */}
          {result && (
            <div className="mt-6 space-y-4 animate-slide-up">

              {/* Score header */}
              <div className="glass rounded-2xl p-5 border border-white/6 text-center">
                <p className="text-xs text-ghost uppercase tracking-wider mb-2">
                  Điểm phát âm
                </p>
                {/* Support both old (score:int) and new (overall_score:float) format */}
                <p className="text-6xl font-bold text-amber-glow font-mono">
                  {Math.round(result.overall_score)}
                  <span className="text-2xl text-ghost/40">/100</span>
                </p>
                <div className="flex justify-center gap-6 mt-4">
                  <div className="text-center">
                    <p className="text-lg font-mono text-snow">{result.text_similarity_score.toFixed(0)}</p>
                    <p className="text-[10px] text-ghost">Text</p>
                  </div>
                  <div className="w-px bg-white/10" />
                  <div className="text-center">
                    <p className="text-lg font-mono text-snow">{result.tone_score.toFixed(0)}</p>
                    <p className="text-[10px] text-ghost">Tone</p>
                  </div>
                  <div className="w-px bg-white/10" />
                  <div className="text-center">
                    <p className="text-lg font-mono text-snow">{result.acoustic_score.toFixed(0)}</p>
                    <p className="text-[10px] text-ghost">Acoustic</p>
                  </div>
                </div>
              </div>

              {/* Summary (new format) */}
              {'summary' in result && result.summary && (
                <div className="glass rounded-2xl p-4 border border-amber-glow/20 bg-amber-glow/5">
                  <p className="text-sm text-snow leading-relaxed">{result.summary}</p>
                </div>
              )}

              {/* Syllable results — new format */}
              {'syllable_results' in result && result.syllable_results && result.syllable_results.length > 0 && (
                <div className="glass rounded-2xl p-5 border border-white/6">
                  <p className="text-xs text-ghost uppercase tracking-wider mb-3">
                    Chi tiết từng âm tiết
                  </p>
                  <div className="space-y-2">
                    {result.syllable_results.map((syl, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm font-mono font-bold
                                        ${syl.tone_score >= 0.7
                                          ? 'bg-jade/20 text-jade'
                                          : 'bg-red-500/20 text-red-400'
                                        }`}>
                          {syl.character}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-snow/70 font-mono">{syl.pinyin}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-ghost">
                              tone {syl.expected_tone}
                            </span>
                            <span className="text-[10px] text-ghost">→</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              syl.tone_score >= 0.7
                                ? 'bg-jade/10 text-jade'
                                : 'bg-red-500/10 text-red-400'
                            }`}>
                              tone {syl.user_tone}
                            </span>
                            <span className={`ml-auto text-xs font-mono ${
                              syl.tone_score >= 0.7 ? 'text-jade' : 'text-red-400'
                            }`}>
                              {(syl.tone_score * 100).toFixed(0)}%
                            </span>
                          </div>
                          {syl.errors.length > 0 && (
                            <p className="text-[10px] text-red-400/80 mt-0.5">{syl.errors[0]}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations (new format) */}
              {'recommendations' in result && result.recommendations && result.recommendations.length > 0 && (
                <div className="glass rounded-2xl p-5 border border-amber-glow/20 bg-amber-glow/5">
                  <p className="text-xs text-amber-glow/70 uppercase tracking-wider mb-3">
                    💡 Khuyến nghị học tập
                  </p>
                  <div className="space-y-3">
                    {result.recommendations.map((rec, idx) => (
                      <div key={idx} className="flex gap-3">
                        <span className="text-amber-glow text-sm mt-0.5">▶</span>
                        <div>
                          <p className="text-sm text-snow font-medium">{rec.focus}</p>
                          <p className="text-xs text-mist mt-0.5">{rec.message}</p>
                          {rec.examples && (
                            <p className="text-[10px] text-ghost mt-0.5">Ví dụ: {rec.examples}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recognized text */}
              {result.recognized_text && (
                <div className="glass rounded-xl px-4 py-3 border border-white/5">
                  <p className="text-[11px] text-ghost mb-1">Speech-to-text nhận diện được:</p>
                  <p className="text-sm font-serif text-mist">{result.recognized_text}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Tips ── */}
          {!result && !error && (
            <div className="mt-10 glass rounded-xl p-4 border border-white/5">
              <p className="text-[11px] text-ghost uppercase tracking-wider mb-2">Mẹo sử dụng</p>
              <ul className="space-y-1.5 text-sm text-mist">
                <li className="flex gap-2"><span className="text-amber-glow">•</span>Nhấn vào từng chữ Hán để tra nghĩa nhanh</li>
                <li className="flex gap-2"><span className="text-amber-glow">•</span>Nhấn nút 🎤 để bắt đầu ghi âm, nhấn lại để dừng</li>
                <li className="flex gap-2"><span className="text-amber-glow">•</span>Nhấn "Nghe mẫu" để nghe phát âm chuẩn trước khi thực hành</li>
                <li className="flex gap-2"><span className="text-amber-glow">•</span>Nhập pinyin (VD: ni3 hao3) để kết quả tone chính xác hơn</li>
              </ul>
            </div>
          )}

        </main>
      </div>
    </>
  )
}
