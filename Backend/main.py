from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv
import os
import logging

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(
    title="Scan & Go — RFID Gate Service",
    description="Checks RFID tag payment status for gate exit authorization",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("ALLOWED_ORIGINS", "*").split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class RFIDRequest(BaseModel):
    rfid_id: str


class RFIDBulkRequest(BaseModel):
    rfid_ids: list[str]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/check-payment")
def check_payment(request: RFIDRequest):
    """Check if a single RFID tag's product has been paid for."""
    try:
        response = (
            supabase.table("products")
            .select("is_paid, name")
            .eq("rfid_id", request.rfid_id)
            .execute()
        )
        if response.data:
            product = response.data[0]
            return {"paid": product["is_paid"], "name": product.get("name")}
        return {"paid": False, "name": None}
    except Exception as e:
        logger.error("check-payment error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/check-payment/bulk")
def check_payment_bulk(request: RFIDBulkRequest):
    """Check payment status for multiple RFID tags at once."""
    if not request.rfid_ids:
        raise HTTPException(status_code=400, detail="rfid_ids must not be empty")
    try:
        response = (
            supabase.table("products")
            .select("rfid_id, is_paid, name")
            .in_("rfid_id", request.rfid_ids)
            .execute()
        )
        found = {p["rfid_id"]: p for p in (response.data or [])}
        missing = [r for r in request.rfid_ids if r not in found]
        unpaid = [r for r, p in found.items() if not p["is_paid"]]
        return {
            "allowed": len(missing) == 0 and len(unpaid) == 0,
            "missing": missing,
            "unpaid": unpaid,
            "products": list(found.values()),
        }
    except Exception as e:
        logger.error("bulk check-payment error: %s", e)
        raise HTTPException(status_code=500, detail="Internal server error")
