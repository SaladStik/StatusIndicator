# Device Setup Guide

This guide explains how to register devices and get them pinging your Status Indicator API.

Once completed you can use the relevant variables in the tray app.

## Prerequisites

- API running and accessible (via `docker-compose up -d`)
- Your `MASTER_API_KEY` from `.env` file

## Step 1: Register a New Device

Use your **Master API Key** to register each device you want to track.

### Using curl:

```bash
curl -X POST http://localhost:8000/api/v1/devices \
  -H "X-Master-Key: your-master-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{"device_name": "My Windows PC"}'
```

### Using PowerShell:

```powershell
$headers = @{
    "X-Master-Key" = "your-master-api-key-here"
    "Content-Type" = "application/json"
}

$body = @{
    device_name = "My Windows PC"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:9759/api/v1/devices" `
    -Method Post `
    -Headers $headers `
    -Body $body
```

### Response:

```json
{
  "device_id": "550e8400-e29b-41d4-a716-446655440000",
  "device_name": "My Windows PC",
  "api_key": "vXjZ9kL2mP4qR8tY3wC5nF7hB1dG6sA0",
  "created_at": "2025-11-25T10:30:00Z",
  "updated_at": "2025-11-25T10:30:00Z",
  "is_active": true
}
```

**⚠️ IMPORTANT:** Save the `api_key` immediately! It's only shown once. If you lose it, you'll need to delete the device and create a new one.

## Step 2: Save Your Device API Key

Create a config file on the device to store its API key:

**Windows:** `C:\Users\YourName\.status-indicator\config.json`
**Mac/Linux:** `~/.status-indicator/config.json`

```json
{
  "api_key": "vXjZ9kL2mP4qR8tY3wC5nF7hB1dG6sA0",
  "api_url": "http://your-server-ip:8000/api/v1/ping",
  "ping_interval_minutes": 15
}
```

## Step 3: Test the Ping

Verify the device can ping successfully:

### Using curl:

```bash
curl -X POST http://localhost:8000/api/v1/ping \
  -H "X-API-Key: vXjZ9kL2mP4qR8tY3wC5nF7hB1dG6sA0"
```

### Using PowerShell:

```powershell
$headers = @{
    "X-API-Key" = "vXjZ9kL2mP4qR8tY3wC5nF7hB1dG6sA0"
}

Invoke-RestMethod -Uri "http://localhost:8000/api/v1/ping" `
    -Method Post `
    -Headers $headers
```

### Success Response:

```json
{
  "ping_id": "123e4567-e89b-12d3-a456-426614174000",
  "device_id": "550e8400-e29b-41d4-a716-446655440000",
  "ping_timestamp": "2025-11-25T10:35:00Z",
  "message": "Ping recorded successfully"
}
```

## Step 4: Check Device Status

View your device's status (no authentication required):

```bash
# Get specific device status
curl http://localhost:8000/api/v1/status/550e8400-e29b-41d4-a716-446655440000

# Get all devices status
curl http://localhost:8000/api/v1/status

# Get list of online devices (just the names)
curl http://localhost:8000/api/v1/online
```

### Single Device Response:

```json
{
  "device_id": "550e8400-e29b-41d4-a716-446655440000",
  "device_name": "My Windows PC",
  "status": "online",
  "last_ping_at": "2025-11-25T10:35:00Z",
  "status_changed_at": "2025-11-25T10:35:00Z",
  "updated_at": "2025-11-25T10:35:00Z"
}
```

### Online Devices Response:

```json
{
  "online_count": 2,
  "online_devices": ["My MacBook Pro", "My Windows PC"]
}
```

**Status Values:**

- `online` - Device pinged within the last 20 minutes
- `offline` - No ping received for 20+ minutes

## Managing Devices

### List All Devices

```bash
curl http://localhost:8000/api/v1/devices \
  -H "X-Master-Key: your-master-api-key-here"
```

### Get Specific Device

```bash
curl http://localhost:8000/api/v1/devices/550e8400-e29b-41d4-a716-446655440000 \
  -H "X-Master-Key: your-master-api-key-here"
```

### Delete a Device

```bash
curl -X DELETE http://localhost:8000/api/v1/devices/550e8400-e29b-41d4-a716-446655440000 \
  -H "X-Master-Key: your-master-api-key-here"
```

This will delete the device and all its ping history.

## Troubleshooting

### Can't create device - 403 Forbidden

- Verify `MASTER_API_KEY` in `.env` matches your header
- Restart API after changing `.env`: `docker-compose restart api`

### Ping returns 401 Unauthorized

- Double-check the device API key (not the master key!)
- Ensure device is still active (not deleted)
- Check for extra spaces/newlines in the API key

## API Reference

| Endpoint               | Method | Auth       | Description             |
| ---------------------- | ------ | ---------- | ----------------------- |
| `/api/v1/devices`      | POST   | Master Key | Register new device     |
| `/api/v1/devices`      | GET    | Master Key | List all devices        |
| `/api/v1/devices/{id}` | GET    | Master Key | Get device details      |
| `/api/v1/devices/{id}` | DELETE | Master Key | Delete device           |
| `/api/v1/ping`         | POST   | Device Key | Send heartbeat          |
| `/api/v1/status/{id}`  | GET    | None       | Get device status       |
| `/api/v1/status`       | GET    | None       | Get all statuses        |
| `/api/v1/online`       | GET    | None       | Get online device names |
