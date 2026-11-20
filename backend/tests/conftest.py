"""Las pruebas usan una base aparte (ecoconecta_pruebas) en el Postgres de docker-compose: docker compose up -d db."""
import os

from sqlalchemy import create_engine, text

SERVIDOR = os.getenv("PRUEBAS_PG", "postgresql+psycopg://ecoconecta:solo-para-desarrollo-local@localhost:5440")
os.environ["DATABASE_URL"] = f"{SERVIDOR}/ecoconecta_pruebas"


def pytest_sessionstart(session):
    """Cada corrida empieza con la base de pruebas vacía; la de desarrollo no se toca."""
    servidor = create_engine(f"{SERVIDOR}/postgres", isolation_level="AUTOCOMMIT")
    with servidor.connect() as c:
        c.execute(text("DROP DATABASE IF EXISTS ecoconecta_pruebas WITH (FORCE)"))
        c.execute(text("CREATE DATABASE ecoconecta_pruebas"))
    servidor.dispose()
