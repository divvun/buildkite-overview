#!/bin/bash

# Fix permissions for mounted volumes
chown -R www-data:www-data /var/log/modsecurity /var/cache/modsecurity /tmp/modsecurity
chmod 2775 /var/log/modsecurity /var/cache/modsecurity /tmp/modsecurity

# Execute the original command
exec "$@"