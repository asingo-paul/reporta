#!/bin/bash

# Reporta Database Migrations Runner
# This script runs the database migrations for Reporta

set -e

echo "🗄️  Reporta Database Migrations"
echo "================================"
echo ""

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create a .env file from .env.example"
    exit 1
fi

# Load environment variables
source .env

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL not set in .env file!"
    exit 1
fi

echo "📊 Database: $DATABASE_URL"
echo ""

# Check if sqlx-cli is installed
if ! command -v sqlx &> /dev/null; then
    echo "📦 Installing sqlx-cli..."
    cargo install sqlx-cli --no-default-features --features postgres
    echo ""
fi

echo "🚀 Running migrations..."
echo ""

# Run migrations
cd migrations
sqlx migrate run --database-url "$DATABASE_URL"

echo ""
echo "✅ Migrations completed successfully!"
echo ""
echo "Database schema is now up to date."
