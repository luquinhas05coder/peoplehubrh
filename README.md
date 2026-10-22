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

### 🛡️ 2. Sistema Completo de Perfis de Acesso (RBAC — Role-Based Access Control)
O PeopleHub RH conta com um sistema corporativo rigoroso de controle de acesso baseado em funções, com garantia de bloqueio em nível de backend (HTTP 401 e HTTP 403), isolamento de escopos de dados em SQL e trilha de auditoria:

* **As 4 Funções Oficiais (Roles)**:
  * **`ADMIN` (Administrador Geral)**: Acesso irrestrito a todas as configurações, painéis, auditoria, alteração de perfis e gestão de usuários (`/usuarios`).
  * **`RH` (Recursos Humanos & DP)**: Acesso integral a todos os colaboradores da empresa (`ALL`), criação e exclusão de pastas funcionais, gestão completa de folha de pagamento, contracheques, documentos, férias e aprovações.
  * **`GESTOR` (Gestão de Equipe)**: Acesso restrito ao escopo da sua equipe e liderados diretos (`TEAM`). Pode visualizar colaboradores do seu departamento, gerenciar escalas mensais, e aprovar solicitações de seus liderados (com bloqueio estrito contra aprovação do próprio requerimento).
  * **`COLABORADOR` (Autoatendimento)**: Acesso estritamente pessoal (`OWN`). Visualiza unicamente o seu próprio prontuário, espelho de ponto, contracheques emitidos e solicitações abertas. Bloqueado de criar funcionários, alterar dados de outros ou aprovar solicitações.

* **Escopos de Dados em Nível de Banco de Dados**:
  * **`ALL`** (Admin e RH): Consultas executam sem restrição departmental.
  * **`TEAM`** (Gestor): Consultas filtram automaticamente por `department = ? OR manager = ?`.
  * **`OWN`** (Colaborador): Consultas filtram estritamente pelo e-mail/identificador do usuário autenticado.

* **Mascaramento Automático de Dados Sensíveis**:
  * Usuários sem a permissão `employees.view_sensitive` (Gestores e Colaboradores) têm campos sensíveis como **Salário Base** exibidos como `"Confidencial"` e **CPF** ofuscado (`123.***.***-**`), com exceção do colaborador consultando o seu próprio perfil pessoal.

* **Governança & Anti-Autoaprovação**:
  * Nenhum usuário (mesmo Gestores ou Administradores) pode aprovar ou rejeitar suas próprias solicitações de férias ou contracheques (`HTTP 403: Violação de Governança`).

* **Módulo Administrativo de Usuários (`/usuarios`)**:
  * Painel restrito ao `ADMIN` para listar, criar, editar dados cadastrais, alterar funções e ativar/desativar contas.
  * Modal com aviso de segurança explícito e confirmação antes de alterar a role de qualquer membro da organização.
  * Bloqueio contra auto-despromoção e auto-desativação do administrador ativo.

* **Trilha de Auditoria Imutável (`/api/users/audit`)**:
  * Tabela `audit_logs` que registra de forma definitiva todas as ações críticas: `ALTERAR_ROLE`, `ATIVAR_USUARIO`, `DESATIVAR_USUARIO`, `EMPLOYEE_CREATE`, `EMPLOYEE_DELETE`, `REQUEST_STATUS_CHANGE`, acompanhado do autor, timestamp e endereço IP.

* **Execução dos Testes Automatizados de Segurança**:
  ```bash
  cd backend && node test-rbac-permissions.js
  ```

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

### 👤 8. Perfil Completo do Funcionário & Dossiê (`/funcionarios/:id`)
* **Rota Dedicada**: `/funcionarios/:id` acessível diretamente através do botão `[Ver Perfil]` na listagem de colaboradores.
* **Header do Funcionário**:
  * Foto/Avatar, nome completo, cargo, departamento, status cadastral com badge padronizada, ID/matrícula e botões de ação ("Editar Funcionário" e "Dossiê PDF").
