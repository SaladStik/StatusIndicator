# Deploying Status Indicator API to CasaOS

## Prerequisites

- CasaOS server with Docker installed
- Git installed on CasaOS

## Deployment Steps

### 1. Clone the repository

```bash
cd /DATA/AppData  # or your preferred location
git clone https://github.com/SaladStik/StatusIndicator.git
cd StatusIndicator/API
```

### 3. Create the environment file

```bash
cp .env.example .env
nano .env
```

Update the following values in `.env`:

```bash
# Database
DATABASE_URL=postgresql+asyncpg://statusapi_user:statusapi_password@postgres:5432/statusapi

# Security - CHANGE THESE!
SECRET_KEY=your-secret-key-here
MASTER_API_KEY=your-master-api-key-here

# Redis
REDIS_URL=redis://redis:6379/0

# Status Monitoring
OFFLINE_THRESHOLD_MINUTES=20
STATUS_CHECK_INTERVAL_MINUTES=5

# Email Alerts (optional)
ENABLE_EMAIL_ALERTS=False
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
ALERT_EMAIL_TO=your-email@gmail.com
```

### 4. Generate secure keys

You can generate secure random keys using Python:

```bash
python3 -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(32))"
python3 -c "import secrets; print('MASTER_API_KEY=' + secrets.token_urlsafe(32))"
```

Or use OpenSSL:

```bash
openssl rand -base64 32
```

Copy these values into your `.env` file.

### 5. Build and start the Docker stack

```bash
docker-compose up -d --build
```

This will:

- Build the API container
- Start PostgreSQL database
- Start Redis cache
- Run database migrations automatically

### 6. Verify deployment

Check that all containers are running:

```bash
docker-compose ps
```

You should see:

- `status-api` - Running
- `status-postgres` - Running
- `status-redis` - Running

Check the API health:

```bash
curl http://localhost:9759/health
```

Expected response:

```json
{ "status": "healthy", "timestamp": "2025-11-25T..." }
```

### 7. View logs (if needed)

```bash
# All services
docker-compose logs -f

# Just the API
docker-compose logs -f api

# Last 100 lines
docker-compose logs --tail=100 api
```

### 8. Create your first device

Using the `MASTER_API_KEY` from your `.env` file:

```bash
curl -X POST http://localhost:9759/api/v1/devices \
  -H "X-Master-Key: your-master-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{"device_name": "My PC"}'
```

This will return a device API key. Save this key - you'll need it for the tray app.

## Updating the API

```bash
cd /DATA/AppData/StatusIndicator/API
git pull
docker-compose down
docker-compose up -d --build
```

## Troubleshooting

### Database connection errors

```bash
# Check if postgres is running
docker-compose ps postgres

# Check postgres logs
docker-compose logs postgres

# Recreate the database
docker-compose down -v
docker-compose up -d
```

### API won't start

```bash
# Check API logs
docker-compose logs api

# Common issues:
# 1. Port 9759 already in use - change in docker-compose.yml
# 2. Missing .env file - make sure it exists
# 3. Database not ready - wait 30 seconds and restart
```

### Can't access from outside

```bash
# Check if the port is exposed
docker-compose ps

# Should show: 0.0.0.0:9759->8000/tcp

# Check firewall
sudo ufw status
sudo ufw allow 9759/tcp
```

## Backup

### Database backup

```bash
docker-compose exec postgres pg_dump -U statusapi_user statusapi > backup.sql
```

### Restore backup

```bash
docker-compose exec -T postgres psql -U statusapi_user statusapi < backup.sql
```
