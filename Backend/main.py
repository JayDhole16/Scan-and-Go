from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from supabase import create_client, Client
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment variables")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

class RFIDRequest(BaseModel):
    rfid_id: str

@app.post("/check-payment")
async def check_payment(request: RFIDRequest):
    try:
        response = supabase.table("products").select("is_paid").eq("rfid_id", request.rfid_id).execute()
        if response.data:
            return {"paid": response.data[0]["is_paid"]}
        return {"paid": False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
