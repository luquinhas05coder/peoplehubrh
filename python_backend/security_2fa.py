import os
import io
import json
import base64
import secrets
import pyotp
import qrcode
from cryptography.fernet import Fernet
from typing import List, Tuple
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Chave de criptografia Fernet estável
# Em produção, defina a variável de ambiente ENCRYPTION_KEY com Fernet.generate_key().decode()
_DEFAULT_KEY = b'G1Z2a_3K_4M5N6O7P8Q9R0S1T2U3V4W5X6Y7Z8a9b0c='
FERNET_KEY = os.getenv("ENCRYPTION_KEY", _DEFAULT_KEY.decode())
fernet = Fernet(FERNET_KEY.encode())

# --- CRIPTOGRAFIA DE SENHAS ---

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

# --- CRIPTOGRAFIA SIMÉTRICA (FERNET) ---

def encrypt_data(data: str) -> str:
    """Criptografa dados sensíveis em string Fernet Base64."""
    return fernet.encrypt(data.encode()).decode()

def decrypt_data(token: str) -> str:
    """Descriptografa token Fernet de volta para texto em claro."""
    return fernet.decrypt(token.encode()).decode()

# --- FUNÇÕES TOTP E QR CODE ---

def generate_totp_secret() -> str:
    """Gera um segredo Base32 único aleatório."""
    return pyotp.random_base32()

def get_totp_uri(secret: str, user_email: str, issuer_name: str = "PeopleHub RH") -> str:
    """Gera a URI OTPAuth para ser lida por aplicativos de 2FA (Google Authenticator, Authy, etc)."""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=user_email, issuer_name=issuer_name)

def generate_qr_code_base64(totp_uri: str) -> str:
    """Converte a URI OTPAuth em uma imagem PNG em formato Base64."""
    img = qrcode.make(totp_uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64_img = base64.b64encode(buf.getvalue()).decode()
    return f"data:image/png;base64,{b64_img}"

def verify_totp_code(secret: str, code: str) -> bool:
    """Valida o código de 6 dígitos informados com janela de tolerância de +/- 30s."""
    totp = pyotp.TOTP(secret)
    return totp.verify(code.strip(), valid_window=1)

# --- CÓDIGOS DE RESGATE (BACKUP CODES) ---

def generate_backup_codes(count: int = 5) -> Tuple[List[str], str]:
    """
    Gera códigos de resgate de uso único.
    Retorna: (códigos_em_texto_limpo, json_criptografado_para_banco)
    """
    plain_codes = [secrets.token_hex(4).upper() for _ in range(count)]
    encrypted_json = encrypt_data(json.dumps(plain_codes))
    return plain_codes, encrypted_json

def verify_and_consume_backup_code(encrypted_json_codes: str, input_code: str) -> Tuple[bool, str]:
    """
    Verifica se um código de resgate é válido. Se sim, remove-o da lista (uso único).
    Retorna: (is_valid, novo_json_criptografado)
    """
    if not encrypted_json_codes:
        return False, encrypted_json_codes

    plain_codes: List[str] = json.loads(decrypt_data(encrypted_json_codes))
    normalized_input = input_code.strip().upper()

    if normalized_input in plain_codes:
        plain_codes.remove(normalized_input)
        updated_encrypted_json = encrypt_data(json.dumps(plain_codes))
        return True, updated_encrypted_json

    return False, encrypted_json_codes
