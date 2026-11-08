# Despliegue en producción (plantilla)

Cada merge a `main` se despliega solo en el servidor: GitHub Actions ejecuta CI, construye las imágenes, las sube a GHCR y actualiza un stack de Docker Swarm por SSH a través de Tailscale. Este documento sirve de runbook de este proyecto y de plantilla para otros (sección 9).

## 1. Arquitectura

```
push a main ─► GitHub Actions
                1. CI: lint, tests, build, audit, gitleaks, build de imágenes
                2. Build + push a ghcr.io/ariasbenraq/movilidad-{backend,frontend}:<sha>
                3. El runner se une a la tailnet (tag:ci, nodo efímero)
                4. scp de docker-stack.yml y deploy.sh ─► ssh deploy@servidor "deploy.sh <sha>"
                5. deploy.sh: migraciones ─► docker stack deploy ─► espera de salud ─► rollback si falla

Internet ─► Cloudflare ─► cloudflared ─► Caddy (http, red "edge")
                                         ├─ /api/ingest*  ─► 404 (nunca público)
                                         ├─ /api/*        ─► mov-api:3000  (se quita el prefijo /api)
                                         └─ /             ─► mov-web:8080  (nginx, SPA)

n8n ──(red "edge")──► http://mov-api:3000/ingest      (no pasa por internet)
mov-api ──(red "movilidad_internal")──► postgres, redis (sin puertos publicados)
```

Archivos del repositorio:

| Archivo | Para qué |
|---|---|
| `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf` | Imágenes de producción (usuario sin privilegios, healthcheck) |
| `backend/src/database/run-migrations.ts` | Migraciones desde el código compilado (`npm run migration:run:prod`) |
| `deploy/docker-stack.yml` | Stack de Swarm: postgres, redis, mov-api, mov-web |
| `deploy/deploy.sh` | Lo que corre en el servidor en cada deploy |
| `deploy/production.env.example` | Plantilla del `.env` del servidor |
| `.github/workflows/ci.yml`, `deploy.yml` | CI en PRs y deploy en `main` |
| `.github/dependabot.yml` | Actualizaciones semanales |

## 2. Preparación única (la hace el dueño)

### 2.1 Usuario `deploy` en el servidor
```bash
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy      # equivale a root: la clave solo vive en GitHub
sudo install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
sudo install -d -m 755 -o deploy -g deploy /opt/movilidad
```
Clave SSH dedicada (se genera en una carpeta temporal y se borra al terminar):
```bash
ssh-keygen -t ed25519 -N "" -C "github-actions-movilidad" -f ./deploy_movilidad
sudo tee /home/deploy/.ssh/authorized_keys < deploy_movilidad.pub
sudo chown deploy:deploy /home/deploy/.ssh/authorized_keys && sudo chmod 600 /home/deploy/.ssh/authorized_keys
cat deploy_movilidad          # copiar completo (con BEGIN y END) al secret DEPLOY_SSH_KEY
shred -u deploy_movilidad deploy_movilidad.pub
```
Login de GHCR como `deploy`, con un PAT clásico que solo tenga `read:packages`:
```bash
sudo -iu deploy
echo "<PAT>" | docker login ghcr.io -u ariasbenraq --password-stdin
```

### 2.2 Tailscale
En *Access controls* (formato `grants`): `tagOwners` con `tag:ci`, `autogroup:member → *` para tus dispositivos y `tag:ci → <ip del servidor> tcp:22` para CI. Después, *Settings → OAuth clients* con scope `auth_keys` y tag `tag:ci`.

### 2.3 Secrets en GitHub (*Settings → Secrets and variables → Actions*)

| Secret | Valor |
|---|---|
| `DEPLOY_SSH_KEY` | Clave privada de 2.1 |
| `DEPLOY_KNOWN_HOSTS` | Salida de `ssh-keyscan -H <ip tailscale del servidor>` |
| `DEPLOY_HOST` | IP de Tailscale del servidor (`100.100.82.79`) |
| `DEPLOY_USER` | `deploy` |
| `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET` | Del OAuth client de Tailscale |

Además: crear el Environment `production` (con aprobación manual si se quiere) y proteger `main` (PR obligatorio y CI en verde).

### 2.4 `.env` del servidor
Se crea una sola vez, desde tu usuario administrador (con `sudo`), no como `deploy`. Los secretos se generan en el momento y no se ven en pantalla.

```bash
sudo install -m 600 -o deploy -g deploy /dev/null /opt/movilidad/.env
sudo tee /opt/movilidad/.env >/dev/null <<EOF
NODE_ENV=production
PORT=3000
DB_HOST=postgres
DB_PORT=5432
DB_USER=movilidad
DB_PASSWORD=$(openssl rand -hex 24)
DB_NAME=movilidad
REDIS_HOST=redis
REDIS_PORT=6379
INGEST_API_KEY=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)
CORS_ORIGIN=https://movilidades.hamstitors.trade
TRUST_PROXY=true
ORS_API_KEY=
EOF
```

