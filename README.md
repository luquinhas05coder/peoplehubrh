<div align="center">

# 🏢 PeopleHub RH — Sistema Integrado de Gestão & Atendimento de RH

  <p align="center">
    <b>Plataforma Omnichannel e Hub Completo de Gestão de Recursos Humanos & Departamento Pessoal</b>
    <br />
    Provisionamento Seguro via SMTP • Troca Obrigatória de Senha • RBAC Rigoroso • Escalas & Contratos CLT • Chat Direto • Holerites PDF • 2FA
  </p>

  <p align="center">
    <img src="https://img.shields.io/badge/Vue.js-3.5-4fc08d?style=for-the-badge&logo=vuedotjs&logoColor=white" alt="Vue.js" />
    <img src="https://img.shields.io/badge/Vite-6.0-646cff?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
    <img src="https://img.shields.io/badge/TypeScript-5.7-3178c6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
    <img src="https://img.shields.io/badge/Express-5.0-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express" />
    <img src="https://img.shields.io/badge/SQLite-3-003B57?style=for-the-badge&logo=sqlite&logoColor=white" alt="SQLite" />
    <img src="https://img.shields.io/badge/Nodemailer-SMTP-22b573?style=for-the-badge&logo=gmail&logoColor=white" alt="Nodemailer" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-4.0-38bdf8?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind CSS" />
  </p>

</div>

---

## 📌 Sobre o Projeto

O **PeopleHub RH** é uma solução corporativa completa desenvolvida para modernizar a comunicação, segurança e rotinas operacionais de Recursos Humanos e Departamento Pessoal nas empresas brasileiras. 

A plataforma integra **atendimento omnichannel imediato**, **gestão documental e de onboarding**, **simulador de escalas de trabalho e contratos CLT**, além de uma camada robusta de **segurança cibernética**, com provisionamento automatizado de credenciais por e-mail (SMTP), controle estrito de permissões (RBAC) e autenticação de dois fatores (2FA/TOTP).

---

## ✨ Principais Funcionalidades

### 🔐 1. Provisionamento de Acessos & Segurança de Credenciais
* **Provisionamento Automatizado pelo RH**: O cadastro e criação de acesso à plataforma são centralizados no RH. Ao criar a pasta digital de um novo colaborador, o sistema gera automaticamente uma conta de usuário vinculada.
* **Segredo das Senhas (Zero-Knowledge RH)**: O operador de RH **não visualiza** a senha provisória do funcionário. O sistema gera uma chave criptográfica forte e a despacha diretamente para a caixa postal do colaborador via servidor SMTP.
* **Disparo de E-mail Corporativo (Nodemailer / SMTP)**: E-mails transacionais em HTML estilizado informando as boas-vindas, e-mail de acesso e senha temporária de primeiro acesso.
* **Modal Obrigatório de Primeiro Acesso com Proteção de Rotas**:
  * Ao autenticar com a senha inicial, o colaborador é interceptado por um modal bloqueante (`FirstLoginPasswordModal.vue`).
  * Guarda de rotas global do Vue Router impede navegação antes da troca de senha.
  * Uma vez redefinida para a senha definitiva, a flag `must_change_password` é desativada e o acesso integral é liberado.
* **Recuperação de Senha ("Esqueci Minha Senha")**: Envio de link com token seguro expiráveI por e-mail para redefinição autônoma pelo próprio colaborador.

---

### 🛡️ 2. Perfis de Acesso (RBAC) & Proteção de Dados Funcionais
* **Matriz de Permissões Segmentada**:
  * **RH (Recursos Humanos)**: Gestão de colaboradores, pastas funcionais, chat interno, onboarding e solicitações.
  * **DP (Departamento Pessoal)**: Folha de pagamento, ponto eletrônico, férias, encargos e contracheques.
  * **TI (Tecnologia da Informação / Admin)**: Configurações, segurança, infraestrutura e gestão de perfis de usuário.
  * **Colaborador**: Portal de autoatendimento para consulta de holerites, solicitação de férias, espelho de ponto e suporte.
* **Controle Rigoroso no Perfil do Usuário**:
  * **Cargo / Função e Departamento Protegidos**: Exibidos como **Somente Leitura** (`readonly`) para colaboradores comuns.
  * **Perfil de Acesso & Permissões Bloqueados**: Somente o **Administrador** da plataforma possui privilégios para alterar perfis (RBAC), departamentos e telas permitidas de qualquer colaborador.

---

### 💬 3. Atendimento Ágil & Chat Interno de RH
* **Início Direto em 1 Clique**: Abertura instantânea de chamados sem formulários ou modais intermediários.
* **Envio de Documentos no Chat**: Emissão e envio imediato de **Holerites**, **Folhas de Ponto** e **Declarações** no fluxo da conversa.
* **Ficha Rápida do Colaborador**: Visualização do prontuário, solicitações abertas e histórico em tempo real enquanto atende.

