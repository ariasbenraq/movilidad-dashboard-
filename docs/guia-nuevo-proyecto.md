# Guía: desplegar un proyecto nuevo con integración continua

Pensada para tu contexto: un servidor Debian (`nas-lab`) con Docker Swarm, Portainer, Tailscale y Caddy; dominios en Cloudflare con túnel; código en tu cuenta personal de GitHub. Todo lo de esta guía salió de desplegar `movilidad-dashboard` y está probado ahí.

**Resultado:** cada merge a `main` pasa el CI, construye las imágenes, las sube a GHCR y actualiza el servidor solo, con migraciones, espera de salud y rollback automático.

## 1. Cómo funciona

```
tú ─► rama ─► Pull Request ─► CI (lint, tests, build, audit, gitleaks, build de imágenes)
                                  │ en verde
                                  ▼
                               merge a main ─► CI otra vez ─► build + push a ghcr.io/ariasbenraq/<app>-*:<sha>
                                  ─► el runner entra a tu tailnet (tag:ci) ─► SSH a nas-lab (usuario deploy)
                                  ─► deploy.sh <sha>: migrar ─► docker stack deploy ─► esperar salud ─► rollback si falla

Internet ─► Cloudflare ─► cloudflared ─► Caddy (http, red "edge") ─► <prefijo>-web / <prefijo>-api
```

Tres piezas se tocan en cada proyecto nuevo y las tres hay que acordarse de ellas: **Cloudflare** (ruta del túnel + DNS), **Caddy** (bloque del sitio) y **GitHub** (secrets).

## 2. Qué ya está hecho y qué es por proyecto

| Una sola vez (ya hecho, no repetir) | Por cada proyecto |
|---|---|
| Usuario `deploy` en `nas-lab` y su clave SSH | Carpeta `/opt/<app>` y su `.env` en el servidor |
| `docker login ghcr.io` como `deploy` (PAT `read:packages`) | Fila del túnel en Cloudflare |
| Política de Tailscale con `tag:ci` → `nas-lab:22` | Bloque en el `Caddyfile` |
| OAuth client de Tailscale (`tag:ci`) | Los **6 secrets** en el repo nuevo (se reutilizan los mismos valores) |
| Red `edge`, Caddy, `cloudflared` | Environment `production` en el repo |
| | Los archivos del kit (`scaffold.sh`) y los Dockerfiles |

Como tu cuenta es personal, **GitHub no tiene secrets compartidos entre repos**: hay que volver a crear los 6 en cada repositorio, con los mismos valores. Reutilizar la misma clave SSH entre tus proyectos es razonable; si algún día compartes un repo con otra persona, genera una clave aparte para él.

## 3. Cómo se trabaja a diario

1. Crea una rama (`feat/lo-que-sea`). **Nunca hagas push directo a `main`.**
2. Abre un Pull Request. El CI corre solo; no se despliega nada.
3. Con el CI en verde, haz el merge. Eso lanza el deploy.
4. Mira *Actions → Deploy*. Si falla, el servidor sigue en la versión anterior.

Protege `main` en *Settings → Branches*: exigir Pull Request y que pasen los checks `backend`, `frontend`, `parser-and-apps-script`, `docker-build (backend)`, `docker-build (frontend)` y `secrets-scan` (los nombres aparecen para elegir después de que el CI corra una vez). **Aviso:** en repos privados con plan gratuito de GitHub, la protección de ramas y las aprobaciones del Environment pueden no estar disponibles. En ese caso la regla es solo disciplina: sin push directo a `main`.

## 4. Por proyecto, paso a paso

Tiempo orientativo: 45 minutos el primero, unos 20 los siguientes.

### Paso 0: decide los nombres
Rellénalos antes de empezar; se usan en todo lo demás.

| Dato | Ejemplo | Reglas |
|---|---|---|
| `APP` | `gastos` | minúsculas, dígitos y `-`. Nombre de imágenes, stack y carpeta |
| `PREFIJO` | `gas` | 2 a 9 letras o dígitos, **único en la red `edge`**. Ya usados por otros: `web` (atm), `n8n`, `caddy`, `pamela`, `finanzas-*`, `mov` |
| `DOMINIO` | `gastos.hamstitors.trade` | |
| Nombre de los servicios en Swarm | `gastos_gas-api`, `gastos_gas-web` | siempre `<APP>_<PREFIJO>-api` y `<APP>_<PREFIJO>-web`; es lo que ves en `docker service ls` y lo que usan los comandos de logs |
| Puertos | API `3000`, web `8080` | los que usa el kit |
| ¿Qué lleva? | API, web, Postgres, Redis | borra del stack lo que no uses |

