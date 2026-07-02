from sqlalchemy import create_engine, event, exc, text
from sqlalchemy.orm import sessionmaker, scoped_session

from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger(__name__)

# Main database engine
db_url = settings.DATABASE_URL
if not db_url:
    raise ValueError("DATABASE_URL must be configured in the environment")

is_sqlite = db_url.startswith("sqlite")

if not is_sqlite:
    import psycopg2.extras
    psycopg2.extras.register_uuid()
    logger.info("Successfully registered psycopg2 UUID adapter")

engine_kwargs = {
    "pool_pre_ping": True,
    "echo": False,
}

if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs.update(
        pool_size=5,
        max_overflow=5,
        pool_recycle=3600,
        connect_args={"connect_timeout": 10},
    )

engine = create_engine(
    db_url,
    **engine_kwargs,
)


# Event listener to log connection issues
@event.listens_for(engine, "connect")
def receive_connect(dbapi_conn, connection_record):
    logger.info("Database connection established")


@event.listens_for(engine, "checkout")
def receive_pool_checkout(dbapi_conn, connection_record, connection_proxy):
    connection_record.info['checkout_time'] = __import__('time').time()


@event.listens_for(engine, "checkin")
def receive_pool_checkin(dbapi_conn, connection_record):
    checkout_time = connection_record.info.get('checkout_time')
    if checkout_time:
        duration = __import__('time').time() - checkout_time
        if duration > 5.0:
            logger.warning(f"Long database connection held for {duration:.2f}s")


SessionLocal = scoped_session(
    sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
    )
)


import time

def get_db_session():
    """
    Returns a scoped SQLAlchemy session. Retries on connection failure.
    """
    max_retries = 3
    retry_delay = 2
    
    for attempt in range(max_retries):
        try:
            session = SessionLocal()
            session.execute(text("SELECT 1"))
            return session
        except Exception as e:
            if attempt < max_retries - 1:
                logger.warning(f"Database connection attempt {attempt + 1} failed, retrying...: {e}")
                if 'session' in locals():
                    session.close()
                time.sleep(retry_delay)
            else:
                logger.error(f"Database connection failed after {max_retries} attempts: {e}")
                raise
