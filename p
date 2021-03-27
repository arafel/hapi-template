#!/bin/sh
case "$1" in
  server)
    psql "postgres://postgres:postgres@localhost:5432/"
    ;;
  dev)
    psql "postgres://postgres:postgres@localhost:5432/"
    ;;
  test)
    psql "postgres://postgres:postgres@localhost:5432/"
    ;;
  *)
    echo "No database URL for $1"
    ;;
esac