---

### ⏱️ 4. Sistema de Escalas de Trabalho & Tipos de Contrato
* **Tipos de Contratos CLT Regulamentados**:
  * **Prazo Indeterminado**: Vínculo contínuo padrão CLT com garantias completas, FGTS e aviso prévio.
  * **Prazo Determinado**: Contrato pré-fixado para projetos ou substituições (limite de 2 anos - Art. 445 CLT).
  * **Experiência**: Período probatório e de adaptação com limite estrito de 90 dias.
  * **Trabalho Intermitente**: Prestação não contínua com convocação prévia (Art. 452-A CLT).
  * **Prestação de Serviços (PJ)**: Contratação empresarial B2B via Pessoa Jurídica e emissão de NF.
* **Sistemas de Escalas Vigentes**:
  * **Escala 5x2**: 5 dias de trabalho e 2 dias de folga (jornada padrão de 8h48 ou 8h diárias para 44h semanais).
  * **Escala 6x1**: 6 dias de expediente por 1 dia de DSR (varejo, hotelaria e comércio).
  * **Escala 12x36**: 12 horas consecutivas de trabalho com 36 horas ininterruptas de descanso (Art. 59-A CLT).
  * **Escala 4x3**: Modelo de semana de 4 dias com 3 folgas consecutivas.
* **Simulador & Editor de Grade Semanal**:
  * Edição interativa de cada dia da semana (Segunda a Domingo).
  * Configuração de **Horário de Entrada**, **Horário de Saída** e **Intervalo Intrajornada** (1h, 1h12, 1h30, 2h, 30m ou sem intervalo).
  * Presets rápidos em 1 clique (`08:00 - 17:00`, `08:00 - 17:48`, `09:00 - 18:00`, `12h`, `Noturno`, etc.).
  * **Replicar Seg ➔ Sex** com 1 clique para preenchimento ágil da semana útil.
  * Cálculo dinâmico em tempo real da carga horária líquida semanal com verificação de conformidade ao teto constitucional de 44h da CLT.

---

### 👥 5. Gestão de Colaboradores & CBO Oficial
* **Prontuário Digital Completo**: Matrícula, dados contratuais, regime de trabalho, endereço com busca automática ViaCEP e remuneração.
* **Integração CBO ConectaGov**: Pesquisa em tempo real de ocupações oficiais com código e título formal do Ministério do Trabalho.
* **Pasta Digital do Funcionário**: Arquivamento e consulta de contratos, atestados, recibos e documentos admissionais.

---

### 🚀 6. Onboarding & Trilhas de Integração
* **Trilhas Segmentadas**: Criação e gestão de trilhas por departamento (Engenharia, Vendas, Marketing, Geral).
* **Checklists Interativos**: Controle de etapas de documentação, liberação de TI, treinamentos e acompanhamento com mentores/buddies.

---

### 📋 7. Gestão de Solicitações & Requerimentos
* Fluxos estruturados de aprovação com status dinâmicos (Pendente, Em Análise, Aprovado, Recusado):
  * 🌴 **Férias e Licenças**
  * 💸 **Reembolso de Despesas Corporativas**
  * ⏰ **Ajustes de Ponto Eletrônico e Horas Extras**
  * 📝 **Declarações e Alterações Cadastrais**

---

### 📄 8. Emissão de Documentos e Holerites (PDF)
* **Cálculo Automático de Folha**: Proventos, horas extras, descontos progressivos de INSS e IRRF conforme tabelas vigentes.
* **Exportação em PDF**: Emissão profissional de contracheques e folhas de ponto eletrônico prontas para impressão ou download.

---

### 📊 9. Relatórios & Dashboards Analytics
* Gráficos interativos com métricas vitais de RH:
  * Taxa de Turnover e Absenteísmo.
  * Distribuição de colaboradores por escala e regime de contratação.
  * Acompanhamento de solicitações e tempo médio de resolução.

---

### 🔑 10. Autenticação Forte (2FA / TOTP)
* **Segurança 2FA/TOTP**: Suporte a segundo fator de autenticação via **QR Code** (compatível com Google Authenticator, Authy e Microsoft Authenticator).

---

## 🛠️ Arquitetura e Tecnologias

```
peoplehubrh/
├── 🌐 Frontend (Vue 3 + Vite 6 + TypeScript + Tailwind CSS v4)
└── 🟢 Backend Node.js (Express 5 + TypeScript + SQLite / SQL.js + Nodemailer SMTP)
```

