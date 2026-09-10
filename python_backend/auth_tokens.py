import os
import jwt
from datetime import datetime, timedelta
from typing import Dict, Any

SECRET_KEY = os.getenv("JWT_SECRET", "chavesecretasupersegura2026rh")
ALGORITHM = "HS256"

def create_pre_auth_token(user_id: int) -> str:
    """Gera token temporário de pré-autenticação de curta duração (5 minutos)."""
    payload = {
        "sub": str(user_id),
        "type": "2fa_pending",
        "exp": datetime.utcnow() + timedelta(minutes=5)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def create_access_token(user_id: int) -> str:
    """Gera token JWT final de acesso (24 horas)."""
    payload = {
        "sub": str(user_id),
        "type": "access",
        "exp": datetime.utcnow() + timedelta(hours=24)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str, expected_type: str) -> Dict[str, Any]:
    """Decodifica o token JWT e garante que ele atende ao tipo esperado e expiração."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != expected_type:
            raise ValueError(f"Tipo de token inválido. Esperado '{expected_type}'")
        return payload
    except jwt.ExpiredSignatureError:
        raise ValueError("Token expirado. Por favor faça login novamente.")
    except jwt.PyJWTError:
        raise ValueError("Token inválido.")
