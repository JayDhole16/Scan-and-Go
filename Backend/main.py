from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from supabase import create_client, Client
import os

app = FastAPI()

# Supabase credentials (use env vars in production)
SUPABASE_URL = "https://hruslkvlqncfkgyzqiqp.supabase.co"  # e.g., https://xyz.supabase.co
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhydXNsa3ZscW5jZmtneXpxaXFwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODU4NDMyNiwiZXhwIjoyMDg0MTYwMzI2fQ.CSV2V4NCe_OuoCEZwwXENjtd2w2J-q1Lkg7NVBojTOw"  # Use environment variable for security
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

class RFIDRequest(BaseModel):
    rfid_id: str

@app.post("/check-payment")
async def check_payment(request: RFIDRequest):
    try:
        # Query products table
        response = supabase.table("products").select("is_paid").eq("rfid_id", request.rfid_id).execute()
        
        if response.data:
            is_paid = response.data[0]["is_paid"]
            return {"paid": is_paid}
        else:
            # Not found: Treat as not paid
            return {"paid":True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))