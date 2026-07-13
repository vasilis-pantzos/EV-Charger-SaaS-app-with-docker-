#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "Starting deployment..."

# 1. Setup Docker Network
echo "Checking for shared-api-network..."
if ! docker network ls | grep -q "shared-api-network"; then
  docker network create shared-api-network
  echo "Network 'shared-api-network' created."
else
  echo "Network 'shared-api-network' already exists. Skipping."
fi

# 2. Define backend services
SERVICES=(
  "orchestrator-service"
  "reservation-service"
  "search_service"
  "registration-service"
  "provider-statistics-service"
  "statistics-service"
  "invoice-service"
)

# 3. Build and spin up backend services
echo "Building and starting backend microservices..."
for SERVICE in "${SERVICES[@]}"; do
  echo "Starting $SERVICE..."
  docker compose -f "$SERVICE/docker-compose.yaml" up -d --build
done

echo "All backend services are up and running in the background."

# 4. Setup and start frontend
echo "Setting up frontend dependencies..."
cd frontend
npm install

echo "Starting frontend development server..."
# Note: This will run in the foreground and attach to your terminal
npm run dev