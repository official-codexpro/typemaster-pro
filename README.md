# TypeMaster Pro

TypeMaster Pro is a Django typing-practice site with timed tests, user profiles,
performance history, and three typing-driven games. The Car Racing game uses a
local Three.js scene, and Type Fighter uses animated 3D fighters in a real-time
arena. The site styles and browser libraries are built locally.

## Requirements

- Python 3.12 or newer
- Node.js 20 or newer
- npm

## Local setup

```sh
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
python -c 'import secrets; print(secrets.token_urlsafe(50))'
set -a && . ./.env && set +a
```

Paste the generated value as `DJANGO_SECRET_KEY` in `.env` before loading it.
The development configuration uses a console email backend and local hostnames
by default.

```sh
npm ci
npm run build
python manage.py migrate
python manage.py runserver
```

`npm run build` compiles Tailwind CSS, copies local GSAP and Chart.js assets, and
bundles the Car Racing and Type Fighter 3D engines. Re-run it after changing
templates, vendor dependencies, or either game scene.

When a signed-in user earns a Silver or Gold typing certificate, TypeMaster Pro
sends an HTML certificate to the email address on the account after the result
is committed. Development prints mail to the console. Production needs working
SMTP credentials; delivery errors are logged without discarding the test result.
There is no background retry queue, so confirm SMTP delivery from the production
host before launch.

Every Easy, Normal, and Hard paragraph test is evaluated for Bronze, Silver, or
Gold. The result screen displays the server-saved score and certificate tier and
links to the user's certificates after every typing test. Code-practice tests do
not award paragraph certificates.

## Code quality

Install optional formatters and linters with:

```sh
python -m pip install -r requirements-dev.txt
```

Format the front end with `npm run format`, Python with `black config type`,
and templates with `djlint --reformat templates`. Check the result with
`ruff check config type`, `djlint --check templates`, and
`npm run format:check`.

## Production configuration

Set `DJANGO_ENV=production`, `DJANGO_DEBUG=false`, a newly generated
`DJANGO_SECRET_KEY`, exact `DJANGO_ALLOWED_HOSTS`, HTTPS
`DJANGO_CSRF_TRUSTED_ORIGINS`, and SMTP credentials through the hosting
platform's secret manager. Production startup fails if the key, host list, or
SMTP credentials are missing. Keep `DJANGO_SECURE_SSL_REDIRECT` enabled and
serve the site over HTTPS before enabling HSTS. If TLS terminates at a proxy,
configure `DJANGO_SECURE_PROXY_SSL_HEADER` only when that trusted proxy strips
client-supplied copies of the header and sets its own value.
HSTS subdomain coverage and browser preloading stay disabled until every
subdomain is confirmed to support HTTPS permanently.

Before release, run `python manage.py check --deploy` with production
environment variables, then prepare and start the service with:

```sh
python manage.py migrate --noinput
python manage.py collectstatic --noinput
gunicorn config.wsgi:application --bind "0.0.0.0:${PORT:-8000}" --workers 3
```

Set `DJANGO_DATABASE_PATH` and `DJANGO_MEDIA_ROOT` to durable mounted storage.
The current database backend is SQLite, suitable for a single application
instance with persistent disk; use a managed database and a Django database
driver if the deployment needs multiple application instances. SQLite, uploaded
media, `.env`, and other local data are excluded from source control. WhiteNoise
serves compressed, hashed static assets collected into `staticfiles/`.

Run `python manage.py test type.tests` to verify certificate delivery and game
result saving before release. SMTP credentials and a working sender address
must be configured in the deployment environment for certificate emails to
reach users.

The Django secret key and SMTP app password previously stored in repository
settings must be revoked and replaced. Use only new credentials in the
production secret manager.

## Type Fighter difficulty and practice modes

Type Fighter offers Easy, Normal, Hard, Extreme, and Custom arena settings. The shared balance table lives in `static/games/type_fighter/src/difficulty.js`; it defines each mode's word pool, input window, accuracy target, AI timing and defense, damage, recovery, combo window, and mistake penalty. Custom mode accepts target WPM, word complexity, AI aggression and reaction, and a 45 or 60 second match length. These are guidance and balance inputs, not player unlock gates.

Select Training Room from the Type Fighter menu for a no-loss session. The player cannot lose health there; mistakes are recorded and missed words can recur during the session. Match results are stored through the Type Fighter save endpoint. Migration `0013_typefighter_difficulty_analytics` adds peak WPM, received damage, attack counts, and reviewed words. The menu derives per-difficulty personal bests and Hard/Extreme victory badges from those saved records.

To validate the feature, run `python manage.py test type.tests.test_type_fighter_results`, `python manage.py check`, and `npm run build:type-fighter`.