### Paso 1: que el proyecto cumpla el contrato del kit
El kit espera esto del código; si el proyecto es distinto, adáptalo:

- **API** escucha en el puerto de `PORT` (3000), responde `GET /health` con 200 **solo si sus dependencias responden** y falla con 503 si no.
- Toda la configuración llega por **variables de entorno**, con validación que falla al arrancar si falta algo.
- **Migraciones ejecutables desde el código compilado** (en `movilidad`: `node dist/database/run-migrations.js`). Si tu comando es otro, cámbialo en `migrate()` de `deploy.sh`.
- **Frontend** se compila a estático y se sirve con nginx sin privilegios (puerto 8080). Llama a la API por la ruta relativa `/api` (`VITE_API_URL=/api`), así no hay CORS ni problemas de cookies.
- Cada carpeta con Dockerfile tiene su `.dockerignore` (`node_modules`, `dist`, `.env*`).
- `npm audit --omit=dev --audit-level=high` sin vulnerabilidades altas.
- El proyecto no usa `synchronize` de TypeORM: todo cambio de esquema es una migración.

Copia como punto de partida `backend/Dockerfile`, `frontend/Dockerfile` y `frontend/nginx.conf` de `movilidad-dashboard`; son multi-etapa, corren sin root y tienen healthcheck.

### Paso 2: genera el kit de despliegue
Desde un clon de `movilidad-dashboard-`:

```bash
bash deploy/scaffold.sh ~/ruta/al/proyecto-nuevo APP PREFIJO DOMINIO
```
Por ejemplo: `bash deploy/scaffold.sh ~/gastos gastos gas gastos.hamstitors.trade`. Crea `deploy/` y `.github/` con todos los nombres cambiados. No sobrescribe nada: si algún archivo existe, se detiene sin copiar.

Después revisa (es lo único que no puede adivinar el script):
- `ci.yml` asume carpetas `backend/` y `frontend/`: borra o adapta los trabajos que no apliquen (por ejemplo `parser-and-apps-script` solo existe en `movilidad`).
- `docker-stack.yml` lleva Postgres, Redis, API y web: quita lo que no uses, con sus volúmenes y sus variables.
- `deploy/production.env.example`: ajusta las variables a las de tu app.

Sube todo en una rama y abre el Pull Request (aún no lo fusiones).

### Paso 3: prepara el servidor
En `nas-lab`, desde tu usuario administrador con `sudo`, **no** como `deploy`. Define tus nombres y pega el bloque **entero, directamente en el prompt** (nunca dentro de nano y nunca entre comillas):

```bash
APP=gastos
DOMINIO=gastos.hamstitors.trade
DBN=${APP//-/_}
sudo install -d -m 755 -o deploy -g deploy /opt/$APP
sudo install -m 600 -o deploy -g deploy /dev/null /opt/$APP/.env
```
```bash
printf '%s\n' \
  "NODE_ENV=production" \
  "PORT=3000" \
  "DB_HOST=postgres" \
  "DB_PORT=5432" \
  "DB_USER=$DBN" \
  "DB_PASSWORD=$(openssl rand -hex 24)" \
  "DB_NAME=$DBN" \
  "REDIS_HOST=redis" \
  "REDIS_PORT=6379" \
  "JWT_SECRET=$(openssl rand -hex 32)" \
  "CORS_ORIGIN=https://$DOMINIO" \
  "TRUST_PROXY=true" \
  | sudo tee /opt/$APP/.env >/dev/null
```
Añade o quita líneas según las variables de tu app. Los secretos se generan una sola vez; **no repitas este comando** o regenerarás `DB_PASSWORD` y dejará de coincidir con la que Postgres guardó al crear su volumen. Para cambiar algo después, edita solo esa línea con `sudo nano /opt/$APP/.env`.

