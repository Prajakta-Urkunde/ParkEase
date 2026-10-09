# ParkEase

ParkEase is a parking management platform with separate workflows for parking users and parking owners. Users can discover parking lots, inspect live slot availability, reserve slots, navigate to a location, review reservation history, and cancel active reservations. Owners can create and manage parking lots and slots, review statistics, and monitor reservations in their lots.

## Features

- User and owner registration with JWT-based authentication.
- Role-protected user and owner dashboards.
- Owner property-evidence submissions with authorized manual verification before a lot can be published or booked.
- Parking lot creation bound to the approved property address and map location.
- Parking slot creation with capacity and ownership checks.
- Parking search by name or address.
- Availability filtering and availability-based sorting.
- Browser geolocation for nearby parking and distance sorting.
- Leaflet map with OpenStreetMap tiles and parking markers.
- Google Maps directions links for lots with coordinates.
- Reservation confirmation and successful-reservation views.
- Reservation history with active, cancelled, and completed/past statuses.
- Reservation cancellation that releases the parking slot.
- Persistent ₹20 cancellation-fine balances, included in the next server-quoted checkout and shown in reservation history.
- Cash fines remain pending until the parking owner confirms cash receipt; online mock checkout settles the fine atomically with the combined payment.
- Parking charges continue to use the existing ₹50/hour duration-based pricing rule.
- Owner statistics for capacity, created, available, and occupied slots.
- Owner reservation monitoring with status filters.
- Responsive layouts, visible keyboard focus, modal keyboard handling, reduced-motion support, local image assets, and loading/error/empty states.

## Technology Stack

### Frontend

- React 19
- TypeScript
- Vite
- React Router
- React Leaflet and Leaflet
- CSS
- Oxlint

### Backend

- FastAPI
- Pydantic
- SQLAlchemy
- PostgreSQL
- JWT authentication with `python-jose`
- Password hashing with `bcrypt`
- Uvicorn

### Development Infrastructure

- Docker Compose for local PostgreSQL
- OpenStreetMap tiles for the map base layer
- Google Maps directions URLs for navigation

## Repository Structure

```text
ParkEase/
  backend/
    app/core/          Configuration and database setup
    models/             SQLAlchemy models, including owner verification
    routes/             Authentication, role, parking, and verification routes
    schemas/            Pydantic request/response schemas
    tests/              Backend tests
    main.py             FastAPI application entrypoint
    requirements.txt
  database/
    init.sql            PostgreSQL initialization script
  docs/
    LOCAL_DATABASE_RESET.md
    TEST_CASE_CHECKLIST.md
  frontend/
    public/images/      Local homepage, auth, and map marker assets
    src/                React pages, components, styles, and API service
    package.json
  docker-compose.yml
```

## Prerequisites

- Python 3.10 or newer recommended.
- Node.js and npm.
- Docker Desktop with Docker Compose, or a reachable PostgreSQL 16 database.
- A browser with geolocation support for the location workflow.

## Environment Configuration

Create `backend/.env` from the supplied template:

```powershell
Set-Location backend
Copy-Item .env.example .env
```

Set values appropriate for the local machine:

```dotenv
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/parkease_db
SECRET_KEY=replace_with_a_long_random_secret_at_least_32_characters
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
PRIVATE_DOCUMENT_STORAGE_DIR=private_storage
```

`SECRET_KEY` must be at least 32 characters. Do not commit `.env` or real credentials.

The frontend currently calls the backend at `http://127.0.0.1:8000`; run the backend on that address/port for the default local setup.
`PRIVATE_DOCUMENT_STORAGE_DIR` defaults to `backend/private_storage`. It is private local storage and is not mounted by the API or placed under frontend assets. Keep it outside all web-served directories and excluded from source control.

## Database and Docker Setup

From the repository root:

```powershell
docker compose up -d db
```

The Compose service uses PostgreSQL 16, exposes port `5432`, creates the `parkease_db` database, and mounts [database/init.sql](database/init.sql). The application creates its SQLAlchemy tables when the backend starts.

