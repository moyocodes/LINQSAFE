// Versioned schema changes. Each step runs exactly once and is recorded in schema_migrations.
// Steps are written to be safe on databases created before this file existed (they tolerate
// columns/tables that are already there), so adopting it on an existing install is harmless.
// To change the schema: append a new step with the next id. Never edit or reorder old steps.

async function addColumn(db, table, def) {
  try {
    await db.query(`ALTER TABLE ${table} ADD COLUMN ${def}`)
  } catch (e) {
    if (e.code !== 'ER_DUP_FIELDNAME') throw e
  }
}

const SOCIAL_HOSTS = {
  instagram: ['instagram.com'], tiktok: ['tiktok.com'], youtube: ['youtube.com', 'youtu.be'], snapchat: ['snapchat.com'],
  pinterest: ['pinterest.com', 'pin.it'], x: ['x.com', 'twitter.com'], facebook: ['facebook.com', 'fb.com', 'fb.me'],
  linkedin: ['linkedin.com'], github: ['github.com'], whatsapp: ['wa.me', 'whatsapp.com'],
  music: ['spotify.com', 'soundcloud.com', 'music.apple.com'],
}

const MIGRATIONS = [
  [1, 'base tables', async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(32) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(80) NOT NULL DEFAULT '',
        bio VARCHAR(255) NOT NULL DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`)
    await db.query(`
      CREATE TABLE IF NOT EXISTS links (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(100) NOT NULL,
        url VARCHAR(2048) NOT NULL,
        position INT NOT NULL DEFAULT 0,
        clicks INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`)
    await db.query(`
      CREATE TABLE IF NOT EXISTS contact_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(254) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`)
  }],
  [2, 'profile customisation', async (db) => {
    await addColumn(db, 'users', 'email VARCHAR(254) NULL UNIQUE AFTER username')
    await addColumn(db, 'users', "layout VARCHAR(16) NOT NULL DEFAULT 'classic'")
    await addColumn(db, 'users', 'avatar_url MEDIUMTEXT NULL')
    await db.query('ALTER TABLE users MODIFY avatar_url MEDIUMTEXT NULL') // older installs had VARCHAR(500)
    await addColumn(db, 'users', "theme VARCHAR(16) NOT NULL DEFAULT 'light'")
    await addColumn(db, 'users', "tags VARCHAR(160) NOT NULL DEFAULT ''")
    await addColumn(db, 'users', 'views INT NOT NULL DEFAULT 0')
  }],
  [3, 'link types + backfill', async (db) => {
    await addColumn(db, 'links', "type VARCHAR(16) NOT NULL DEFAULT 'website'")
    const [rows] = await db.query("SELECT id, url FROM links WHERE type = 'website'")
    for (const { id, url } of rows) {
      let host = ''
      try { host = new URL(url).hostname.replace(/^(www|m|open|vm)\./, '') } catch { continue }
      const type = Object.keys(SOCIAL_HOSTS).find((k) => SOCIAL_HOSTS[k].some((h) => host === h || host.endsWith(`.${h}`)))
      if (type) await db.query('UPDATE links SET type = ? WHERE id = ?', [type, id])
    }
  }],
  [4, 'email verification + password reset', async (db) => {
    await addColumn(db, 'users', 'email_verified TINYINT(1) NOT NULL DEFAULT 0')
    await db.query(`
      CREATE TABLE IF NOT EXISTS auth_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        kind VARCHAR(10) NOT NULL,
        token_hash CHAR(64) NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        used_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`)
  }],
  [5, 'analytics events', async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS events (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        link_id INT NULL,
        kind VARCHAR(8) NOT NULL,
        referrer VARCHAR(100) NOT NULL DEFAULT '',
        device VARCHAR(8) NOT NULL DEFAULT '',
        country CHAR(2) NOT NULL DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_time (user_id, created_at),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE SET NULL
      )`)
  }],
  [6, 'session versioning', async (db) => {
    // Bumped on password reset / logout-everywhere so older login cookies stop working.
    await addColumn(db, 'users', 'token_version INT NOT NULL DEFAULT 0')
  }],
  [7, 'unique visitors', async (db) => {
    // Random first-party visitor id from the lh_vid cookie; used for unique-visitor counts and to
    // avoid counting a refresh as a new view. Not linked to an account, IP or device fingerprint.
    await addColumn(db, 'events', "visitor CHAR(16) NOT NULL DEFAULT ''")
  }],
  [8, 'avatar_url nullable', async (db) => {
    // TEXT columns can't have a plain DEFAULT on MySQL < 8.0.13, so NOT NULL made every signup fail.
    await db.query('ALTER TABLE users MODIFY avatar_url MEDIUMTEXT NULL')
  }],
  [9, 'cover image', async (db) => {
    await addColumn(db, 'users', 'cover_url MEDIUMTEXT NULL')
  }],
  [10, 'plans + founder note', async (db) => {
    await addColumn(db, 'users', "plan VARCHAR(10) NOT NULL DEFAULT 'free'")
    await addColumn(db, 'users', 'note_body TEXT NULL')
    await addColumn(db, 'users', "note_sign VARCHAR(60) NOT NULL DEFAULT ''")
  }],
  [11, 'account type, business details, profile facts', async (db) => {
    await addColumn(db, 'users', "account_type VARCHAR(10) NOT NULL DEFAULT 'personal'")
    await addColumn(db, 'users', "category VARCHAR(30) NOT NULL DEFAULT ''")
    await addColumn(db, 'users', "whatsapp VARCHAR(20) NOT NULL DEFAULT ''")
    await addColumn(db, 'users', "occupation VARCHAR(80) NOT NULL DEFAULT ''")
    await addColumn(db, 'users', "location VARCHAR(80) NOT NULL DEFAULT ''")
  }],
  [12, 'testimonials', async (db) => {
    await addColumn(db, 'users', 'testimonials TEXT NULL') // JSON array of short quotes
  }],
  [13, 'login tracking + onboarding', async (db) => {
    await addColumn(db, 'users', 'last_login_at DATETIME NULL')
    await addColumn(db, 'users', 'login_count INT NOT NULL DEFAULT 0')
    await addColumn(db, 'users', 'onboarded_at DATETIME NULL')
    // Accounts that existed before onboarding shouldn't be pushed through it.
    await db.query('UPDATE users SET onboarded_at = created_at WHERE onboarded_at IS NULL')
  }],
  [14, 'paystack billing', async (db) => {
    // Pro bought through Paystack runs until pro_until; NULL means no expiry (set by hand).
    await addColumn(db, 'users', 'pro_until DATETIME NULL')
    await db.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        reference VARCHAR(100) NOT NULL UNIQUE,
        amount_kobo INT NOT NULL,
        currency CHAR(3) NOT NULL,
        status VARCHAR(20) NOT NULL,
        paid_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`)
  }],
  [15, 'pay-per-feature unlocks', async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_features (
        user_id INT NOT NULL,
        feature VARCHAR(30) NOT NULL,
        payment_reference VARCHAR(100) NULL,
        unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, feature),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`)
    await addColumn(db, 'payments', "feature VARCHAR(30) NOT NULL DEFAULT ''")
  }],
  [16, 'feature durations', async (db) => {
    // NULL = no expiry (granted by hand); otherwise the feature works until this time.
    await addColumn(db, 'user_features', 'expires_at DATETIME NULL')
    await addColumn(db, 'payments', 'months INT NOT NULL DEFAULT 0')
  }],
  [17, 'app settings (founder-editable pricing)', async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        name VARCHAR(60) PRIMARY KEY,
        value VARCHAR(255) NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`)
  }],
  [18, 'payment details', async (db) => {
    // reference = our LinqSafe reference (LQS-…), also used as the Paystack reference.
    await addColumn(db, 'payments', 'paystack_id BIGINT NULL')
    await addColumn(db, 'payments', "channel VARCHAR(20) NOT NULL DEFAULT ''")
    await addColumn(db, 'payments', "card_type VARCHAR(30) NOT NULL DEFAULT ''")
    await addColumn(db, 'payments', "last4 VARCHAR(4) NOT NULL DEFAULT ''")
    await addColumn(db, 'payments', "bank VARCHAR(80) NOT NULL DEFAULT ''")
    await addColumn(db, 'payments', "customer_email VARCHAR(254) NOT NULL DEFAULT ''")
    await addColumn(db, 'payments', "gateway_response VARCHAR(120) NOT NULL DEFAULT ''")
    await addColumn(db, 'payments', 'updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
  }],
  [19, 'onboarding progress', async (db) => {
    // Furthest onboarding step reached (1–5), for the founder's drop-off funnel.
    await addColumn(db, 'users', 'onboarding_step TINYINT NOT NULL DEFAULT 0')
  }],
  [20, 'longer business industry', async (db) => {
    // Allows custom "Other" industries stored as other:<label>.
    await db.query('ALTER TABLE users MODIFY category VARCHAR(80) NOT NULL DEFAULT ""')
  }],
  [21, 'expiry reminder tracking', async (db) => {
    // So the daily reminder job emails each purchase once before it ends and once after.
    await addColumn(db, 'user_features', 'reminded_at DATETIME NULL')
    await addColumn(db, 'user_features', 'expired_notice_at DATETIME NULL')
  }],
  [22, 'photo background blur setting', async (db) => {
    // For the "Photo background" template: 1 = blur the photo behind the page, 0 = show it sharp.
    await addColumn(db, 'users', 'bg_blur TINYINT(1) NOT NULL DEFAULT 1')
  }],
  [23, 'multi-feature payments', async (db) => {
    // One payment can unlock several features: items = JSON [{ feature, months, price }]. feature = first key or 'bundle'.
    await addColumn(db, 'payments', 'items TEXT NULL')
  }],
  [24, 'fill unknown event countries from the same visitor', async (db) => {
    // Events with no country get the country this visitor had on another counted visit (most common one).
    await db.query(`
      UPDATE events e JOIN (
        SELECT visitor, SUBSTRING_INDEX(GROUP_CONCAT(country ORDER BY n DESC), ',', 1) AS country FROM (
          SELECT visitor, country, COUNT(*) AS n FROM events WHERE visitor <> '' AND country <> '' GROUP BY visitor, country) c
        GROUP BY visitor) k ON k.visitor = e.visitor
      SET e.country = k.country
      WHERE e.country = '' AND e.visitor <> ''`)
  }],
]

export async function migrate(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`)
  const [done] = await pool.query('SELECT id FROM schema_migrations')
  const applied = new Set(done.map((r) => r.id))
  for (const [id, name, run] of MIGRATIONS) {
    if (applied.has(id)) continue
    console.log(`Applying migration ${id}: ${name}`)
    await run(pool)
    // INSERT IGNORE: if two cold starts race, the second one just no-ops.
    await pool.query('INSERT IGNORE INTO schema_migrations (id, name) VALUES (?, ?)', [id, name])
  }
}
