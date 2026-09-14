CREATE TABLE spotify_cache (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind text NOT NULL,
    spotify_id text NOT NULL,
    name text NOT NULL,
    image_url text,
    metadata jsonb,
    fetched_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (kind, spotify_id)
)  