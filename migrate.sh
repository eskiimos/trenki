#!/bin/bash

echo "🚀 Starting migration process..."

# Step 1: Generate Prisma Client
echo "📦 Generating Prisma client..."
npx prisma generate

# Step 2: Create migration
echo "🔄 Creating database migration..."
npx prisma migrate dev --name add_workout_session_video

echo "✅ Migration completed!"
echo ""
echo "Next steps:"
echo "1. Restart your dev server"
echo "2. Test workout generation flow"
echo "3. Check that workouts are saved in database"
