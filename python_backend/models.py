from sqlalchemy import Column, Integer, String, Boolean, Text
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)

    # Campos de Autenticação de Dois Fatores (2FA)
    totp_secret = Column(String, nullable=True)        # Segredo TOTP (Criptografado com Fernet)
    is_2fa_enabled = Column(Boolean, default=False, nullable=False)
    backup_codes = Column(Text, nullable=True)         # JSON Criptografado com lista de códigos de resgate
