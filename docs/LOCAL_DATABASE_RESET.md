# Local Database Reset

This procedure is for local demonstrations only. It permanently removes the local ParkEase PostgreSQL data. Do not run it against a shared, staging, or production database.

1. Stop the backend and frontend processes.
2. From the ParkEase workspace root, remove the local Docker database volume:

   ```powershell
   docker compose down -v
   ```

3. Start a fresh PostgreSQL container:

   ```powershell
   docker compose up -d db
   ```

4. Confirm `backend/.env` points to the local database and contains the required `DATABASE_URL` and `SECRET_KEY` values.
5. Run the existing database setup script if the database itself does not exist:

   ```powershell
   cd backend
   .\venv\Scripts\python.exe create_db.py
   ```

6. Start the backend normally. The application will create the existing SQLAlchemy tables through `Base.metadata.create_all`.

The reset is intentionally manual. ParkEase does not delete existing data automatically.