Comprueba el archivo sin mostrar secretos (el primero no debe imprimir nada):
```bash
sudo grep -n -v -E '^[[:space:]]*(#.*)?$|^[A-Za-z_][A-Za-z0-9_]*=[^[:space:]"'"'"'$`\\]*$' /opt/$APP/.env
```
```bash
sudo ls -l /opt/$APP/.env
```
Debe decir `-rw------- … deploy deploy`. Guarda los secretos en tu gestor de contraseñas.

### Paso 4: Cloudflare y Caddy
**Cloudflare:** *Zero Trust → Networks → Tunnels →* tu túnel → *Published application routes* → **Add**: Subdomain y Domain según `DOMINIO`, Path vacío, Service `HTTP` → `caddy:80`. Esto crea también el DNS.

**Caddy:** en `/opt/infra/caddy/Caddyfile`, añade al final (cambia `DOMINIO` y `PREFIJO`):
```
http://DOMINIO {
    handle /api/* {
        uri strip_prefix /api
        reverse_proxy PREFIJO-api:3000
    }
    handle {
        reverse_proxy PREFIJO-web:8080
    }
}
```
Si la API tiene rutas que **no** deben ser públicas (como `/ingest`), pon antes `handle /api/ruta* { respond "Not found" 404 }`. Después:
```bash
docker exec caddy caddy validate --config /etc/caddy/Caddyfile
docker exec caddy caddy reload --config /etc/caddy/Caddyfile
```
`validate` debe terminar con `Valid configuration`. **Si falla, no recargues.** Comprueba además que el bloque no quedó con una llave sin cerrar ni con `ttp://` en lugar de `http://`.

Hasta el primer deploy el sitio dará 502; es normal y no afecta a los demás.

**Si la app recibe webhooks desde internet** (como n8n), hay **tres** sitios que tocar: la ruta del túnel (con el filtro de ruta, p. ej. `/webhook/mi-ruta$`), el `path` del bloque `hooks` en Caddy y el origen del webhook (Apps Script, etc.). Si falta uno, la petición se pierde sin error visible.

### Paso 5: GitHub
En el repo nuevo, *Settings → Secrets and variables → Actions* → **New repository secret**, los 6 de siempre:

| Secret | Valor |
|---|---|
| `DEPLOY_SSH_KEY` | la clave privada del usuario `deploy` (completa, con BEGIN y END) |
| `DEPLOY_KNOWN_HOSTS` | salida de `ssh-keyscan -H 100.100.82.79` |
| `DEPLOY_HOST` | `100.100.82.79` |
| `DEPLOY_USER` | `deploy` |
| `TS_OAUTH_CLIENT_ID` | del OAuth client de Tailscale |
| `TS_OAUTH_SECRET` | del OAuth client de Tailscale |

Crea el Environment `production` (*Settings → Environments*). Después, protege `main` como en la sección 3.

### Paso 6: primer deploy
1. Con el CI del Pull Request en verde, haz el merge a `main`.
2. Mira *Actions → Deploy*. Debe pasar `ci`, `images` y `deploy`.
3. Verifica desde cualquier terminal:
   ```bash
   curl -s https://DOMINIO/api/health
   curl -s -o /dev/null -w "%{http_code}\n" https://DOMINIO/
   ```
   La primera debe devolver el JSON `ok`; la segunda, `200`.
4. Si algo falla, diagnostica **por capas, de dentro hacia fuera**:
   ```bash
   docker service ls                                   # ¿1/1 en los servicios?
   docker service logs --tail 30 APP_PREFIJO-api       # ¿arranca la API?
   curl -s -H 'Host: DOMINIO' http://100.100.82.79/api/health   # Caddy + app, sin Cloudflare
   getent hosts DOMINIO                                # ¿existe el DNS?
   ```
   Si la tercera da `ok` y la cuarta no devuelve nada, el problema está en Cloudflare. Si ambas bien y tu navegador no abre, es la caché DNS de tu router: prueba desde el móvil con datos o con `nslookup DOMINIO 1.1.1.1`.

### Paso 7: lo que se olvida
- **Backup de Postgres**: cron diario con `pg_dump` y copia fuera del servidor (sección 6 de `docs/despliegue.md`). Pruébalo restaurando una vez.
- **Monitorización**: un chequeo externo a `/api/health`.
- **Dependabot** ya viene en el kit.
- **Prueba un rollback** a propósito una vez por proyecto, después del segundo deploy (`.previous_tag` no existe hasta entonces): `bash /opt/APP/deploy.sh "$(cat /opt/APP/.previous_tag)"`.

## 5. Qué exige el CI y cómo arreglar cada fallo

| Comprobación | Si falla |
|---|---|
| `lint` / `test` / `build` | Reproduce en local con los mismos comandos del workflow |
| Tests de backend con Postgres y Redis | Los servicios del CI son desechables. Los tests exigen **todas las variables de entorno** del backend aunque estén saltados; defínelas en el bloque `env:` del job |
| `npm audit --omit=dev --audit-level=high` | `npm audit fix` en esa carpeta (solo cambia el lockfile) y comprobar que los tests siguen pasando. No bajes el nivel ni ignores el aviso |
| `gitleaks` | Se encontró algo parecido a un secreto en el historial: rótalo y elimínalo; no lo silencies |
| `docker-build` | El Dockerfile está roto o falta algo en `.dockerignore`. Constrúyelo en local |

El deploy **solo corre si el CI pasa**: `images` y `deploy` dependen de él, así que un fallo nunca toca el servidor.

## 6. Trampas ya encontradas (léelas antes de empezar)

1. **El `.env` es solo datos.** Pegar el comando dentro del archivo, rodearlo de comillas o repetir el `tee` rompió el primer deploy y filtró valores al log. Usa el `printf` del paso 3 y la comprobación con `grep`. `deploy.sh` ya no ejecuta el archivo y, si una línea es inválida, solo dice su número.
2. **Nada de secretos en logs de GitHub.** GitHub solo enmascara los secrets registrados en *Settings*, no los valores del `.env`. Si algo se filtra: rota los secretos y borra la ejecución (*Actions →* la ejecución → *⋯ → Delete workflow run*).
3. **Nombres únicos en `edge`.** La red `edge` la comparten todas las apps: un servicio llamado `web` choca con atm. Por eso se usa `<prefijo>-api` y `<prefijo>-web`.
4. **Borrar o editar una ruta del túnel borra su DNS.** Si un dominio deja de resolver (`getent hosts` vacío), vuelve a crear la fila. Al tocar `hooks` no modifiques la fila existente: añade otra.
5. **Tu router cachea "no existe".** Tras recrear un DNS puede tardar en verse desde tu casa aunque funcione fuera.
6. **La API necesita la base de datos para arrancar sana.** Postgres tarda: el primer deploy espera por él y migra después.
7. **Postgres y Redis usan `endpoint_mode: dnsrr`** para que Swarm no corte las conexiones inactivas del pool a los ~15 minutos.
8. **Las migraciones se aplican antes que el código nuevo y el rollback no las deshace.** Cada migración debe ser compatible con la versión anterior del código (añadir primero, quitar en un deploy posterior).
9. **La contraseña de Postgres solo se lee al crear el volumen.** Cambiar `DB_PASSWORD` después en el `.env` no la cambia en la base de datos.
10. **Un `EOF` dentro de otro bloque `EOF` corta el bloque.** Al preparar scripts o documentos con ejemplos de `cat <<EOF`, no los anides.
11. **Tras fusionar una rama, empieza la siguiente desde `main`** actualizado, no encima de la anterior.
12. **El servidor puede estar bien y tu dominio no.** Antes de tocar nada en Docker, prueba la capa de Caddy con el `curl -H 'Host: …' http://100.100.82.79/...` del paso 6.

## 7. Operación diaria

| Quiero… | Cómo |
|---|---|
| Ver estado | `docker stack services APP` |
| Ver logs | `docker service logs -f APP_PREFIJO-api` |
| Volver a la versión anterior | `bash /opt/APP/deploy.sh "$(cat /opt/APP/.previous_tag)"` |
| Cambiar una variable | `sudo nano /opt/APP/.env` y lanza un deploy (o `docker service update --force APP_PREFIJO-api`) |
| Rotar un secreto | Edita su línea en el `.env`, actualiza donde se use, lanza el deploy. `DB_PASSWORD` requiere además `ALTER USER` en Postgres |
| Desplegar a mano un SHA | `bash /opt/APP/deploy.sh <sha de 40 caracteres>` |
| Quitar un proyecto | `docker stack rm APP`; borrar la fila del túnel y el bloque de Caddy; `docker volume rm` de sus volúmenes **solo si quieres borrar los datos**; borrar `/opt/APP` y los paquetes de GHCR |

## 8. Resumen imprimible (por proyecto nuevo)

- [ ] Decidí `APP`, `PREFIJO` (único en `edge`) y `DOMINIO`
- [ ] El proyecto cumple el contrato del paso 1 (health, env, migraciones, Dockerfiles)
- [ ] Ejecuté `scaffold.sh` y adapté `ci.yml`, `docker-stack.yml` y el `.env.example`
- [ ] Creé `/opt/APP/.env` con el `printf` y lo comprobé con `grep` (sin salida)
- [ ] Cloudflare: fila del túnel creada y `getent hosts DOMINIO` resuelve
- [ ] Caddy: bloque añadido, `validate` OK y `reload`
- [ ] GitHub: los 6 secrets y Environment `production`
- [ ] PR con CI en verde → merge → Deploy en verde
- [ ] `curl https://DOMINIO/api/health` devuelve `ok`
- [ ] Backup programado y rollback probado una vez
