-- Moodorama database schema (MySQL 5.7+ / 8.0+)
--
-- One row per user. A user's mood selection is upserted, and is considered
-- "active" for 12 hours (expires_at). The map only shows active moods.

CREATE DATABASE IF NOT EXISTS moodorama
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE moodorama;

CREATE TABLE IF NOT EXISTS moods (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     CHAR(36)        NOT NULL,
  mood        ENUM('joy', 'fear', 'sadness', 'disgust', 'anger') NOT NULL,
  alias       VARCHAR(32)     NULL,
  latitude    DOUBLE          NOT NULL,
  longitude   DOUBLE          NOT NULL,
  created_at  DATETIME        NOT NULL,
  updated_at  DATETIME        NOT NULL,
  expires_at  DATETIME        NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_user (user_id),
  KEY idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
