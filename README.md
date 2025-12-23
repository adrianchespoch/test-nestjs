# API


- Start up
```sh
docker compose up --build -d
```

- Browser
```sh
http://localhost:3000/api/docs
```

- Migrations

```sh
pnpm migration:generate src/migrations/initial
pnpm migration:run
```
