#!/bin/bash
# AWS EC2 Production Deployment & Provisioning Script
# Designed for Ubuntu 22.04 LTS

set -e

echo "========================================================="
echo "🚀 Starting Valkey E-commerce Stack Provisioning on EC2..."
echo "========================================================="

# 1. Update system packages
echo "📦 Updating system packages..."
sudo apt-get update -y
sudo apt-get upgrade -y

# 2. Install Docker & Docker Compose
echo "🐳 Installing Docker & Docker Compose..."
sudo apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release

# Add Docker’s official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Enable Docker service
sudo systemctl enable docker
sudo systemctl start docker

# Add current user to docker group
sudo usermod -aG docker $USER

# 3. Install Nginx & Certbot
echo "🌐 Installing Nginx & Certbot for SSL/HTTPS..."
sudo apt-get install -y nginx certbot python3-certbot-nginx

# 4. Configure Nginx Reverse Proxy
echo "⚙️ Creating Nginx configuration..."
cat << 'EOF' | sudo tee /etc/nginx/sites-available/valkey-ecommerce
server {
    listen 80;
    server_name _; # Change to domain name in production

    # Frontend Proxy
    location / {
        proxy_pass http://localhost:3000; # Points to Frontend Docker Container port
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API Proxy
    location /api {
        proxy_pass http://localhost:5000; # Points to Backend Express Container port
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Prometheus Proxy
    location /prometheus {
        proxy_pass http://localhost:9090;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Grafana Proxy
    location /grafana {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

# Activate Nginx site config
sudo ln -sf /etc/nginx/sites-available/valkey-ecommerce /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Restart Nginx
sudo systemctl restart nginx

echo "========================================================="
echo "✅ Provisioning Complete!"
echo "To build and start the application container stack, run:"
echo "   docker compose up -d --build"
echo "========================================================="
