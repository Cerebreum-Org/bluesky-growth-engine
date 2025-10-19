# Proxy-Based IP Rotation Setup

## ⚠️ Important Warnings

- This may violate Bluesky's Terms of Service
- Use at your own risk - accounts could be banned
- Consider requesting official API access first

## Setup Options

### Option 1: Residential Proxy Services (Recommended)

**Bright Data** (formerly Luminati)
- Cost: ~$500/month for 20GB
- Rotating residential IPs
- Dashboard: brightdata.com

**Smartproxy**
- Cost: ~$75/month for 5GB
- 40M+ residential IPs
- Dashboard: smartproxy.com

**Webshare**
- Cost: ~$250/month for 50GB
- Datacenter + residential mix
- Dashboard: webshare.io

### Option 2: Multiple VPS Instances (Cheaper)

**DigitalOcean/Linode/Vultr**
- Cost: $5/month per instance
- Deploy 5-10 instances in different regions
- Each gets unique IP

## Implementation

### With Proxy Service

1. Install dependency:
```bash
npm install https-proxy-agent
```

2. Add proxies to `.env`:
```bash
# Format: http://username:password@host:port
PROXY_LIST="http://user:pass@gate.smartproxy.com:10000,http://user:pass@gate.smartproxy.com:10001,http://user:pass@gate.smartproxy.com:10002"

# OR for rotating proxies (single endpoint that rotates):
PROXY_LIST="http://user:pass@rotating.proxy.com:8000"
```

3. Run:
```bash
npx tsx src/proxy-collector.ts
```

### With Multiple VPS Instances

1. **Deploy collector to multiple servers:**
```bash
# On each VPS, clone your repo
git clone https://github.com/your-repo/bluesky-growth-engine
cd bluesky-growth-engine
npm install

# Set environment variables
echo "BLUESKY_HANDLE=your_handle" >> .env
echo "BLUESKY_PASSWORD=your_password" >> .env
# Add Supabase credentials
```

2. **Distribute user ranges:**
```bash
# Server 1: Users 0-999
npx tsx src/range-collector.ts 0 999

# Server 2: Users 1000-1999
npx tsx src/range-collector.ts 1000 1999

# Server 3: Users 2000-2999
npx tsx src/range-collector.ts 2000 2999
```

3. **Create range collector:**
```bash
# Copy engagement-collector.ts and modify to accept start/end range
# See src/range-collector.ts (to be created)
```

## Testing Proxy Setup

Test if proxies work:
```bash
node -e "
const { HttpsProxyAgent } = require('https-proxy-agent');
const proxy = 'http://user:pass@proxy.com:port';
const agent = new HttpsProxyAgent(proxy);
fetch('https://api.ipify.org?format=json', { agent })
  .then(r => r.json())
  .then(d => console.log('IP:', d.ip));
"
```

## Cost Comparison

**Single IP (optimized):**
- Speed: ~30 users/minute
- Cost: $0/month
- Risk: Medium rate limiting

**3 Proxies:**
- Speed: ~90 users/minute (3x)
- Cost: ~$100-500/month
- Risk: Lower rate limiting

**10 VPS Instances:**
- Speed: ~300 users/minute (10x)
- Cost: ~$50/month
- Risk: Very low rate limiting

## Recommended Approach

1. **Start with optimized single-IP** (free)
2. **If rate limited, add 3-5 proxies** (~$100/month)
3. **For massive scale, use VPS cluster** (~$50-100/month)

## Alternative: Official Access

Contact Bluesky for:
- Research API access
- Higher rate limits
- Firehose access (real-time stream)
- Email: api@bsky.app
