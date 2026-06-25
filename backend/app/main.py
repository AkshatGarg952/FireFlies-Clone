from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.meetings import router as meetings_router

app = FastAPI(title="Fireflies Clone API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api", tags=["health"])
app.include_router(meetings_router, prefix="/api", tags=["meetings"])


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "Fireflies Clone API is running"}
