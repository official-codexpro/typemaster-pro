# Repository guide

## Build, test, and lint

Requires Python 3.12+, Node.js 20+, and npm. Follow the local setup in
`README.md` to create `.venv`, install `requirements.txt`, configure `.env`, and
run `npm ci`.

- Build CSS, vendor assets, and both 3D game bundles: `npm run build`
- Build only one part: `npm run build:css`, `npm run build:vendor`,
  `npm run build:car-race`, or `npm run build:type-fighter`
- Format: `npm run format`, `black config type`, and
  `djlint --reformat templates`
- Check formatting/lint: `npm run format:check`, `ruff check config type`, and
  `djlint --check templates`
- Run Django tests: `python manage.py test type.tests`
- Run one Django test:
  `python manage.py test type.tests.test_car_racing_results.CarRacingFinishResultTests.test_finish_line_metadata_is_saved_and_shown_on_the_result_page`
- Run all browser-logic tests:
  `node --test static/games/car_game/tests/*.test.cjs static/games/type_fighter/tests/*.test.mjs`
- Run one JavaScript test file:
  `node --test static/games/type_fighter/tests/typing-input.test.mjs`
  (use `--test-name-pattern="..."` to select a test by name)
- Check Django configuration: `python manage.py check`

There is no npm test script. Optional Python formatters and linters are listed
in `requirements-dev.txt`; their settings are in `pyproject.toml`.

## Architecture

- `config/` is the Django project configuration and root URL dispatcher.
  `type/` is the primary Django app: it owns models and migrations, URL routes,
  request handlers, forms, and persistence for typing results, profiles,
  certificates, and game results.
- `templates/` contains server-rendered Django pages and shared base/component
  templates. Routes in `type/urls.py` connect those pages to `type/views.py`.
  Game templates pass route-generated URLs and selected settings to browser
  code through `data-*` attributes.
- Browser code and source assets live under `static/`. The npm build compiles
  Tailwind, synchronizes local vendor libraries, and bundles the Car Racing and
  Type Fighter engines. Space Shooter loads its browser code directly;
  Car Racing combines `js/game.js` with the generated
  `js/race-world.bundle.js`; Type Fighter builds `src/` into `dist/game.js`
  alongside its `js/game.js` integration code. For game-engine changes, edit
  the source (Car Racing `js/race-world.js`; Type Fighter `src/`) and rebuild
  rather than editing generated bundles directly. The Type Fighter build also
  extracts FBX animations into `assets/animations/` and checks them against the
  character rigs.
- Browser games submit results to Django JSON endpoints; the corresponding
  Django models and migrations are the persisted record used by result pages
  and dashboards. Keep schema changes in new migrations. Certificate tiers and
  saved typing metrics are computed server-side; certificate email is scheduled
  after the result transaction commits.
- `type/tests/` contains Django tests. Browser-independent game logic is tested
  with Node's built-in test runner in each game's `tests/` directory.

## Conventions

- Preserve Django URL names and use `{% url %}` / `{% static %}` in templates
  rather than hard-coding application endpoints or static asset paths.
- Game pages that make state-changing JSON requests use the existing
  authenticated, POST-only, CSRF-protected save endpoints. Validate submitted
  values on the server; do not rely on client-computed scores or game settings
  as authoritative.
- When changing a game template's `data-*` contract, update its consuming
  browser code and result-saving view together.
- Keep static vendor dependencies local and synchronized through
  `scripts/sync-vendor.mjs`; do not introduce runtime CDN dependencies.
- Python formatting uses Black (88 columns, Python 3.12) and Ruff's `E`, `F`,
  and `I` rules. Templates use djlint's Django profile with four-space
  indentation. JavaScript and CSS use the repository's Prettier configuration.
- Development configuration reads environment variables documented by
  `.env.example`; do not commit `.env`, local databases, uploaded media, or
  deployment-collected `staticfiles/`.
