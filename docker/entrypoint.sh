#!/bin/sh
# Container entrypoint for the app: prepares everything a first start needs,
# so `docker compose up -d` works with zero manual steps. Every step is
# idempotent and skipped when already done.
#   1. SESSION_SECRET / JWT_SECRET: generated once, persisted in /app/data
#   2. self-signed TLS certificate for nginx in /app/ssl, if none exists
#   3. database migrations (migrations/migrate.js up); on an empty database
#      also the init seed: roles, permissions, configuration, initial admin
#   4. exec the app (CMD, default: npm start)
set -eu

DATA_DIR=/app/data
SSL_DIR=/app/ssl
mkdir -p "$DATA_DIR" "$SSL_DIR"

# --- 1. secrets ------------------------------------------------------------
SECRETS_FILE="$DATA_DIR/secrets.env"
if [ ! -s "$SECRETS_FILE" ]; then
  echo "[entrypoint] generating SESSION_SECRET / JWT_SECRET -> data/secrets.env"
  ( umask 077
    node -e 'const c=require("crypto");const r=()=>c.randomBytes(48).toString("base64url");console.log("GENERATED_SESSION_SECRET="+r());console.log("GENERATED_JWT_SECRET="+r())' > "$SECRETS_FILE" )
fi
. "$SECRETS_FILE"
# Values from .env.docker win; generated ones only fill the gaps.
export SESSION_SECRET="${SESSION_SECRET:-$GENERATED_SESSION_SECRET}"
export JWT_SECRET="${JWT_SECRET:-$GENERATED_JWT_SECRET}"

# --- 2. TLS certificate for nginx -----------------------------------------
# Older setups bind-mounted the two files individually; when they were
# missing Docker created empty DIRECTORIES with those names. Clean that up.
for f in "$SSL_DIR/nginx-selfsigned.crt" "$SSL_DIR/nginx-selfsigned.key"; do
  [ -d "$f" ] && rmdir "$f" 2>/dev/null || true
done
if [ ! -s "$SSL_DIR/nginx-selfsigned.crt" ] || [ ! -s "$SSL_DIR/nginx-selfsigned.key" ]; then
  echo "[entrypoint] no certificate in ./ssl -> generating a self-signed one (10 years)"
  openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
    -keyout "$SSL_DIR/nginx-selfsigned.key" -out "$SSL_DIR/nginx-selfsigned.crt" \
    -subj "/O=OpenASM/CN=${SSL_COMMON_NAME:-localhost}" \
    -addext "subjectAltName=DNS:${SSL_COMMON_NAME:-localhost},IP:127.0.0.1" 2>/dev/null
  chmod 600 "$SSL_DIR/nginx-selfsigned.key"
  chmod 644 "$SSL_DIR/nginx-selfsigned.crt"
fi

# --- 3. database ------------------------------------------------------------
export INITIAL_ADMIN_PASSWORD_FILE="${INITIAL_ADMIN_PASSWORD_FILE:-$DATA_DIR/initial-admin-password.txt}"
node migrations/migrate.js up

# --- 4. app -------------------------------------------------------------------
exec "$@"
