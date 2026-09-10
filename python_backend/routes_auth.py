from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from database import get_db
from models import User
import security_2fa
import auth_tokens

router = APIRouter(prefix="/auth", tags=["Autenticação"])
limiter = Limiter(key_func=get_remote_address)

# --- SCHEMAS ---

class RegisterSchema(BaseModel):
    name: str
    email: str
    password: str

class LoginSchema(BaseModel):
    email: str
    password: str

class Login2FASchema(BaseModel):
    pre_auth_token: str
    code: str  # Pode ser o TOTP de 6 dígitos ou um código de resgate

# --- ENDPOINTS ---

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(data: RegisterSchema, db: Session = Depends(get_db)):
    """Cadastra um novo usuário no sistema."""
    existing_user = db.query(User).filter(User.email == data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado.")

    user = User(
        name=data.name,
        email=data.email.lower(),
        hashed_password=security_2fa.hash_password(data.password),
        is_2fa_enabled=False
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {"message": "Usuário registrado com sucesso.", "id": user.id, "email": user.email}


@router.post("/login")
def login(data: LoginSchema, db: Session = Depends(get_db)):
    """
    Etapa 1 do Login:
    - Se o usuário NÃO tiver 2FA ativo, emite o access_token imediatamente.
    - Se o usuário TIVER 2FA ativo, emite um pre_auth_token de 5 min para a Etapa 2.
    """
    user = db.query(User).filter(User.email == data.email.lower()).first()
    if not user or not security_2fa.verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="E-mail ou senha incorretos.")

    if user.is_2fa_enabled:
        pre_auth_token = auth_tokens.create_pre_auth_token(user.id)
        return {
            "status": "2fa_required",
            "message": "Autenticação de dois fatores necessária.",
            "pre_auth_token": pre_auth_token
        }

    access_token = auth_tokens.create_access_token(user.id)
    return {
        "status": "success",
        "access_token": access_token,
        "user": {"id": user.id, "name": user.name, "email": user.email, "is_2fa_enabled": False}
    }


@router.post("/login/2fa")
@limiter.limit("5/minute")
def login_2fa(request: Request, data: Login2FASchema, db: Session = Depends(get_db)):
    """
    Etapa 2 do Login:
    - Recebe o pre_auth_token e o código de 6 dígitos (TOTP) ou código de resgate.
    - Se válido, emite o access_token final. Protegido com rate limit de 5 requisições por minuto.
    """
    try:
        payload = auth_tokens.decode_token(data.pre_auth_token, expected_type="2fa_pending")
        user_id = int(payload["sub"])
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_2fa_enabled or not user.totp_secret:
        raise HTTPException(status_code=400, detail="Configuração de 2FA inválida para este usuário.")

    raw_secret = security_2fa.decrypt_data(user.totp_secret)
    is_valid = False

    # 1. Tentar validar como código TOTP de 6 dígitos
    if len(data.code.strip()) == 6 and data.code.strip().isdigit():
        is_valid = security_2fa.verify_totp_code(raw_secret, data.code)

    # 2. Tentar validar como código de resgate (backup code)
    if not is_valid and user.backup_codes:
        is_valid, updated_backup_codes = security_2fa.verify_and_consume_backup_code(
            user.backup_codes, data.code
        )
        if is_valid:
            user.backup_codes = updated_backup_codes
            db.commit()

    if not is_valid:
        raise HTTPException(status_code=401, detail="Código 2FA ou de resgate inválido.")

    access_token = auth_tokens.create_access_token(user.id)
    return {
        "status": "success",
        "access_token": access_token,
        "user": {"id": user.id, "name": user.name, "email": user.email, "is_2fa_enabled": True}
    }