Check the database container:

```powershell
docker compose ps
docker compose logs db
```

For a destructive local reset, follow [docs/LOCAL_DATABASE_RESET.md](docs/LOCAL_DATABASE_RESET.md):

```powershell
docker compose down -v
docker compose up -d db
```

The reset removes the local PostgreSQL volume. Do not use it against shared or production data.

If PostgreSQL is managed outside Docker and the database does not exist, the optional setup script is:

```powershell
Set-Location backend
python create_db.py
```

## Backend Startup

Install backend dependencies:

```powershell
Set-Location backend
python -m pip install -r requirements.txt
```

Start the API:

```powershell
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Useful checks:

- API root: `http://127.0.0.1:8000/`
- Health check: `http://127.0.0.1:8000/health`
- Interactive API docs: `http://127.0.0.1:8000/docs`
- OpenAPI JSON: `http://127.0.0.1:8000/openapi.json`

## Frontend Startup

In a second terminal:

```powershell
Set-Location frontend
npm install
npm run dev -- --host 127.0.0.1
```

Open the Vite URL shown in the terminal, normally:

```text
http://127.0.0.1:5173/
```

Frontend commands:

```powershell
npm run build   # TypeScript check and production build
npm run lint    # Oxlint
npm run preview # Preview the production build locally
```

## Major API Endpoints

The backend exposes the following implemented endpoints. Protected endpoints require a bearer token and role-specific endpoints enforce the indicated role.

### System

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/` | Public | API running message |
| `GET` | `/health` | Public | Health status |

### Authentication

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/auth/register` | Public | Register a user or owner; accepts JSON |
| `POST` | `/auth/login` | Public | Log in with form fields `username` and `password` |
| `GET` | `/auth/me` | Bearer token | Return the current user |

