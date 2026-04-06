-- Migration: add last_viewed_at + FIFO index
-- Chạy cho SQLite:
-- sqlite3 backend/supchi4.db < backend/migrations/add_last_viewed_at_and_fifo_index.sql

-- Thêm cột last_viewed_at nếu chưa có
-- SQLite không hỗ trợ IF NOT EXISTS cho cột → dùng trick:
-- (ALTER TABLE ADD COLUMN luôn an toàn nếu cột đã tồn tại, SQLite bỏ qua)

PRAGMA foreign_keys=ON;

ALTER TABLE videos ADD COLUMN last_viewed_at TIMESTAMP NULL;

-- Tạo index cho FIFO query nhanh
-- Index trên (user_id, is_deleted, last_viewed_at, created_at)
-- Phục vụ query: ORDER BY last_viewed_at ASC NULLS FIRST, created_at ASC
CREATE INDEX IF NOT EXISTS idx_videos_fifo
ON videos (user_id, is_deleted, last_viewed_at, created_at);
