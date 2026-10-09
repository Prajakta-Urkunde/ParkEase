import sys
from urllib.parse import urlparse
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from app.core.config import DATABASE_URL


def setup_database():
    print("=" * 60)
    print("ParkEase PostgreSQL Database Setup")
    print("=" * 60)

    parsed = urlparse(DATABASE_URL)
    username = parsed.username or "postgres"
    password = parsed.password or ""
    hostname = parsed.hostname or "localhost"
    port = parsed.port or 5432
    target_db = parsed.path.lstrip("/") or "parkease_db"

    print(f"Target Database: {target_db}")
    print(f"Host: {hostname}:{port}")
    print(f"User: {username}")

    # Connect to default postgres maintenance database
    try:
        conn = psycopg2.connect(
            dbname="postgres",
            user=username,
            password=password,
            host=hostname,
            port=port
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cursor = conn.cursor()

        # Check if target database exists
        cursor.execute(f"SELECT 1 FROM pg_catalog.pg_database WHERE datname = '{target_db}';")
        exists = cursor.fetchone()

        if not exists:
            print(f"Database '{target_db}' does not exist. Creating...")
            cursor.execute(f'CREATE DATABASE "{target_db}";')
            print(f"Successfully created database '{target_db}'!")
        else:
            print(f"Database '{target_db}' already exists.")

        cursor.close()
        conn.close()

        # Now test direct connection to the new database
        print(f"Testing connection to '{target_db}'...")
        test_conn = psycopg2.connect(
            dbname=target_db,
            user=username,
            password=password,
            host=hostname,
            port=port
        )
        test_conn.close()
        print(f"Connection to '{target_db}' succeeded!")
        print("=" * 60)
        return True

    except psycopg2.OperationalError as e:
        print("\n[!] Connection Error:")
        print(e)
        print("\nHints:")
        print("1. Ensure PostgreSQL service is running on port 5432.")
        print("2. Check the password in backend/.env matches your PostgreSQL superuser password.")
        print("=" * 60)
        return False
    except Exception as e:
        print(f"\n[!] Unexpected Error: {e}")
        return False


if __name__ == "__main__":
    success = setup_database()
    sys.exit(0 if success else 1)
