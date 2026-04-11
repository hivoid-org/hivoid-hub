import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional

from app.services.geoip_service import geoip_service

router = APIRouter()

_hub_location_cache: dict = {}


class GeoIPResponse(BaseModel):
    ip: str
    country: Optional[str] = None
    country_code: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timezone: Optional[str] = None


@router.get("/hub", response_model=GeoIPResponse)
async def get_hub_location():
    """Get the hub server's own geographic location"""
    if _hub_location_cache.get("data"):
        return _hub_location_cache["data"]
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get("https://api.ipify.org")
            public_ip = resp.text.strip()
        location = geoip_service.get_location(public_ip)
        if location:
            result = GeoIPResponse(**location)
        else:
            result = GeoIPResponse(ip=public_ip)
        _hub_location_cache["data"] = result
        return result
    except Exception:
        return GeoIPResponse(ip="unknown")


@router.get("/lookup", response_model=GeoIPResponse)
async def lookup_ip(ip: str = Query(..., description="IP address to lookup")):
    """Get geographic information from IP address"""
    if not ip:
        raise HTTPException(status_code=400, detail="IP address is required")
    
    location = geoip_service.get_location(ip)
    
    if not location:
        return GeoIPResponse(
            ip=ip,
            country=None,
            country_code=None,
            city=None,
            latitude=None,
            longitude=None,
            timezone=None
        )
    
    return GeoIPResponse(**location)


@router.post("/batch-lookup")
async def batch_lookup(ips: list[str]):
    """Get geographic information for multiple IPs"""
    results = []
    
    for ip in ips:
        location = geoip_service.get_location(ip)
        if location:
            results.append(GeoIPResponse(**location))
        else:
            results.append(GeoIPResponse(
                ip=ip,
                country=None,
                country_code=None,
                city=None,
                latitude=None,
                longitude=None,
                timezone=None
            ))
    
    return results


def get_geoip_info(ip: str):
    """Utility function to get location for internal use by other endpoints"""
    return geoip_service.get_location(ip)
