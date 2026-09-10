from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from database import engine, Base
import routes_auth
import routes_2fa

# Cria tabelas no banco se não existirem
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Sistema de Autenticação 2FA TOTP (Python)",
    description="API com suporte a Autenticação de 2 Fatores via TOTP, Criptografia Fernet e Códigos de Resgate.",
    version="1.0.0"
)

# Registra o gerenciador de erros para Rate Limit (SlowAPI)
app.state.limiter = routes_auth.limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configuração de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclusão das rotas
app.include_router(routes_auth.router)
app.include_router(routes_2fa.router)

@app.get("/")
def root():
    return {
        "status": "online",
        "service": "2FA TOTP Python API",
        "docs": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
