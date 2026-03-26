-- migrations/add_soft_delete_and_indexes.sql
-- ============================================
-- Migration: Thêm soft delete + indexes tối ưu
-- Chạy: sqlite3 supchi4.db < migrations/add_soft_delete_and_indexes.sql
-- Hoặc dùng Alembic cho PostgreSQL
-- ============================================

-- ── 1. Thêm cột is_deleted cho videos ──
ALTER TABLE videos ADD COLUMN is_deleted INTEGER DEFAULT 0 NOT NULL;

-- ── 2. Thêm cột deleted_at cho videos ──
ALTER TABLE videos ADD COLUMN deleted_at TIMESTAMP NULL;

-- ── 3. Thêm cột is_deleted cho subtitles ──
ALTER TABLE subtitles ADD COLUMN is_deleted INTEGER DEFAULT 0 NOT NULL;

-- ── 4. Thêm index cho youtube_url (tránh full table scan) ──
CREATE INDEX IF NOT EXISTS idx_videos_youtube_url ON videos(youtube_url);

-- ── 5. Thêm composite index cho soft delete queries ──
CREATE INDEX IF NOT EXISTS idx_videos_user_active
    ON videos(user_id, is_deleted)
    WHERE is_deleted = 0;

CREATE INDEX IF NOT EXISTS idx_videos_created_at
    ON videos(created_at DESC);

-- ── 6. Index cho subtitles ──
CREATE INDEX IF NOT EXISTS idx_subtitles_video_time
    ON subtitles(video_id, start_time);

-- ── 7. Thêm index cho jobs ──
CREATE INDEX IF NOT EXISTS idx_jobs_user_status
    ON processing_jobs(user_id, status);

CREATE INDEX IF NOT EXISTS idx_jobs_celery_task_id
    ON processing_jobs(celery_task_id);

CREATE INDEX IF NOT EXISTS idx_jobs_created_at
    ON processing_jobs(created_at);

-- ── 8. PostgreSQL-specific (nếu dùng PostgreSQL) ──
-- PostgreSQL:
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_videos_user_active
--     ON videos(user_id) WHERE is_deleted = 0;
--
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_user_status
--     ON processing_jobs(user_id, status);

-- ── 9. Bật auto_vacuum cho PostgreSQL ──
-- ALTER TABLE videos SET (autovacuum_vacuum_scale_factor = 0.01);
-- ALTER TABLE subtitles SET (autovacuum_vacuum_scale_factor = 0.01);
-- ALTER TABLE processing_jobs SET (autovacuum_vacuum_scale_factor = 0.05);

-- ── 10. Cleanup: Xóa jobs fail cũ (tùy chọn) ──
-- DELETE FROM processing_jobs
-- WHERE status = 'failed'
--   AND finished_at < datetime('now', '-30 days');

-- ── 11. Vacuum để áp dụng thay đổi ──
PRAGMA vacuum;
PRAGMA analyze;
