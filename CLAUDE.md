# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

This repository is a guide and reference for configuring Nginx as a reverse proxy. It is expected to contain Nginx configuration examples, Docker Compose setups, and documentation covering common proxy patterns (SSL termination, load balancing, WebSocket proxying, etc.).

## Repository State

This repository is currently empty. This CLAUDE.md should be updated as content is added.

## Intended Structure

As the project grows, content should follow this layout:

```
nginx-proxy-guide/
├── configs/          # Reusable Nginx config snippets and full examples
├── docker/           # Docker and Docker Compose files for running examples
├── docs/             # Written guides and explanations
└── scripts/          # Helper shell scripts for setup or testing
```

## Conventions

- Nginx config files use `.conf` extension and follow standard Nginx block syntax.
- Docker Compose files target Compose v2+ syntax (no `version:` key).
- Shell scripts must be POSIX-compatible unless a specific shell (e.g., bash) is declared in the shebang.
- Documentation is written in Markdown.

## Working with Nginx Configs

Validate a config file before deploying:

```bash
nginx -t -c /path/to/nginx.conf
```

When Docker is used, reload config without downtime:

```bash
docker exec <container> nginx -s reload
```

## Working with Docker Examples

Bring up an example stack:

```bash
docker compose -f docker/<example>/docker-compose.yml up -d
```

Tear it down:

```bash
docker compose -f docker/<example>/docker-compose.yml down
```
