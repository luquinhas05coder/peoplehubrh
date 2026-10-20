/**
 * swagger.ts — Especificação OpenAPI 3.0 e documentação Swagger UI
 */
export const swaggerSpec = {
  openapi: "3.0.0",
  info: {
    title: "PeopleHub RH API",
    version: "1.0.0",
    description:
      "Documentação interativa e especificação da API RESTful do PeopleHub RH (Plataforma Omnichannel de Recursos Humanos, Chat e Gestão de Colaboradores).",
    contact: {
      name: "Equipe PeopleHub RH",
      email: "rh@empresa.com",
    },
  },
  servers: [
    {
      url: "http://localhost:3001",
      description: "Servidor Local de Desenvolvimento",
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Informe o token JWT obtido no endpoint de verificação 2FA.",
      },
    },
  },
  tags: [
    { name: "Autenticação & 2FA", description: "Login, verificação de dois fatores e controle de sessão JWT" },
    { name: "Chat Omnichannel", description: "Conversas por canal, envio de mensagens e atendimento" },
    { name: "Colaboradores", description: "Diretório de funcionários e pastas de RH" },
    { name: "Solicitações & Chamados", description: "Gestão de solicitações de férias, folha e benefícios" },
    { name: "Documentos", description: "Emissão e histórico de documentos de RH" },
    { name: "Onboarding", description: "Integração e acompanhamento de novos colaboradores" },
    { name: "Relatórios & Métricas", description: "Consolidação de indicadores, SLA e métricas" },
    { name: "Integrações & APIs Externas", description: "Configuração e envio real de mensagens via WhatsApp e E-mail SMTP" },
  ],
  paths: {
    "/api/auth/login": {
      post: {
        tags: ["Autenticação & 2FA"],
        summary: "Iniciar autenticação do usuário",
        description: "Valida e-mail e senha e envia um código de verificação 2FA temporário.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", example: "rh@empresa.com" },
                  password: { type: "string", example: "rh@2026" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Credenciais válidas. Retorna código 2FA de teste e token pendente.",
          },
          "401": { description: "Credenciais inválidas." },
        },
      },
    },
    "/api/auth/verify-mfa": {
      post: {
        tags: ["Autenticação & 2FA"],
        summary: "Validar código 2FA e obter Token de Sessão",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["pendingToken", "code"],
                properties: {
                  pendingToken: { type: "string" },
                  code: { type: "string", example: "123456" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Autenticação concluída com sucesso. Emite o JWT de sessão." },
          "401": { description: "Código 2FA inválido ou expirado." },
        },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Autenticação & 2FA"],
        summary: "Obter perfil do usuário logado",
        security: [{ BearerAuth: [] }],
        responses: {
          "200": { description: "Retorna os dados do usuário autenticado." },
          "401": { description: "Token não fornecido ou inválido." },
        },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["Autenticação & 2FA"],
        summary: "Encerrar sessão do usuário",
        responses: {
          "200": { description: "Sessão encerrada com sucesso." },
        },
      },
    },
    "/api/conversations": {
      get: {
        tags: ["Chat Omnichannel"],
        summary: "Listar conversas do chat",
        parameters: [
          { name: "channel", in: "query", schema: { type: "string" }, description: "Filtrar por canal (whatsapp, email, instagram, telegram)" },
          { name: "topic", in: "query", schema: { type: "string" }, description: "Filtrar por tópico (ferias, folha, beneficios, etc)" },
          { name: "status", in: "query", schema: { type: "string" }, description: "Filtrar por status (aberto, pendente, resolvido)" },
          { name: "priority", in: "query", schema: { type: "string" }, description: "Filtrar por prioridade (baixa, media, alta)" },
          { name: "search", in: "query", schema: { type: "string" }, description: "Busca textual por nome ou conteúdo" },
        ],
        responses: {
          "200": { description: "Lista de conversas filtrada." },
        },
      },
      post: {
        tags: ["Chat Omnichannel"],
        summary: "Iniciar nova conversa",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "channel", "topic"],
                properties: {
                  name: { type: "string", example: "Mariana Costa" },
                  channel: { type: "string", example: "whatsapp" },
                  topic: { type: "string", example: "ferias" },
                  role: { type: "string", example: "Analista de Marketing" },
                  department: { type: "string", example: "Marketing" },
                  initialMessage: { type: "string", example: "Gostaria de agendar minhas férias." },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Conversa criada com sucesso." },
        },
      },
    },
    "/api/conversations/{id}": {
      get: {
        tags: ["Chat Omnichannel"],
        summary: "Obter detalhes de uma conversa",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          "200": { description: "Detalhes e histórico da conversa." },
          "404": { description: "Conversa não encontrada." },
        },
      },
      patch: {
        tags: ["Chat Omnichannel"],
        summary: "Atualizar status, prioridade ou responsável",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string", example: "resolvido" },
                  priority: { type: "string", example: "alta" },
                  assignedTo: { type: "string", example: "Victor Silva" },
                  pinned: { type: "boolean", example: true },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Conversa atualizada com sucesso." },
        },
      },
    },
    "/api/conversations/{id}/messages": {
      post: {
        tags: ["Chat Omnichannel"],
        summary: "Enviar mensagem em uma conversa",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["text"],
                properties: {
                  text: { type: "string", example: "Sua solicitação de férias foi aprovada!" },
                  direction: { type: "string", example: "out" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Mensagem enviada com sucesso." },
        },
      },
    },
    "/api/employees": {
      get: {
        tags: ["Colaboradores"],
        summary: "Listar colaboradores do diretório de RH",
        parameters: [
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "department", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Lista de colaboradores." },
        },
      },
      post: {
        tags: ["Colaboradores"],
        summary: "Criar pasta de colaborador",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "role", "department", "email"],
                properties: {
                  name: { type: "string", example: "Ana Souza" },
                  role: { type: "string", example: "Engenheira de Software" },
                  department: { type: "string", example: "Tecnologia" },
                  email: { type: "string", example: "ana.souza@empresa.com" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Pasta de colaborador criada." },
        },
      },
    },
    "/api/employees/{id}": {
      get: {
        tags: ["Colaboradores"],
        summary: "Obter cadastro do colaborador",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Dados do colaborador." }, "404": { description: "Não encontrado." } },
      },
      patch: {
        tags: ["Colaboradores"],
        summary: "Atualizar dados do colaborador",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Cadastro atualizado." } },
      },
      delete: {
        tags: ["Colaboradores"],
        summary: "Remover colaborador",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Colaborador removido." } },
      },
    },
    "/api/requests": {
      get: {
        tags: ["Solicitações & Chamados"],
        summary: "Listar solicitações de RH",
        responses: {
          "200": { description: "Lista de chamados de RH." },
        },
      },
      post: {
        tags: ["Solicitações & Chamados"],
        summary: "Abrir nova solicitação de RH",
        responses: {
          "201": { description: "Solicitação criada." },
        },
      },
    },
    "/api/requests/{id}": {
      get: {
        tags: ["Solicitações & Chamados"],
        summary: "Obter detalhes de uma solicitação",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Dados da solicitação." }, "404": { description: "Não encontrada." } },
      },
      patch: {
        tags: ["Solicitações & Chamados"],
        summary: "Atualizar solicitação de RH",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Solicitação atualizada." } },
      },
      delete: {
        tags: ["Solicitações & Chamados"],
        summary: "Excluir solicitação de RH",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Solicitação excluída." } },
      },
    },
    "/api/documents": {
      get: {
        tags: ["Documentos"],
        summary: "Listar documentos de RH emitidos",
        responses: {
          "200": { description: "Lista de documentos." },
        },
      },
    },
    "/api/documents/generate": {
      post: {
        tags: ["Documentos"],
        summary: "Gerar/Emitir documento de RH",
        responses: {
          "201": { description: "Documento emitido com sucesso." },
        },
      },
    },
    "/api/documents/{id}": {
      get: {
        tags: ["Documentos"],
        summary: "Obter detalhes de um documento",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Dados do documento." }, "404": { description: "Não encontrado." } },
      },
      delete: {
        tags: ["Documentos"],
        summary: "Excluir documento emitido",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Documento excluído." } },
      },
    },
    "/api/documents/{id}/sign": {
      patch: {
        tags: ["Documentos"],
        summary: "Atualizar status de assinatura do documento",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Status de assinatura atualizado." } },
      },
    },
    "/api/onboarding": {
      get: {
        tags: ["Onboarding"],
        summary: "Listar programas de integração",
        responses: {
          "200": { description: "Lista de novos colaboradores em onboarding." },
        },
      },
    },
    "/api/onboarding/{id}": {
      get: {
        tags: ["Onboarding"],
        summary: "Obter detalhes do onboarding de um colaborador",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Dados do onboarding." }, "404": { description: "Não encontrado." } },
      },
      patch: {
        tags: ["Onboarding"],
        summary: "Atualizar dados do processo de onboarding",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Onboarding atualizado." } },
      },
      delete: {
        tags: ["Onboarding"],
        summary: "Excluir processo de onboarding",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Processo removido." } },
      },
    },
    "/api/reports/metrics": {
      get: {
        tags: ["Relatórios & Métricas"],
        summary: "Obter indicadores gerais e relatórios",
        responses: {
          "200": { description: "Métricas consolidadas de atendimento e RH." },
        },
      },
    },
    "/api/integrations/config": {
      get: {
        tags: ["Integrações & APIs Externas"],
        summary: "Obter configurações das APIs de WhatsApp e E-mail",
        responses: { "200": { description: "Configurações salvas (chaves ofuscadas)." } },
      },
      post: {
        tags: ["Integrações & APIs Externas"],
        summary: "Salvar credenciais de WhatsApp e E-mail SMTP",
        responses: { "200": { description: "Configurações atualizadas." } },
      },
    },
    "/api/integrations/whatsapp/send": {
      post: {
        tags: ["Integrações & APIs Externas"],
        summary: "Disparar mensagem no WhatsApp via API",
        responses: { "200": { description: "Resultado do envio." } },
      },
    },
    "/api/integrations/email/send": {
      post: {
        tags: ["Integrações & APIs Externas"],
        summary: "Disparar e-mail via servidor SMTP",
        responses: { "200": { description: "Resultado do envio." } },
      },
    },
    "/api/integrations/whatsapp/webhook": {
      post: {
        tags: ["Integrações & APIs Externas"],
        summary: "Webhook de recepção de mensagens do WhatsApp",
        responses: { "200": { description: "Webhook processado." } },
      },
    },
  },
}
