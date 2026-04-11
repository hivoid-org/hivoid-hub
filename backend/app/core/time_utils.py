from datetime import datetime
try:
    import zoneinfo
except ImportError:
    # Fallback for older python or missing tzdata
    from backports import zoneinfo

def format_timestamp(ts: datetime, tz_name: str = "UTC") -> str:
    """
    Format a datetime object to a string using the specified timezone.
    If ts is naive, it's assumed to be UTC.
    """
    try:
        tz = zoneinfo.ZoneInfo(tz_name)
    except Exception:
        tz = zoneinfo.ZoneInfo("UTC")
    
    # If ts is naive, assume it's UTC
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=zoneinfo.ZoneInfo("UTC"))
        
    local_ts = ts.astimezone(tz)
    return local_ts.strftime('%Y-%m-%d %H:%M:%S')

def get_now_str(tz_name: str = "UTC") -> str:
    """Get current time as a formatted string in the target timezone."""
    return format_timestamp(datetime.now(), tz_name)
