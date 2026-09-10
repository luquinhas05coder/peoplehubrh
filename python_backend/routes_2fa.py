from fastapi import APIRouter, Depends, HTTPException, Header, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from database import get_db
from models import User
import security_2fa
import auth_tokens

router = APIRouter(prefix="/2fa", tags=["Configuração 2FA"])
limiter = Limiter(key_func=get_remote_address)

class Confirm2FASchema(BaseModel):
    code: str

def get_current_user(authorization: str = Header(None), db: Session = Depends(get_db)) -> User:
    """Injeta o usuário logado via Header 'Authorization: Bearer <token>'."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Header de autorização ausente ou malformatado.")

    token = authorization.split(" ")[1]
    try:
        payload = auth_tokens.decode_token(token, expected_type="access")
        user_id = int(payload["sub"])
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    return user


@router.post("/setup")
def setup_2fa(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Gera o segredo TOTP único e retorna a imagem QR Code Base64 e chave manual.
    O segredo fica temporariamente salvo em estado desativado (is_2fa_enabled=False).
    """
    if current_user.is_2fa_enabled:
        raise HTTPException(status_code=400, detail="O 2FA já está ativado para esta conta.")

    secret = security_2fa.generate_totp_secret()
    totp_uri = security_2fa.get_totp_uri(secret, current_user.email)
    qr_code_b64 = security_2fa.generate_qr_code_base64(totp_uri)

    # Criptografa o segredo antes de salvar no banco
    current_user.totp_secret = security_2fa.encrypt_data(secret)
    db.commit()

    return {
        "message": "Escaneie o QR Code no seu aplicativo de autenticação (Google Authenticator, Authy).",
        "manual_entry_key": secret,
        "qr_code_base64": qr_code_b64
    }


@router.post("/confirm")
@limiter.limit("5/minute")
def confirm_2fa(request: Request, data: Confirm2FASchema, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Valida o primeiro código de 6 dígitos gerado pelo app.
    Se correto:
    - Ativa definitivamente o 2FA (is_2fa_enabled = True).
    - Gera e retorna 5 códigos de resgate (backup codes).
    """
    if current_user.is_2fa_enabled or not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="Solicitação de ativação de 2FA pendente não encontrada.")

    raw_secret = security_2fa.decrypt_data(current_user.totp_secret)

    if not security_2fa.verify_totp_code(raw_secret, data.code):
        raise HTTPException(status_code=400, detail="Código de verificação de 6 dígitos incorreto.")

    # Gera 5 códigos de resgate de uso único
    plain_backup_codes, encrypted_backup_json = security_2fa.generate_backup_codes(count=5)

    current_user.is_2fa_enabled = True
    current_user.backup_codes = encrypted_backup_json
    db.commit()

    return {
        "message": "2FA ativado com sucesso!",
        "backup_codes": plain_backup_codes  # Exibidos somente nesta resposta!
    }


@router.post("/disable")
def disable_2fa(data: Confirm2FASchema, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Permite desativar o 2FA mediante validação de código TOTP atual."""
    if not current_user.is_2fa_enabled or not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="O 2FA não está ativado nesta conta.")

    raw_secret = security_2fa.decrypt_data(current_user.totp_secret)
    if not security_2fa.verify_totp_code(raw_secret, data.code):
        raise HTTPException(status_code=400, detail="Código 2FA incorreto para confirmação.")

    current_user.is_2fa_enabled = False
    current_user.totp_secret = None
    current_user.backup_codes = None
    db.commit()

    return {"message": "2FA desativado com sucesso."}
