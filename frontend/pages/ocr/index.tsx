/**
 * pages/ocr/index.tsx — Trang OCR & Viết tay
 */
import React, { useState } from 'react'
import Head from 'next/head'
import Navbar from '../../components/layout/Navbar'
import OcrUploader from '../../components/ocr/OcrUploader'
import OcrResultCard from '../../components/ocr/OcrResult'
import HandwritingCanvas from '../../components/ocr/HandwritingCanvas'
import HandwritingResultCard from '../../components/ocr/HandwritingResult'
import type { OcrResult } from '../../components/ocr/OcrUploader'
import type { HandwritingResult } from '../../components/ocr/HandwritingCanvas'

type Tab = 'ocr' | 'handwriting'

export default function OcrPage() {
  const [tab, setTab] = useState<Tab>('ocr')
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null)
  const [hwResult, setHwResult] = useState<HandwritingResult | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [hwLoading, setHwLoading] = useState(false)

  return (
    <>
      <Head><title>OCR & Viết tay — 學中文</title></Head>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-10">

          {/* Header */}
          <div className="mb-8">
            <h1 className="font-serif text-3xl font-bold text-snow mb-1">
              🔍 Nhận dạng chữ Hán
            </h1>
            <p className="text-ghost text-sm">
              Chụp ảnh hoặc vẽ tay → AI nhận dạng → Pinyin + Nghĩa tiếng Việt
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 glass rounded-xl mb-6 border border-gray-100">
            {([
              { id: 'ocr', icon: '📷', label: 'Nhận dạng từ ảnh' },
              { id: 'handwriting', icon: '✍️', label: 'Viết tay' },
            ] as { id: Tab; icon: string; label: string }[]).map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg
                            text-sm font-medium transition-all ${tab === t.id
                    ? 'bg-amber-glow/15 text-amber-glow border border-amber-glow/25'
                    : 'text-ghost hover:text-snow'
                  }`}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* OCR Tab */}
          {tab === 'ocr' && (
            <div className="space-y-5">
              <div className="glass rounded-2xl p-5 border border-gray-100">
                <OcrUploader
                  onResult={setOcrResult}
                  onLoading={setOcrLoading}
                  isLoading={ocrLoading}
                />
              </div>
              {ocrResult && <OcrResultCard result={ocrResult} />}
            </div>
          )}

          {/* Handwriting Tab */}
          {tab === 'handwriting' && (
            <div className="space-y-5">
              <div className="glass rounded-2xl p-5 border border-gray-100">
                <HandwritingCanvas
                  onResult={setHwResult}
                  onLoading={setHwLoading}
                  isLoading={hwLoading}
                />
              </div>
              {hwResult && <HandwritingResultCard result={hwResult} />}
            </div>
          )}

          {/* Tips */}
          <div className="mt-8 glass rounded-xl p-4 border border-gray-100">
            <p className="text-[11px] text-ghost uppercase tracking-wider mb-2">Mẹo sử dụng</p>
            {tab === 'ocr' ? (
              <ul className="space-y-1.5 text-sm text-mist">
                <li className="flex gap-2"><span className="text-amber-glow">•</span>Chụp ảnh sách, biển hiệu, màn hình có chữ Hán</li>
                <li className="flex gap-2"><span className="text-amber-glow">•</span>Ảnh rõ nét, đủ sáng cho kết quả tốt nhất</li>
                <li className="flex gap-2"><span className="text-amber-glow">•</span>Click vào từng từ để tra từ điển đầy đủ</li>
              </ul>
            ) : (
              <ul className="space-y-1.5 text-sm text-mist">
                <li className="flex gap-2"><span className="text-amber-glow">•</span>Viết từng chữ rõ ràng, đủ to</li>
                <li className="flex gap-2"><span className="text-amber-glow">•</span>Tự động nhận dạng sau 1.5s ngừng vẽ</li>
                <li className="flex gap-2"><span className="text-amber-glow">•</span>Click vào gợi ý để tra từ điển</li>
              </ul>
            )}
          </div>

        </main>
      </div>
    </>
  )
}