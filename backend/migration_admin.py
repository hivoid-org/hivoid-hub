#!/usr/bin/env python3
"""
HiVoid Hub Authentication Admin table migration script.
Adds admin_users table to existing DB.
"""
from sqlalchemy import Column, String, Integer, Boolean
from app.core.database import Base, engine

class AdminUser(Base):
    __tablename__ = "admin_users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)

if __name__ == "__main__":
    print("[*] Creating admin_users table...")
    Base.metadata.create_all(bind=engine)
    print("[+] Done.")