* **Navegação por 7 Abas Especializadas**:
  1. **Aba Resumo**: Cargo, departamento, data de admissão, tempo de empresa calculado, status, salário base (respeitando RBAC), gestor imediato, email e telefone corporativo. Acompanha 4 cards resumidos (Férias disponíveis, Chamados pendentes, Documentos cadastrados e Tempo de casa).
  2. **Aba Dados Pessoais**: Nome completo, CPF (com proteção e mascaramento de dígitos para usuários sem privilégio de folha), data de nascimento, email, telefone, CEP e endereço completo.
  3. **Aba Dados Profissionais**: Parâmetros contratuais CLT (tipo de contrato com badge, escala de trabalho, admissão, desligamento, salário base e gestor imediato).
  4. **Aba Documentos**: Repositório de documentos digitais com tipo de arquivo, nome, data de upload, validade, status de validade (*Válido*, *Próximo do vencimento* ou *Expirado*), além de botões de **Visualizar** e **Download**.
  5. **Aba Férias**: Painel dos 30 dias regulamentares de férias (dias disponíveis, dias usufruídos e próximo período aquisitivo) acompanhado do histórico detalhado de solicitações de férias e seus pareceres.
  6. **Aba Solicitações**: Linha de chamados funcionais (férias, ponto, atestados, reembolsos) com protocolo, status, responsável e filtro seletivo por status.
  7. **Aba Histórico & Auditoria**: Linha do tempo visual (*Timeline*) auditada pela tabela `employee_history`, rastreando promoções de cargo, reajustes salariais, transferências de departamento, alterações de status cadastral e admissão.
* **Listagem Integrada de Colaboradores**:
  * Botão `[Ver Perfil]` em cada card de colaborador e na tabela.
  * **Busca em tempo real**, **Filtro por departamento**, **Filtro por status**, **Filtro por contrato**, **Filtro por escala**, **Ordenação dinâmica** (A-Z, Z-A, Admissão Recente, Matrícula) e **Paginação responsiva**.

---

### 📊 9. Dashboard Executivo de RH (Dados Reais do SQLite)
* **Endpoint Dedicado**: `GET /api/dashboard` consolidando métricas da organização em tempo real:
  * **8 Cards de Métricas Operacionais**:
    1. Total de Funcionários
    2. Colaboradores Ativos
    3. Colaboradores Inativos / Afastados
    4. Contratações no Mês (admissões recentes)
    5. Desligamentos no Mês (turnover do período)
    6. Solicitações Pendentes (em tramitação no RH)
    7. Férias Pendentes (pedidos em análise)
    8. Documentos Próximos do Vencimento (ASO, CNH, contratos < 30 dias)
  * **Gráficos Interativos (Chart.js / Vue-ChartJS)**:
    1. **Funcionários por Departamento**: Distribuição do efetivo por setor (TI, RH, Financeiro, Comercial, etc.).
    2. **Contratações vs Desligamentos por Mês**: Comparativo semestral de admissões e desligamentos.
    3. **Distribuição por Status**: Gráfico em rosca (Doughnut) com a situação cadastral.
    4. **Evolução do Quadro**: Curva histórica de crescimento do headcount corporativo.
    5. **Distribuição por Cargo**: Top funções com maior volume de colaboradores.
  * **Resiliência e UX**: Estados de carregamento com *skeleton loaders*, tratamento de erro com botão "Tentar Novamente", estado vazio e atualização instantânea.

---

### 🎯 10. Módulo Profissional de Recrutamento & Seleção (ATS Pro)
Módulo corporativo completo de Applicant Tracking System (ATS), integrado à autenticação RBAC, calendário corporativo e banco de dados SQLite:

* **Gestão de Vagas**:
  * Criação, edição, publicação, pausa e encerramento de posições com controle de data de abertura e fechamento.
  * Suporte a modalidades (Remoto, Híbrido, Presencial), contratos (CLT, PJ, Estágio), quantidade de vagas e benefícios.
  * **Salários Confidenciais**: Quando marcado como confidencial, valores monetários são estritamente mascarados na API pública.
* **Portal Público de Carreiras (`/vagas-publicas`)**:
  * Vitrine moderna de oportunidades acessível sem necessidade de login.
  * Busca em tempo real por cargo, palavra-chave, departamento e modalidade de trabalho.
  * Modal de candidatura online com upload de currículo (PDF/DOCX/TXT até 5MB) e validação de MIME type.
  * **Conformidade LGPD**: Consentimento obrigatório e registrado com timestamp para auditoria de proteção de dados.
  * **Prevenção de Duplicidades**: Restrição por chave única `tenant_id + job_id + candidate_id` com HTTP 409 em tentativas repetidas.
