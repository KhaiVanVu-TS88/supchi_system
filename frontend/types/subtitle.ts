/**
 * types/subtitle.ts
 * Định nghĩa kiểu dữ liệu dùng chung trong toàn bộ ứng dụng
 */

/** Một đoạn subtitle với thông tin thời gian và nội dung 3 ngôn ngữ */
export interface Subtitle {
    start: number;        // Thời điểm bắt đầu (giây)
    end: number;          // Thời điểm kết thúc (giây)
    chinese: string;      // Chữ Hán
    pinyin: string;       // Phiên âm Pinyin
    vietnamese: string;   // Bản dịch tiếng Việt
}

/** Trạng thái của quá trình xử lý video */
export type ProcessingStatus = 'idle' | 'loading' | 'success' | 'error';

/** Response từ backend API */
export interface AnalyzeResponse {
    subtitles: Subtitle[];
    video_id: string;
    total_segments: number;
}