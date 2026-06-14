-- Moodorama database schema (MySQL 5.7+ / 8.0+)
--
-- One row per user. A user's mood selection is upserted, and is considered
-- "active" for 7 days (expires_at). The map only shows active moods.

CREATE DATABASE IF NOT EXISTS moodorama
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE moodorama;

CREATE TABLE IF NOT EXISTS moods (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id          CHAR(36)        NOT NULL,
  mood             ENUM('joy', 'fear', 'sadness', 'disgust', 'anger') NOT NULL,
  alias            VARCHAR(32)     NULL,
  latitude         DOUBLE          NOT NULL,
  longitude        DOUBLE          NOT NULL,
  created_at       DATETIME        NOT NULL,
  updated_at       DATETIME        NOT NULL,
  expires_at       DATETIME        NOT NULL,
  push_notified_at DATETIME        NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_user (user_id),
  KEY idx_expires (expires_at),
  KEY idx_push_notify (expires_at, push_notified_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      CHAR(36)        NOT NULL,
  endpoint     VARCHAR(512)    NOT NULL,
  p256dh       VARCHAR(255)    NOT NULL,
  auth         VARCHAR(255)    NOT NULL,
  created_at   DATETIME        NOT NULL,
  updated_at   DATETIME        NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_endpoint (endpoint(255)),
  KEY idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Hourly snapshots of active moods. No user_id, alias, or per-user dates.
-- snapshot_at is truncated to the hour (YYYY-MM-DD HH:00:00).

CREATE TABLE IF NOT EXISTS mood_snapshots (
  snapshot_at  DATETIME        NOT NULL,
  point_count  INT UNSIGNED    NOT NULL,
  captured_at  DATETIME        NOT NULL,
  PRIMARY KEY (snapshot_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mood_snapshot_points (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  snapshot_at   DATETIME        NOT NULL,
  mood          ENUM('joy', 'fear', 'sadness', 'disgust', 'anger') NOT NULL,
  latitude      DOUBLE          NOT NULL,
  longitude     DOUBLE          NOT NULL,
  country_code  CHAR(2)         NULL,
  PRIMARY KEY (id),
  KEY idx_snapshot (snapshot_at),
  KEY idx_snapshot_country (snapshot_at, country_code),
  KEY idx_snapshot_mood (snapshot_at, mood)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS mood_snapshot_country_counts (
  snapshot_at   DATETIME NOT NULL,
  country_code  CHAR(2)  NOT NULL,
  mood          ENUM('joy', 'fear', 'sadness', 'disgust', 'anger') NOT NULL,
  count         INT UNSIGNED NOT NULL,
  PRIMARY KEY (snapshot_at, country_code, mood)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