* **Pipeline Seletivo (Kanban Visual)**:
  * Etapas organizadas: *Inscrição*, *Triagem*, *Entrevista*, *Teste Técnico*, *Aprovado*, *Reprovado* e *Contratado*.
  * Movimentação de candidatos entre etapas com parecer/feedback da transição e persistência na timeline do dossiê.
  * Notificações internas automáticas para o time de RH a cada nova candidatura ou contratação.
* **Entrevistas & Scorecards Estruturados**:
  * Agendamento de entrevistas integrado automaticamente ao **Calendário Corporativo** (`calendar_events`).
  * Scorecard com notas de 1 a 5 estrelas para competências técnicas, comportamentais e aderência cultural.
  * Recomendação formal (*Aprovar*, *Reprovar*, *Neutro*) e parecer detalhado.
* **Download Seguro de Documentos**:
  * Download de currículos protegido por RBAC (`GET /api/recruitment/candidates/:id/resume`), sem links públicos estáticos desprotegidos.
* **Indicadores ATS (Analytics)**:
  * Funil visual de conversão entre etapas.
  * Tempo Médio de Contratação (*Time to Hire* em dias).
  * Distribuição de candidatos por canais de atração (LinkedIn, Site de Carreiras, Indicação, Gupy).

---

### 🙋‍♂️ 11. Portal de Autoatendimento do Colaborador (Employee Self-Service)
Módulo integrado que empodera o colaborador com autonomia para consultar seu dossiê funcional, abrir requerimentos com anexos, gerenciar documentos e solicitar correções cadastrais com governança corporativa:

* **Área Pessoal & Dossiê Funcional (`/autoatendimento`)**:
  * Consulta do prontuário individual via `GET /api/employees/me` (filtrado estritamente para o usuário autenticado por `scope === 'OWN'`).
  * Exibição clara de cargo, departamento, gestor imediato, data de admissão e saldo de férias regulamentares.
  * Botão **"Solicitar Alteração Cadastral"** (`POST /api/employees/me/request-update`):
    * Permite propor correções em telefone, CEP, endereço residencial, contato de emergência e notas.
    * **Segurança e Governança**: Dados sensíveis **não são aplicados automaticamente**. O sistema gera uma solicitação formal categorizada como `Atualização Cadastral`, contendo o *diff* estruturado entre os dados vigentes e os dados propostos, notificando o RH para triagem.

* **Fluxo Completo de Solicitações & Linha do Tempo**:
  * Abertura de requerimentos em categorias regulamentadas: *Atualização Cadastral*, *Declaração de Vínculo*, *Comprovante de Rendimentos*, *Férias*, *Reembolso* e *Ajuste de Ponto*.
  * Suporte a anexos de comprovantes e documentos (PDF, PNG, JPG, DOCX até 5MB).
  * **Timeline Interativa & Pendências** (`GET` e `POST /api/requests/:id/comments`): Diálogo transparente entre colaborador e operador de RH dentro do próprio requerimento.
  * **Cancelamento Autônomo**: O solicitante pode cancelar sua própria solicitação enquanto estiver com status *Pendente* ou *Em Análise*, sem depender de permissões de aprovação de RH. Tentativas de cancelar solicitações de terceiros são estritamente bloqueadas com `HTTP 403`.

* **Área de Governança do RH (Fila de Homologação)**:
  * Painel consolidado para operadores de RH e gestores avaliarem requerimentos pendentes.
  * Ações auditadas: **Aprovar**, **Rejeitar** ou **Solicitar Correções** (*"Correção Solicitada"*).
  * **Justificativa Obrigatória**: Recusas e pedidos de correção exigem justificativa explicativa, adicionada automaticamente à linha do tempo e notificada ao colaborador.
  * **Prevenção Rígida de Autoaprovação**: Bloqueio sistêmico com `HTTP 403: Violação de Governança` impedindo que qualquer usuário aprove ou homologue sua própria solicitação.
  * **Aplicação Cadastral Automática na Aprovação**: Quando o RH aprova uma `Atualização Cadastral`, os novos dados são aplicados de forma atômica à tabela `employees` e um evento de auditoria é registrado na `employee_history`.

