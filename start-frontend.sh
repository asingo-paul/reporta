#!/bin/bash

# Reporta Frontend Startup Script

echo "🚀 Starting Reporta Frontend..."
echo ""

# Check if node_modules exists
if [ ! -d "reporta-frontend/node_modules" ]; then
    echo "📦 Installing dependencies..."
    cd reporta-frontend && npm install
    cd ..
fi

# Start the frontend
echo "✨ Starting development server..."
echo "📱 Frontend will be available at: http://localhost:5173"
echo "🔌 Make sure backend API is running on: http://localhost:8080"
echo ""
echo "Press Ctrl+C to stop"
echo ""

cd reporta-frontend && npm run dev
