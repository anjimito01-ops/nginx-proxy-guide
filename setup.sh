#!/bin/bash
set -euo pipefail

# Load environment
if [ ! -f .env ]; then
  echo "Error: .env file not found. Copy .env.example to .env and edit it."
  exit 1
fi
source .env

SSL_DIR="nginx/ssl"

# Generate self-signed certificate if none exists
if [ ! -f "${SSL_DIR}/server.crt" ] || [ ! -f "${SSL_DIR}/server.key" ]; then
  echo "Generating self-signed SSL certificate for ${KC_HOSTNAME}..."
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "${SSL_DIR}/server.key" \
    -out "${SSL_DIR}/server.crt" \
    -subj "/CN=${KC_HOSTNAME}/O=Keycloak/C=JP" \
    -addext "subjectAltName=DNS:${KC_HOSTNAME},IP:127.0.0.1"
  echo "Certificate generated: ${SSL_DIR}/server.crt"
fi

# Substitute KC_HOSTNAME in nginx.conf
export KC_HOSTNAME
envsubst '${KC_HOSTNAME}' < nginx/nginx.conf > nginx/nginx.conf.rendered
mv nginx/nginx.conf.rendered nginx/nginx.conf

echo "Starting services..."
docker compose up -d

echo ""
echo "Keycloak is starting at https://${KC_HOSTNAME}"
echo "Admin console: https://${KC_HOSTNAME}/admin"
echo "Admin user:    ${KEYCLOAK_ADMIN}"
echo ""
echo "It may take 1-2 minutes for Keycloak to be fully ready."
echo "Check status: docker compose ps"
echo "Check logs:   docker compose logs -f keycloak"
