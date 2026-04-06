CREATE TABLE users (
  id UUID PRIMARY KEY,
  user_id VARCHAR(80) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  dob DATE,
  email VARCHAR(255),
  phone VARCHAR(40),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notes (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(80) NOT NULL,
  description VARCHAR(140),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, title)
);

CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense', 'savings', 'investment')),
  amount NUMERIC(14, 2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  occurred_at TIMESTAMP NOT NULL,
  notes TEXT,
  interest_rate NUMERIC(8, 2),
  interest_type VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (interest_type IN ('simple', 'compound', 'custom', 'none')),
  custom_formula TEXT,
  expected_return NUMERIC(14, 2),
  final_amount NUMERIC(14, 2),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tags (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, name)
);

CREATE TABLE transaction_tags (
  id UUID PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  UNIQUE (transaction_id, tag_id)
);

CREATE TABLE attachments (
  id UUID PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  size_bytes BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id, occurred_at DESC);
CREATE INDEX idx_notes_user_id ON notes(user_id, created_at DESC);
CREATE INDEX idx_attachments_transaction_id ON attachments(transaction_id);
CREATE INDEX idx_transaction_tags_transaction_id ON transaction_tags(transaction_id);
