CREATE TABLE user_state (
  user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  state jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