| Camada | Tecnologia | Descrição |
| :--- | :--- | :--- |
| **Frontend** | Vue 3 (Composition API) + Vue Router + Pinia | UI reativa, modular, dashboards e gestão de estado |
| **Build & Tooling** | Vite 6 + TypeScript | Compilação ultra veloz e tipagem estática rigorosa |
| **Estilização** | Tailwind CSS v4 + Lucide Icons | Design refinado, responsivo, dark mode e acessibilidade |
| **Backend REST** | Node.js + Express 5 + TypeScript | API RESTful com autenticação JWT, cookies HTTP-Only e RBAC |
| **Disparo de E-mails** | Nodemailer (Servidor SMTP / Gmail) | Envio de credenciais seguras e tokens de recuperação |
| **Banco de Dados** | SQLite / SQL.js + Migrações Automáticas | Persistência local estruturada em `peoplehub.db` com suporte a Multi-Tenancy |

---

## 🚀 Como Executar o Projeto

### Pré-requisitos
* **Node.js** (v18+)
* **npm** ou **pnpm**

---

### 1️⃣ Clonar o Repositório
```bash
git clone https://github.com/luquinhas05coder/peoplehubrh.git
cd chat-de-rh1808
```

---

### 2️⃣ Instalar as Dependências

Instale as dependências da raiz (Frontend) e do Backend Node.js:
```bash
npm install
cd backend
npm install
cd ..
```

---

### 3️⃣ Configurar Variáveis de Ambiente

Crie o arquivo de configuração no diretório `backend/.env`:
```bash
cp backend/.env.example backend/.env
```

Exemplo de configuração com **SMTP do Gmail**:
```env
PORT=3001
JWT_SECRET=peoplehub_rh_secret_key_2026_super_secure
CORS_ORIGIN=http://localhost:5173
DATABASE_PATH=./peoplehub.db
NODE_ENV=development

# Servidor SMTP (E-mails de Boas-Vindas e Troca de Senha)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu_email@gmail.com
SMTP_PASS=sua_senha_de_app_gmail
SMTP_FROM="PeopleHub RH <seu_email@gmail.com>"
APP_URL=http://localhost:5173
```

---

### 4️⃣ Iniciar a Aplicação (Frontend + Backend Concorrentes)

Execute o comando unificado a partir da raiz do projeto:
```bash
npm run dev
```

A aplicação estará disponível em:
* 🖥️ **Aplicação Web (Frontend)**: `http://localhost:5173`
* 🔌 **API REST Node.js (Backend)**: `http://localhost:3001`
* 📘 **Documentação Swagger**: `http://localhost:3001/docs`
* 📊 **Health Check da API**: `http://localhost:3001/api/health`

---

## 📁 Estrutura de Diretórios

```
chat-de-rh1808/
├── 📂 src/                                 # Código Fonte do Frontend (Vue 3)
│   ├── 📂 components/                      # Componentes e Módulos Principais
│   │   ├── 📄 FirstLoginPasswordModal.vue  # Modal bloqueante de troca de senha no 1º acesso
│   │   ├── 📄 ProfileModal.vue             # Modal de perfil com campos e RBAC restritos
│   │   ├── 📄 EscalaContratoCard.vue       # Editor visual de escala semanal e contrato CLT
│   │   ├── 📄 EmployeesModule.vue          # Módulo de colaboradores e pastas funcionais
│   │   ├── 📄 NewEmployeeFolderModal.vue   # Provisionamento de acesso e pasta pelo RH
│   │   ├── 📄 ChatPanel.vue                # Chat de atendimento em 1 clique
│   │   ├── 📄 DocumentsModule.vue          # Emissão de holerites e espelho de ponto em PDF
│   │   ├── 📄 RequestsModule.vue           # Gestão de solicitações (férias, reembolsos)
│   │   ├── 📄 OnboardingModule.vue         # Trilhas e checklists de integração
│   │   └── 📄 LoginPage.vue                # Login, 2FA e fluxo "Esqueci minha senha"
│   ├── 📂 stores/                          # Stores Pinia
│   ├── 📂 router/                          # Configuração de rotas e navegação protegida
│   ├── 📄 store.ts                         # Estado reativo centralizado (dados e permissões)
│   └── 📄 App.vue                          # Componente raiz da aplicação
├── 📂 backend/                             # Backend Node.js / Express 5 API
│   ├── 📂 src/
│   │   ├── 📂 routes/                      # Rotas REST (auth, employees, onboarding, etc.)
│   │   ├── 📂 services/                    # Serviços (mail.service.ts com Nodemailer)
│   │   ├── 📂 middleware/                  # Autenticação JWT e controle de sessão
│   │   ├── 📂 db/                          # Banco de dados SQLite, schemas e migrações
│   │   └── 📄 swagger.ts                   # Documentação OpenAPI / Swagger UI
│   ├── 📄 peoplehub.db                     # Banco de dados SQLite persistido
│   └── 📄 .env.example                     # Modelo de variáveis de ambiente
└── 📄 README.md                            # Documentação oficial do projeto
```

---

## 🛡️ Licença

Este projeto é desenvolvido para fins corporativos e educacionais. Todos os direitos reservados.

---

<div align="center">
  <sub>Desenvolvido com 💚 pela equipe PeopleHub RH</sub>
</div>