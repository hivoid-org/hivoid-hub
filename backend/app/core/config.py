from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "HiVoid Subscription Hub"
    API_V1_STR: str = "/api/v1"
    
    # Hub Master Token (used by nodes to authenticate via WSS)
    HUB_MASTER_TOKEN: str = "hivoid-super-secret-node-token"
    
    # JWT Secret Key for Admin Panel authentication
    SECRET_KEY: str = "hivoid-hub-jwt-secret-change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    
    # Redis configuration for atomic traffic counting
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Database config
    SQLALCHEMY_DATABASE_URI: str = "postgresql://postgres:postgres@localhost:5432/hivoid_hub"

    class Config:
        env_file = "/opt/hivoid-hub/backend/.env"
        case_sensitive = True

settings = Settings()
