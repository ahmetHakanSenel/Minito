-- Per-IP rate limiting on top of the per-user quota, so one address cannot farm free
-- accounts to multiply its AI budget. Only an HMAC of the IP is stored, never the address.
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS client_ip_hash TEXT;

CREATE INDEX IF NOT EXISTS tasks_ip_created_idx ON tasks (client_ip_hash, created_at);
