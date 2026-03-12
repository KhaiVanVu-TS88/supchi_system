/**
 * pages/_app.tsx
 * Next.js App wrapper
 * Dùng relative import cho CSS để tránh vấn đề alias resolution
 */
import type { AppProps } from 'next/app'
import '../styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
    return <Component {...pageProps} />
}