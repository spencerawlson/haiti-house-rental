# Deploy Kay Ayiti to kayayiti.app (FedServ + Cloudflare Tunnel)

## What runs where

- App: Docker container `kayayiti-web`, host port **8097** → container 3000.
- Database: Docker container `kayayiti-db` (Postgres 16), data in the
  `kayayiti-pgdata` volume — accounts, listings, chats, visits, revenue
  and payment numbers survive restarts and rebuilds. The database port is
  NOT published: only the app container can reach it.
- Domain: **kayayiti.app**, on Cloudflare (already on Cloudflare nameservers).
- Tunnel: Cloudflare Tunnel on FedServ routes kayayiti.app → `http://localhost:8097`.
- Old warning, now retired: before Postgres, all data lived in container
  memory and a restart wiped everything. That was the Oct 21 account loss.
  After this migration, a restart or rebuild keeps everything.

## 1. On FedServ — build and run

```sh
mkdir -p /opt/kayayiti && cd /opt/kayayiti
git clone https://github.com/spencerawlson/haiti-house-rental.git
cd haiti-house-rental
export ADMIN_PASSWORD='a-strong-password-you-choose'
docker compose up -d --build
curl -s http://localhost:8097/ht | head -c 200
```

`ADMIN_PASSWORD` is the admin-area password (Admin Board login). It lives
only in the server environment — never in the repo. Without it, the admin
area stays closed.

The first `docker compose up` also starts Postgres (`kayayiti-db`) and the
app creates its tables and seeds the 7 demo listings automatically. Check
the database came up with the app:

```sh
curl -s http://localhost:8097/api/health
# {"ok":true,"db":"up"}
```

To back up the database (do this before any risky change):

```sh
docker compose exec db pg_dump -U kayayiti kayayiti > kayayiti-backup.sql
```

To restore it:

```sh
docker compose exec -T db psql -U kayayiti kayayiti < kayayiti-backup.sql
```

## 2. Cloudflare Tunnel — point the domain at the app

In the Cloudflare dashboard (the kayayiti.app zone):

1. Create (or reuse) a tunnel on the FedServ host (`cloudflared`).
2. Add a public hostname: `kayayiti.app` → `http://localhost:8097`.
3. Wait for DNS to propagate, then open https://kayayiti.app — the
   language picker should appear.

No A record is needed: the tunnel's CNAME is the DNS entry.

## 3. After launch — first checks

1. Create a landlord account, send the 1000 HTG test transfer, activate it
   from the Admin Board (log in with `ADMIN_PASSWORD`).
2. Set the MonCash (Digicel) and NatCash (Natcom) destination numbers on
   the Admin Board.
3. Create a tenant account (free, active immediately) and schedule a test
   visit.

## Updating later

```sh
cd /opt/kayayiti/haiti-house-rental
git pull
docker compose up -d --build
curl -s http://localhost:8097/api/health
```

Data now survives rebuilds (Postgres volume). The one thing a rebuild
still cannot bring back is data created before the Postgres migration —
that lived in container memory and is already gone.