* **Gestão e Proteção Documental**:
  * **Partição Documental Clara**:
    * **Documentos Pessoais**: Certidões, comprovantes de residência e atestados enviados pelo próprio colaborador.
    * **Documentos Administrativos**: Contratos de trabalho CLT, declarações institucionais e comprovantes emitidos pelo RH.
  * **Upload Validado**: Endpoint `POST /api/documents/upload` com verificação estrita de MIME types autorizados e limite de tamanho.
  * **Prevenção contra IDOR (Insecure Direct Object Reference)**: O download (`GET /api/documents/:id/download`) e visualização são protegidos por escopo `OWN`, impedindo que colaboradores acessem ou baixem documentos de outros funcionários.

---

### 🧪 12. Bateria Completa de Testes Automatizados (CI/CD)
O projeto conta com suíte integrada de testes unitários, testes de integração, testes RBAC, ATS e Autoatendimento:

```bash
# Executar todos os testes (Frontend e Backend)
npm test

# Executar apenas testes de componentes Vue 3 (Vitest)
npm run test:frontend

# Executar testes de APIs, RBAC, ATS e Autoatendimento (Node.js)
npm run test:backend

# Executar suíte específica do Portal de Autoatendimento
node backend/test-self-service.js

# Executar auditoria de segurança (Headers, OWASP, Anti-Enumeração)
npm run test:security
```

---

## 📁 Estrutura de Diretórios

```
chat-de-rh1808/
├── 📂 src/                                 # Código Fonte do Frontend (Vue 3)
│   ├── 📂 components/                      # Componentes e Módulos Principais
│   │   ├── 📄 DashboardView.vue            # Dashboard executivo com 8 cards e 4 gráficos reais
│   │   ├── 📄 EmployeeProfilePage.vue      # Perfil completo do funcionário com 7 abas funcionais
│   │   ├── 📄 HomeWorkspace.vue            # Workspace principal com dashboard integrado
│   │   ├── 📄 EmployeesModule.vue          # Gestão de colaboradores com busca, filtros, ordenação e paginação
│   │   ├── 📄 NewEmployeeFolderModal.vue   # Provisionamento e edição completa de colaboradores
│   │   ├── 📄 ExportDossierModal.vue       # Exportação de dossiê completo em PDF
│   │   ├── 📄 DocumentsModule.vue          # Emissão de holerites e espelho de ponto em PDF
│   │   ├── 📄 SelfServicePortal.vue        # Portal de Autoatendimento do Colaborador (dossiê, solicitações, documentos)
│   │   ├── 📄 RecruitmentModule.vue        # Módulo ATS (vagas, pipeline seletivo, entrevistas, scorecards)
│   │   ├── 📄 OnboardingModule.vue         # Trilhas e checklists de integração
│   │   └── 📄 LoginPage.vue                # Login, 2FA e fluxo "Esqueci minha senha"
│   ├── 📂 router/                          # Rotas: /dashboard, /home, /autoatendimento, /recrutamento, etc.
│   ├── 📄 store.ts                         # Estado reativo, apiFetch autenticado e RBAC
│   └── 📄 App.vue                          # Componente raiz da aplicação
├── 📂 backend/                             # Backend Node.js / Express 5 API
│   ├── 📂 src/
│   │   ├── 📂 routes/
│   │   │   ├── 📄 dashboard.routes.ts      # API GET /api/dashboard (métricas consolidadas reais)
│   │   │   ├── 📄 employees.routes.ts      # API GET/PUT /api/employees e /api/funcionarios
│   │   │   ├── 📄 auth.routes.ts           # Login, JWT, MFA e recuperação de senha
│   │   │   └── 📄 ...                      # Demais rotas (requests, documents, contracheques)
│   │   ├── 📂 db/                          # SQLite (tabelas employees, employee_history, requests, documents)
│   ├── 📄 peoplehub.db                     # Banco de dados SQLite persistente
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