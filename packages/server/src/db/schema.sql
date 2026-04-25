-- Users: registered accounts with username + hashed password
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Auth tokens: bearer tokens used for publish/org access
-- Tokens are stored as SHA-256 hashes; only the raw value is returned at creation time.
CREATE TABLE IF NOT EXISTS auth_tokens (
  id          SERIAL PRIMARY KEY,
  token_hash  TEXT UNIQUE NOT NULL,
  user_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org         TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  expires_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS auth_tokens_user_id_idx ON auth_tokens(user_id);
