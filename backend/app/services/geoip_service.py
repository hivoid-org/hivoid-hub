import os
import gzip
import shutil
import logging
from pathlib import Path
from typing import Optional

import httpx
import geoip2.database
from geoip2.errors import AddressNotFoundError

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent.parent.parent
GEOIP_DB_PATH = BASE_DIR / "GeoLite2-City.mmdb"
GEOIP_DB_URL = "https://cdn.jsdelivr.net/npm/geolite2-city/GeoLite2-City.mmdb.gz"


class GeoIPService:
    def __init__(self):
        self.reader: Optional[geoip2.database.Reader] = None
        try:
            self._ensure_database()
        except Exception as e:
            logger.error(f"Failed to initialize GeoIP service: {e}")
            logger.warning("GeoIP service will not be available")

    def _ensure_database(self):
        """Ensure GeoIP database exists and download if needed"""
        if not GEOIP_DB_PATH.exists():
            logger.info(f"GeoIP database not found at {GEOIP_DB_PATH}. Downloading...")
            self._download_database()
        
        try:
            self.reader = geoip2.database.Reader(str(GEOIP_DB_PATH))
            logger.info("GeoIP database loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load GeoIP database: {e}")
            self.reader = None

    def _download_database(self):
        """Download and extract GeoLite2 database"""
        gz_path = GEOIP_DB_PATH.with_suffix('.mmdb.gz')
        
        try:
            logger.info(f"Downloading GeoIP database from {GEOIP_DB_URL}")
            with httpx.Client(timeout=120.0, follow_redirects=True) as client:
                response = client.get(GEOIP_DB_URL)
                response.raise_for_status()
                
                with open(gz_path, 'wb') as f:
                    f.write(response.content)
            
            logger.info(f"Extracting {gz_path} to {GEOIP_DB_PATH}")
            with gzip.open(gz_path, 'rb') as f_in:
                with open(GEOIP_DB_PATH, 'wb') as f_out:
                    shutil.copyfileobj(f_in, f_out)
            
            logger.info("GeoIP database downloaded and extracted successfully.")
            
        except Exception as e:
            logger.error(f"Failed to download GeoIP database: {e}")
            raise
        finally:
            if gz_path.exists():
                gz_path.unlink()

    def get_location(self, ip: str) -> Optional[dict]:
        """Get geographic information from IP address"""
        if not self.reader:
            logger.warning("GeoIP reader not initialized")
            return None
        
        try:
            response = self.reader.city(ip)
            
            return {
                "ip": ip,
                "country": response.country.name,
                "country_code": response.country.iso_code,
                "city": response.city.name,
                "latitude": response.location.latitude,
                "longitude": response.location.longitude,
                "timezone": response.location.time_zone,
            }
            
        except AddressNotFoundError:
            logger.debug(f"No location found for IP: {ip}")
            return None
        except Exception as e:
            logger.error(f"Error getting location for IP {ip}: {e}")
            return None

    def close(self):
        """Close the GeoIP reader"""
        if self.reader:
            self.reader.close()
            self.reader = None


# Singleton instance
geoip_service = GeoIPService()
