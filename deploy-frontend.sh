#!/bin/bash

echo "🚀 Bluesky Growth Engine - Frontend Deployment Guide"
echo "=================================================="
echo ""

# Check if we're in the right directory
if [ ! -f "frontend/package.json" ]; then
    echo "❌ Please run this script from the root project directory"
    exit 1
fi

echo "📋 Pre-deployment Checklist:"
echo ""
echo "1. ✅ Frontend built successfully"
echo "2. ⚠️  Database connectivity needs attention"
echo ""

echo "🔧 Next Steps Required:"
echo ""
echo "CRITICAL: Your current setup uses a local Supabase instance (172.27.171.67:8000)"
echo "This won't work for public deployment. You need to:"
echo ""
echo "Option A - Supabase Cloud (Recommended):"
echo "  1. Go to https://supabase.com and create a new project"
echo "  2. Copy your database schema from local to cloud"
echo "  3. Update environment variables with cloud credentials"
echo ""
echo "Option B - Expose Local Database:"
echo "  1. Set up a reverse proxy (ngrok, cloudflared, etc.)"
echo "  2. Expose port 8000 publicly (security risks!)"
echo ""

echo "🌐 Deployment Options:"
echo ""
echo "1. Vercel (Recommended):"
echo "   - Install Vercel CLI: npm i -g vercel"
echo "   - Run: cd frontend && vercel"
echo "   - Add env vars in Vercel dashboard"
echo ""
echo "2. Netlify:"
echo "   - Install Netlify CLI: npm i -g netlify-cli"
echo "   - Run: cd frontend && netlify deploy --prod"
echo ""
echo "3. Railway/Render/Fly.io:"
echo "   - Connect your GitHub repo"
echo "   - Set build command: cd frontend && npm run build"
echo "   - Set start command: cd frontend && npm start"
echo ""

echo "📝 Environment Variables Needed:"
echo "NEXT_PUBLIC_SUPABASE_URL=your-public-supabase-url"
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-supabase-key"
echo ""

echo "🔍 To test locally first:"
echo "cd frontend && npm run dev"
echo "Open http://localhost:3000"
echo ""

echo "Would you like to:"
echo "1. Set up Supabase Cloud project"
echo "2. Deploy to Vercel now (requires cloud DB)"
echo "3. Test locally first"
echo ""

read -p "Enter choice (1/2/3): " choice

case $choice in
    1)
        echo "Opening Supabase..."
        xdg-open "https://supabase.com/dashboard" 2>/dev/null || open "https://supabase.com/dashboard" 2>/dev/null || echo "Please visit: https://supabase.com/dashboard"
        ;;
    2)
        if command -v vercel &> /dev/null; then
            echo "Deploying to Vercel..."
            cd frontend && vercel
        else
            echo "Installing Vercel CLI..."
            npm i -g vercel
            cd frontend && vercel
        fi
        ;;
    3)
        echo "Starting local development server..."
        cd frontend && npm run dev
        ;;
    *)
        echo "Invalid choice. Run this script again when ready."
        ;;
esac