### Role Checks

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/dashboard/user` | User | User role access check |
| `GET` | `/dashboard/owner` | Owner | Owner role access check |

### Parking and Reservations

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `POST` | `/parking/lots` | Owner | Create an owned parking lot |
| `GET` | `/parking/lots` | Owner | List the current owner's lots |
| `POST` | `/parking/slots` | Owner | Create a slot in an owned lot |
| `GET` | `/parking/lots/{lot_id}/owner-slots` | Owner | List slots for an owned lot |
| `GET` | `/parking/lots/{lot_id}/summary` | Owner | Return capacity and slot statistics |
| `GET` | `/parking/lots/available` | User | List lots with calculated availability |
| `GET` | `/parking/lots/{lot_id}/slots` | User | List slots for a lot |
| `POST` | `/parking/reservations` | User | Reserve an available slot |
| `GET` | `/parking/reservations` | User | List the current user's reservations |
| `PATCH` | `/parking/reservations/{reservation_id}/cancel` | User | Cancel an owned active reservation |
| `GET` | `/parking/owner/reservations` | Owner | Monitor reservations in owned lots |
| `GET` | `/owner/verification` | Owner | View current verification status and document metadata |
| `POST` | `/owner/verification` | Owner | Submit or resubmit property details and evidence using multipart form data |
| `GET` | `/admin/owner-verifications` | Admin | List all applications (optional `status` filter) for review and dashboard statistics |
| `GET` | `/admin/owner-verifications/{verification_id}` | Admin | Inspect an application and its document metadata |
| `GET` | `/admin/owner-verification-documents/{document_id}` | Admin | Download one evidence document after authorization |
| `POST` | `/admin/owner-verifications/{verification_id}/review` | Admin | Move an application under review, approve, request information, or reject |

Request details and generated schemas are available at `/docs` and `/openapi.json` when the backend is running.

Admins can use `/admin-dashboard` after signing in with a persisted `admin` role. The website dashboard filters and searches real verification records, securely fetches documents through the authenticated download endpoint for preview/download, and submits the existing review decisions. The existing list endpoint accepts `status=ALL`, `PENDING`, `UNDER_REVIEW`, `NEEDS_MORE_INFORMATION`, `VERIFIED`, or `REJECTED`. The dashboard is protected by the role returned by `/auth/me`; the API continues to independently authorize every review and download request.

## User Workflow

1. Open the homepage.
2. Choose `Find Parking` or open Login/Register.
3. Register as a Parking User or log in with an existing user account.
4. Use the dashboard's map or `Find Parking` tab.
5. Search by lot name/address, filter by availability, or enable location-based sorting.
6. Open parking details and inspect live slots.
7. Select an available slot and open the reservation confirmation modal.
8. Confirm the reservation and review the success details.
9. Open `My Reservations` to review the reservation.
10. Cancel an active reservation when needed; the slot becomes available again.

## Owner Workflow

1. Register as a Parking Owner and provide property name/address, the property's map coordinates, an optional property identifier, relationship to the property, and evidence files.
2. Choose `OWNER`, `TENANT`, or `AUTHORIZED_OPERATOR`; provide ownership records for owners or a lease/written authorization for tenants/operators, with property evidence where appropriate.
3. Wait for an authorized administrator to review the application. Uploaded documents do not automatically approve or prove ownership.
4. Check the owner dashboard for status, requested information, reviewer notes, and resubmission options.
5. After status becomes `VERIFIED`, create parking lots and slots. Unverified listings are excluded from public search and booking.
6. Review parking statistics, slot availability, lot summaries, and reservations.

### Verification operations and storage

The verification states are `NOT_SUBMITTED`, `PENDING`, `UNDER_REVIEW`, `NEEDS_MORE_INFORMATION`, `VERIFIED`, and `REJECTED`. Review decisions require an authenticated account whose persisted database role is `admin`; there is no public approval endpoint, public admin registration option, or default admin password.

To provision an administrator for a local demonstration, an operator must assign the `admin` role to an already-created trusted account using an appropriately secured database session, then have that account log in again. For example, execute a parameterized update for the intended account in a trusted database client; do not expose this operation as an API or commit credentials.

The application adds `owner_verifications` and `owner_verification_documents` tables through the existing SQLAlchemy `Base.metadata.create_all` startup initialization; existing tables and rows are not deleted. The current demo supports one verified property per owner; a listing's address and map location are bound to the reviewed property details. Local uploads are stored in `backend/private_storage` by default, with random server-generated storage keys, restrictive filesystem permissions where supported, bounded upload sizes, extension/MIME/content-structure checks, and no public file route. Never copy this directory into frontend assets or serve it through a static-file mount.

The college-demo storage is not a production document-management system. Production should replace it with a private object store or equivalent protected storage with encryption at rest/in transit, least-privilege IAM, malware scanning, access auditing, retention/deletion rules, backups, request-body limits, and legal review. Legal/property-record verification remains a human process; the software does not prove ownership. The workflow does not request Aadhaar, PAN, or other identity documents.

If an administrator reopens an approved application for review or changes it to `NEEDS_MORE_INFORMATION` or `REJECTED`, the listing is immediately removed from public discovery and new reservations/checkout are blocked. Existing reservations remain intact and can still be started, cancelled, paid, and completed using the existing reservation workflows.

## Demo Sequence

Use a prepared user account, owner account, lot, and slots. Do not rely on unverified sample credentials.

1. **Homepage:** Show the ParkEase brand, hero, local imagery, and primary navigation.
2. **Authentication:** Open Login or Register and demonstrate role selection.
3. **Find Parking:** Enter the user dashboard and open the Find Parking view.
4. **Search/filter:** Search by name or address, toggle `Available Now`, and change sorting.
5. **Location:** Demonstrate `Use My Location`, permission status, and nearby sorting. If permission is unavailable, show the manual-search fallback.
6. **Parking Details:** Open a parking lot detail page and show address, capacity, and current availability.
7. **Live Slots:** Display available and occupied slots.
8. **Reservation:** Select an available slot, review the confirmation modal, and confirm.
9. **Success:** Show the reservation confirmation details and changed availability.
10. **Reservation History:** Open `My Reservations` and show the new active reservation.
11. **Cancellation:** Cancel the reservation and show the cancelled status and released slot.
12. **Owner Login:** Log out and sign in with the prepared owner account.
13. **Owner Statistics:** Show capacity, created, available, occupied, availability, and occupancy metrics.
14. **Parking Management:** Create or open a lot and demonstrate slot management.
15. **Reservation Monitoring:** Show owner reservation records and status filters.
16. **Responsive demonstration:** Repeat key homepage, auth, search, modal, and dashboard views at desktop, tablet, and mobile widths.

## Screenshots

Screenshots are intentionally left as placeholders so documentation does not claim images that have not been captured. Suggested capture set:

| Placeholder | Suggested file | Capture |
| --- | --- | --- |
| Homepage | `docs/screenshots/homepage.png` | Hero and primary CTA |
| Login | `docs/screenshots/login.png` | Login form and ParkEase branding |
| User dashboard | `docs/screenshots/user-dashboard.png` | Map or dashboard landing view |
| Parking search | `docs/screenshots/parking-search.png` | Search, filters, and parking cards |
| Reservation success | `docs/screenshots/reservation-success.png` | Successful reservation details |
| Reservation history | `docs/screenshots/reservation-history.png` | Active/cancelled history records |
| Owner dashboard | `docs/screenshots/owner-dashboard.png` | Statistics and management sections |
| Mobile view | `docs/screenshots/mobile-home.png` | Responsive homepage/menu view |

## Local Assets

Homepage and authentication imagery is stored locally under [frontend/public/images](frontend/public/images). Leaflet marker icons are also served locally under `frontend/public/images/leaflet`. The map base tiles remain provided by OpenStreetMap at runtime.

## Limitations

- The frontend API base URL is currently fixed to `http://127.0.0.1:8000` in the frontend service.
- OpenStreetMap map tiles require network access; the map container and locally served markers still load without tile access, but the base map will not be available offline.
- Google Maps directions open an external URL and require network access.
- Availability refresh is polling-based rather than WebSocket-based.
- Mock UPI/Card/Cash payment records are for the college demo only; no external payment provider is contacted and no sensitive card/PIN data is submitted to the backend.
- There is no password reset, email verification, or notification workflow implemented.
- Database schema creation uses SQLAlchemy `create_all`; there is no migration framework in the repository.
- Startup schema compatibility safely creates the cancellation-fine table and backfills fine records for existing cancelled reservations. Existing cash cancellation records are treated as pending until an owner confirms receipt.
- Local property-document storage is a college-demo implementation and must be replaced with managed private storage before production.
- Property evidence is reviewed by an authorized human; the system does not establish legal ownership by itself.
- Production deployment, secret management, HTTPS, and observability are not configured by this local development setup.
- Production deployment, secret management, HTTPS, and observability are not configured by this local development setup.

## Future Improvements

- Move the frontend API base URL to a Vite environment variable for local, staging, and production deployments.
- Add broader pytest/FastAPI integration coverage for authorization and reservation concurrency.
- Add Playwright end-to-end coverage for the user and owner demo flows.
- Add database migrations and a repeatable seed-data strategy for demonstrations.
- Add WebSocket or server-sent availability updates instead of polling.
- Add password recovery, email verification, payments, and user notifications.
- Add production deployment configuration with HTTPS, managed secrets, logging, and monitoring.
- Add an offline-friendly map strategy or an explicit no-network map fallback.

## Testing Documentation

See [docs/TEST_CASE_CHECKLIST.md](docs/TEST_CASE_CHECKLIST.md) for the 24-case manual regression checklist and automation candidates. The backend dependency smoke test is located at [backend/tests/test_requirements.py](backend/tests/test_requirements.py).
