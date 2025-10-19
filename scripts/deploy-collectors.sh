#!/bin/bash
# Deploy multiple collectors across DigitalOcean droplets

set -e

NUM_SERVERS=${1:-5}  # Default: 5 servers
REGION="nyc3"         # New York datacenter
SIZE="s-1vcpu-1gb"    # $6/month droplet

echo "🚀 Deploying $NUM_SERVERS collector servers..."
echo ""

# Check if doctl is installed
if ! command -v doctl &> /dev/null; then
    echo "❌ doctl not installed. Run: bash scripts/setup-digitalocean.sh"
    exit 1
fi

# Check auth
if ! doctl account get &> /dev/null; then
    echo "❌ Not authenticated. Run: doctl auth init"
    exit 1
fi

# Get SSH key ID
SSH_KEY_ID=$(doctl compute ssh-key list --format ID --no-header | head -n1)
if [ -z "$SSH_KEY_ID" ]; then
    echo "❌ No SSH keys found. Add one at: https://cloud.digitalocean.com/account/security"
    exit 1
fi

echo "✓ Using SSH key ID: $SSH_KEY_ID"
echo ""

# Create droplets
DROPLET_IDS=()
for i in $(seq 1 $NUM_SERVERS); do
    NAME="bluesky-collector-$i"
    echo "Creating droplet: $NAME..."
    
    DROPLET_ID=$(doctl compute droplet create "$NAME" \
        --region "$REGION" \
        --size "$SIZE" \
        --image ubuntu-22-04-x64 \
        --ssh-keys "$SSH_KEY_ID" \
        --wait \
        --format ID \
        --no-header)
    
    DROPLET_IDS+=($DROPLET_ID)
    echo "✓ Created droplet $NAME (ID: $DROPLET_ID)"
done

echo ""
echo "⏳ Waiting 30s for droplets to fully boot..."
sleep 30

# Get IPs and save to file
echo "" > scripts/collector-ips.txt
for ID in "${DROPLET_IDS[@]}"; do
    IP=$(doctl compute droplet get "$ID" --format PublicIPv4 --no-header)
    echo "$IP" >> scripts/collector-ips.txt
    echo "✓ Server IP: $IP"
done

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║              SERVERS CREATED SUCCESSFULLY                 ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "1. Deploy code: bash scripts/deploy-code.sh"
echo "2. Start collectors: bash scripts/start-collectors.sh"
echo ""
echo "IPs saved to: scripts/collector-ips.txt"
echo "Monthly cost: \$$(echo "$NUM_SERVERS * 6" | bc)"
