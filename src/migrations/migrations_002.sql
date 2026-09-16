CREATE TABLE art (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id TEXT NOT NULL UNIQUE, 
    url TEXT NOT NULL,
    title TEXT, 
    year INT,
    medium TEXT,
    width INT NOT NULL, 
    height INT NOT NULL, 
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);