El comando se ejecuta **una vez**: repetirlo regenera los secretos y `DB_PASSWORD` dejaría de coincidir con la que Postgres guardó al crear su volumen. Para cambiar un valor después: `sudo nano /opt/movilidad/.env` y editar solo esa línea. **Nunca pegues el comando `sudo tee` ni la línea `EOF` dentro del archivo**: el archivo solo contiene líneas `CLAVE=valor`.

Comprobación sin mostrar secretos. La primera orden no debe imprimir nada; la segunda debe mostrar `-rw------- … deploy deploy`; la tercera, largos de 64:
```bash
sudo grep -n -v -E '^[[:space:]]*(#.*)?$|^[A-Za-z_][A-Za-z0-9_]*=[^[:space:]"'"'"'$`\\]*$' /opt/movilidad/.env
sudo ls -l /opt/movilidad/.env
sudo awk -F= '/^(INGEST_API_KEY|JWT_SECRET)=/{print $1, length($2)}' /opt/movilidad/.env
```

Reglas: sin comillas, espacios, `$` ni barras invertidas en los valores (usa secretos hexadecimales). `deploy.sh` no ejecuta este archivo: lo valida y, si una línea no cumple, solo informa su número, sin mostrar el contenido. `INGEST_API_KEY` también se copia a la credencial de n8n (sección 3).

### 2.5 Cloudflare
*Zero Trust → Networks → Tunnels → tu túnel → Public hostnames*: añadir `movilidades.hamstitors.trade` → HTTP → `caddy:80`, igual que los demás sitios. Cloudflare crea el DNS.

### 2.6 Caddy (`/opt/infra/caddy/Caddyfile`)
Añadir el sitio:
```
http://movilidades.hamstitors.trade {
    handle /api/ingest* {
        respond "Not found" 404
    }
    handle /api/* {
        uri strip_prefix /api
        reverse_proxy mov-api:3000
    }
    handle {
        reverse_proxy mov-web:8080
    }
}
```
Y en `hooks.hamstitors.trade`, permitir también la ruta del webhook de este proyecto (Apps Script envía a `/webhook/movilidad`):
```
@ingesta {
    method POST
    path /webhook/consumos-bcp /webhook/movilidad
}
```
Aplicar con `docker exec caddy caddy reload --config /etc/caddy/Caddyfile`. Hasta el primer deploy `mov-api` y `mov-web` no existen y el sitio dará 502; los demás no se ven afectados.

## 3. Primera puesta en marcha

1. Lanzar *Actions → Deploy → Run workflow* sobre `main` (o hacer un merge).
2. Comprobar `https://movilidades.hamstitors.trade/api/health` → `{"status":"ok","db":"up","redis":"up"}`.
3. Crear el usuario (pide la contraseña sin mostrarla):
   ```bash
   docker exec -it $(docker ps -q -f label=com.docker.swarm.service.name=movilidad_mov-api) node dist/cli/user-create.js
   ```
4. Entrar en la web y comprobar en las herramientas del navegador que la cookie `session` es `Secure` y `HttpOnly`.
5. Comprobar que `https://movilidades.hamstitors.trade/api/ingest` responde 404 desde fuera.
6. En n8n, tras importar `n8n/workflow.json`, cambiar la URL del nodo `POST /ingest` (trae un placeholder) a `http://mov-api:3000/ingest` y poner la `x-api-key` real en su credencial. Ver `docs/spec.md`, sección 5.
7. En Apps Script: `WEBHOOK_URL=https://hooks.hamstitors.trade/webhook/movilidad`.
8. Reprocesar el histórico de Gmail según `docs/decisiones.md`.
9. Probar un rollback a propósito (sección 5).

## 4. Qué hace cada deploy

`deploy.sh <sha>` (valida que sea un SHA de 40 hex):

1. Descarga las dos imágenes (si no existen, falla antes de tocar nada).
2. Si Postgres ya corre, **aplica las migraciones antes** de actualizar. Si fallan, no se despliega nada.
3. `docker stack deploy`: actualización continua con `start-first` (la versión nueva arranca y debe pasar su healthcheck antes de retirar la vieja).
4. Primer deploy: espera a Postgres y migra después.
5. Espera a que `mov-api` y `mov-web` estén sanos. Si Swarm revierte uno (`failure_action: rollback`), el script revierte también el otro, sale con error y el workflow queda en rojo.
6. Guarda `.current_tag` / `.previous_tag` y borra imágenes antiguas (conserva las 4 últimas de cada repositorio).

**Regla de oro:** las migraciones se aplican antes que el código nuevo y el rollback no las deshace. Cada migración debe ser compatible con la versión anterior del código (añadir antes de quitar; borrar columnas en un deploy posterior).

## 5. Rollback manual

Volver a la versión anterior (las últimas 4 imágenes siguen en el servidor):
```bash
ssh deploy@100.100.82.79
cd /opt/movilidad && bash deploy.sh "$(cat .previous_tag)"
```
Un rollback rápido de un solo servicio, sin tocar la base de datos: `docker service rollback movilidad_mov-api`.

## 6. Backups de Postgres

Backup diario (cron del usuario `deploy`, retención de 14 días; copiar también fuera del servidor, por ejemplo al NAS):
```bash
mkdir -p /opt/movilidad/backups
# crontab -e  (usuario deploy)
30 3 * * * docker exec $(docker ps -q -f label=com.docker.swarm.service.name=movilidad_postgres) sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > /opt/movilidad/backups/movilidad-$(date +\%F).dump && find /opt/movilidad/backups -name '*.dump' -mtime +14 -delete
```
Restaurar: `docker exec -i <contenedor postgres> pg_restore -U <user> -d <db> --clean --if-exists < archivo.dump`. Probar una restauración en un entorno de prueba al menos una vez.

## 7. Operación

- Estado: `docker stack services movilidad`, `docker service ps movilidad_mov-api --no-trunc`.
- Logs: `docker service logs -f movilidad_mov-api` (rotan a 3 × 10 MB). El backend no registra cuerpos de `/ingest`, contraseñas, tokens ni direcciones.
- Actualizar dependencias: Dependabot abre PRs semanales; el CI los valida.
- Monitorización: apuntar un chequeo externo (Uptime Kuma, UptimeRobot) a `/api/health`.
- Seguridad: ningún puerto publicado por el stack; `/ingest` solo es alcanzable desde n8n; la clave de CI solo llega al puerto 22 del servidor.

## 8. Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `error in libcrypto` o `invalid format` en el paso SSH | `DEPLOY_SSH_KEY` incompleto: pegar de nuevo con las líneas BEGIN y END |
| `Host key verification failed` | `DEPLOY_KNOWN_HOSTS` vacío o de otra IP: repetir `ssh-keyscan -H` |
| Timeout al conectar por SSH | La política de Tailscale no permite `tag:ci → servidor:22`, o el OAuth client no tiene el tag |
| `denied` / `unauthorized` al hacer pull | Falta `docker login ghcr.io` como usuario `deploy`, o el PAT caducó |
| El deploy falla y el sitio sigue en la versión anterior | Es el comportamiento esperado. Ver el informe al final del log del paso *Deploy* |
| 502 en el dominio | `mov-api`/`mov-web` no están en la red `edge` o no están sanos: `docker service ps` |
| `Invalid .env: line(s) N are not KEY=VALUE` en el paso *Deploy* | La línea N de `/opt/movilidad/.env` no tiene el formato `CLAVE=valor` (texto pegado, comillas, espacios o `$`). Corregirla con `sudo nano` y relanzar el workflow |
| El backend no arranca ("Invalid environment configuration") | Falta una variable en `/opt/movilidad/.env` o `INGEST_API_KEY`/`JWT_SECRET` tienen menos de 32 caracteres |
| Cambié el `.env` y no se aplica | Las variables se leen al desplegar: lanzar un deploy (o `docker service update --force movilidad_mov-api`) |

## 9. Reutilizar esta plantilla en otro proyecto

Copiar `deploy/`, `.github/`, los Dockerfiles y este documento, y cambiar:

| Qué | Dónde |
|---|---|
| Nombre del stack (`movilidad`) | `deploy.sh` (`STACK`), nombres de servicio en `docker-stack.yml`, rutas del servidor |
| Nombres de servicio expuestos en `edge` (`mov-api`, `mov-web`) | `docker-stack.yml` y el Caddyfile. Deben ser únicos en la red compartida |
| Registro e imágenes (`ghcr.io/ariasbenraq/movilidad-*`) | `docker-stack.yml`, `deploy.sh`, `deploy.yml` (`REGISTRY`) |
| Dominio | Túnel de Cloudflare, Caddyfile, `CORS_ORIGIN` |
| Puertos internos (3000 API, 8080 web) | Dockerfiles, Caddyfile |
| Comando de migraciones y ruta de `/health` | `deploy.sh` (`migrate`), healthchecks de los Dockerfiles |
| Secrets de GitHub | Los mismos nombres; cambiar valores si es otro servidor |

Lo que no cambia: el flujo CI → imágenes → Tailscale → SSH → `deploy.sh`, la política de la tailnet para `tag:ci`, el usuario `deploy` y la clave dedicada.
