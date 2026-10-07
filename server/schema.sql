-- linqsafe database schema (MySQL 8+). Reference snapshot after migration 20.
-- The source of truth is server/migrations.js: the server applies pending migrations on start.
-- You don't need to run this file by hand; it's here to read, review and diff.
--
-- Tables
--   users              accounts, public profile, plan (free/pro), onboarding + login tracking
--   links              a user's links, ordered by position, typed (instagram, website, ...)
--   events             in-house analytics: one row per page view or link click (no IPs stored)
--   auth_tokens        one-time email verification / password reset tokens (SHA-256 hashed)
--   payments           every checkout: LinqSafe ref, Paystack ID, feature, months, status, how they paid
--   user_features      paid features each user has, with expiry (NULL = no expiry)
--   app_settings       founder-editable settings (feature prices, discounts)
--   contact_messages   messages from the /contact form
--   schema_migrations  which migrations have run

CREATE TABLE `app_settings` (
  `name` varchar(60) NOT NULL,
  `value` varchar(255) NOT NULL,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE `auth_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `kind` varchar(10) NOT NULL,
  `token_hash` char(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token_hash` (`token_hash`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `auth_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE `contact_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `email` varchar(254) NOT NULL,
  `message` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE `events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `link_id` int DEFAULT NULL,
  `kind` varchar(8) NOT NULL,
  `referrer` varchar(100) NOT NULL DEFAULT '',
  `device` varchar(8) NOT NULL DEFAULT '',
  `country` char(2) NOT NULL DEFAULT '',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `visitor` char(16) NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  KEY `idx_user_time` (`user_id`,`created_at`),
  KEY `link_id` (`link_id`),
  CONSTRAINT `events_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `events_ibfk_2` FOREIGN KEY (`link_id`) REFERENCES `links` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE `links` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `title` varchar(100) NOT NULL,
  `url` varchar(2048) NOT NULL,
  `position` int NOT NULL DEFAULT '0',
  `clicks` int NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `type` varchar(16) NOT NULL DEFAULT 'website',
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `links_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE `payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `reference` varchar(100) NOT NULL,
  `amount_kobo` int NOT NULL,
  `currency` char(3) NOT NULL,
  `status` varchar(20) NOT NULL,
  `paid_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `feature` varchar(30) NOT NULL DEFAULT '',
  `months` int NOT NULL DEFAULT '0',
  `paystack_id` bigint DEFAULT NULL,
  `channel` varchar(20) NOT NULL DEFAULT '',
  `card_type` varchar(30) NOT NULL DEFAULT '',
  `last4` varchar(4) NOT NULL DEFAULT '',
  `bank` varchar(80) NOT NULL DEFAULT '',
  `customer_email` varchar(254) NOT NULL DEFAULT '',
  `gateway_response` varchar(120) NOT NULL DEFAULT '',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `reference` (`reference`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `payments_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE `schema_migrations` (
  `id` int NOT NULL,
  `name` varchar(100) NOT NULL,
  `applied_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE `user_features` (
  `user_id` int NOT NULL,
  `feature` varchar(30) NOT NULL,
  `payment_reference` varchar(100) DEFAULT NULL,
  `unlocked_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime DEFAULT NULL,
  PRIMARY KEY (`user_id`,`feature`),
  CONSTRAINT `user_features_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(32) NOT NULL,
  `email` varchar(254) DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `display_name` varchar(80) NOT NULL DEFAULT '',
  `bio` varchar(255) NOT NULL DEFAULT '',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `layout` varchar(16) NOT NULL DEFAULT 'classic',
  `avatar_url` mediumtext,
  `theme` varchar(16) NOT NULL DEFAULT 'light',
  `tags` varchar(160) NOT NULL DEFAULT '',
  `views` int NOT NULL DEFAULT '0',
  `email_verified` tinyint(1) NOT NULL DEFAULT '0',
  `token_version` int NOT NULL DEFAULT '0',
  `cover_url` mediumtext,
  `plan` varchar(10) NOT NULL DEFAULT 'free',
  `note_body` text,
  `note_sign` varchar(60) NOT NULL DEFAULT '',
  `account_type` varchar(10) NOT NULL DEFAULT 'personal',
  `category` varchar(80) NOT NULL DEFAULT '',
  `whatsapp` varchar(20) NOT NULL DEFAULT '',
  `occupation` varchar(80) NOT NULL DEFAULT '',
  `location` varchar(80) NOT NULL DEFAULT '',
  `testimonials` text,
  `last_login_at` datetime DEFAULT NULL,
  `login_count` int NOT NULL DEFAULT '0',
  `onboarded_at` datetime DEFAULT NULL,
  `pro_until` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
