from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime, timedelta
import jwt
import bcrypt
from sqlalchemy import select
from app.database import get_db
from app.models.user import User

router = APIRouter()

SECRET_KEY = "your-secret-key-change-in-production"
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24

class SignupRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class AuthResponse(BaseModel):
    token: str
    user: dict

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": user_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

@router.post("/signup")
async def signup(req: SignupRequest):
    async for db in get_db():
        existing = await db.execute(select(User).where(User.email == req.email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already registered")
        
        user = User(name=req.name, email=req.email, password_hash=hash_password(req.password))
        db.add(user)
        await db.commit()
        await db.refresh(user)
        
        return {"token": create_token(user.id), "user": {"id": user.id, "name": user.name, "email": user.email}}

@router.post("/login")
async def login(req: LoginRequest):
    async for db in get_db():
        result = await db.execute(select(User).where(User.email == req.email))
        user = result.scalar_one_or_none()
        
        if not user or not verify_password(req.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        return {"token": create_token(user.id), "user": {"id": user.id, "name": user.name, "email": user.email}}

@router.get("/me")
async def get_me(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    async for db in get_db():
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return {"id": user.id, "name": user.name, "email": user.email}

