"""
Script de Teste de Integração 2FA TOTP em Python
Testa o fluxo completo sem depender de requisições HTTP externas rodando as funções e FastAPI TestClient.
"""
import sys
import os

# Adiciona o diretório atual ao path
sys.path.insert(0, os.path.dirname(__file__))

from fastapi.testclient import TestClient
import pyotp

from main import app
from database import engine, Base

# Recria o banco de dados limpo para os testes
Base.metadata.drop_all(bind=engine)
Base.metadata.create_all(bind=engine)

client = TestClient(app)

def run_tests():
    print("=" * 60)
    print("🚀 INICIANDO TESTES DO FLUXO COMPLETO 2FA TOTP EM PYTHON")
    print("=" * 60)

    # 1. Registrar Usuário
    print("\n[1] Registrando novo usuário...")
    res = client.post("/auth/register", json={
        "name": "Maria Silva",
        "email": "maria@empresa.com",
        "password": "SenhaSegura123!"
    })
    assert res.status_code == 201, f"Falha no registro: {res.text}"
    print("  ✅ Usuário registrado com sucesso!")

    # 2. Login Inicial (Sem 2FA)
    print("\n[2] Efetuando login inicial (sem 2FA ativado)...")
    res = client.post("/auth/login", json={
        "email": "maria@empresa.com",
        "password": "SenhaSegura123!"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    access_token = data["access_token"]
    print("  ✅ Login efetuado com sucesso! Access Token obtido.")

    # 3. Solicitar Setup do 2FA
    print("\n[3] Solicitando /2fa/setup para obter QR Code e Segredo...")
    headers = {"Authorization": f"Bearer {access_token}"}
    res = client.post("/2fa/setup", headers=headers)
    assert res.status_code == 200
    setup_data = res.json()
    manual_key = setup_data["manual_entry_key"]
    qr_code_b64 = setup_data["qr_code_base64"]

    assert len(manual_key) == 32
    assert qr_code_b64.startswith("data:image/png;base64,")
    print(f"  ✅ Chave manual gerada: {manual_key}")
    print(f"  ✅ Imagem QR Code gerada (Base64 length: {len(qr_code_b64)})")

    # 4. Confirmar 2FA com primeiro código de 6 dígitos gerado via pyotp
    print("\n[4] Confirmando /2fa/confirm com o código TOTP de 6 dígitos...")
    totp = pyotp.TOTP(manual_key)
    first_code = totp.now()

    res = client.post("/2fa/confirm", json={"code": first_code}, headers=headers)
    assert res.status_code == 200, f"Erro ao confirmar 2FA: {res.text}"
    confirm_data = res.json()
    backup_codes = confirm_data["backup_codes"]
    assert len(backup_codes) == 5
    print(f"  ✅ 2FA Ativado com sucesso!")
    print(f"  ✅ 5 Códigos de resgate gerados: {backup_codes}")

    # 5. Testar Login Etapa 1 com 2FA Ativo
    print("\n[5] Testando /auth/login (Etapa 1) com 2FA Ativo...")
    res = client.post("/auth/login", json={
        "email": "maria@empresa.com",
        "password": "SenhaSegura123!"
    })
    assert res.status_code == 200
    login_step1 = res.json()
    assert login_step1["status"] == "2fa_required"
    pre_auth_token = login_step1["pre_auth_token"]
    print("  ✅ Etapa 1 concluiu com sucesso! Pré-auth token obtido.")

    # 6. Testar Login Etapa 2 com Código TOTP Válido
    print("\n[6] Testando /auth/login/2fa (Etapa 2) com Código TOTP...")
    valid_totp_code = totp.now()
    res = client.post("/auth/login/2fa", json={
        "pre_auth_token": pre_auth_token,
        "code": valid_totp_code
    })
    assert res.status_code == 200, f"Erro na Etapa 2: {res.text}"
    login_step2 = res.json()
    assert login_step2["status"] == "success"
    print("  ✅ Etapa 2 (TOTP) efetuada com sucesso! JWT de sessão emitido.")

    # 7. Testar Login Etapa 2 com Código de Resgate (Backup Code)
    print("\n[7] Testando /auth/login/2fa (Etapa 2) com Código de Resgate...")
    # Faz Etapa 1 novamente para pegar novo pre_auth_token
    res = client.post("/auth/login", json={
        "email": "maria@empresa.com",
        "password": "SenhaSegura123!"
    })
    pre_auth_token_2 = res.json()["pre_auth_token"]

    used_backup_code = backup_codes[0]
    print(f"  Uso do código de resgate: {used_backup_code}")
    res = client.post("/auth/login/2fa", json={
        "pre_auth_token": pre_auth_token_2,
        "code": used_backup_code
    })
    assert res.status_code == 200, f"Erro com backup code: {res.text}"
    print("  ✅ Login efetuado com sucesso usando Código de Resgate!")

    # 8. Testar reuso do mesmo código de resgate (Deve falhar!)
    print("\n[8] Testando tentativa de reuso do mesmo Código de Resgate (deve ser rejeitado)...")
    res = client.post("/auth/login", json={
        "email": "maria@empresa.com",
        "password": "SenhaSegura123!"
    })
    pre_auth_token_3 = res.json()["pre_auth_token"]

    res = client.post("/auth/login/2fa", json={
        "pre_auth_token": pre_auth_token_3,
        "code": used_backup_code
    })
    assert res.status_code == 401
    print("  ✅ Rejeição confirmada! O código de resgate é estritamente de uso único.")

    print("\n" + "=" * 60)
    print("🎉 TODOS OS TESTES PASSARAM COM SUCESSO!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()
