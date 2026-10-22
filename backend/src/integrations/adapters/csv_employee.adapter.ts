/**
 * integrations/adapters/csv_employee.adapter.ts — Adaptador de Importação e Exportação CSV de Colaboradores
 *
 * Padrão DP/Folha com encoding UTF-8 com BOM, delimitador configurável (; ou ,),
 * escape seguro de aspas e relatório de validação por linha.
 */

import { getDB, persist } from "../../db/index.js"
import { recordAuditLog } from "../../middleware/rbac.js"
import type { IntegrationAdapter, IntegrationConnectionResult } from "../core/types.js"

export interface CsvImportResult {
  totalRows: number
  successCount: number
  errorCount: number
  errors: Array<{ line: number; email?: string; error: string }>
  importedIds: string[]
}

export class CsvEmployeeAdapter implements IntegrationAdapter<any, any, any> {
  id = "csv_employee_adapter"
  name = "Importação e Exportação CSV de Colaboradores (DP)"
  description = "Exportação e carga em lote de pastas funcionais de colaboradores em formato CSV compatível com Excel e ERPs de RH."
  version = "1.0.0"
  category: "export_import" = "export_import"

  async testConnection(): Promise<IntegrationConnectionResult> {
    return {
      ok: true,
      message: "Adaptador CSV operacional. Motor de serialização e parsing ativo.",
      latency_ms: 1,
    }
  }

  async execute(input: { action: "export" | "import"; [key: string]: any }): Promise<any> {
    if (input.action === "export") {
      return this.exportEmployees(input.employees)
    }
    if (input.action === "import") {
      return this.importEmployees(input.csvContent, input.tenantId, input.operator)
    }
    throw new Error(`Ação '${input.action}' desconhecida para o adaptador CSV.`)
  }

  /**
   * Exporta lista de colaboradores para CSV com BOM UTF-8 e campos seguros
   */
  exportEmployees(employees: any[]): string {
    const BOM = "\uFEFF"
    const headers = [
      "ID_Matricula",
      "Nome_Completo",
      "Cargo",
      "Departamento",
      "Email_Corporativo",
      "Telefone",
      "CPF",
      "Data_Admissao",
      "Salario_Base",
      "Gestor_Imediato",
      "Regime_Contratual",
      "Escala_Trabalho",
      "Status_Cadastral",
    ]

    const escapeCell = (val: any): string => {
      if (val === null || val === undefined) return '""'
      const str = String(val).replace(/"/g, '""')
      return `"${str}"`
    }

    const lines: string[] = [headers.join(";")]

    for (const emp of employees) {
      const row = [
        escapeCell(emp.id),
        escapeCell(emp.name),
        escapeCell(emp.role),
        escapeCell(emp.department),
        escapeCell(emp.email),
        escapeCell(emp.phone),
        escapeCell(emp.cpf),
        escapeCell(emp.hireDate),
        escapeCell(emp.salary),
        escapeCell(emp.manager),
        escapeCell(emp.contractType),
        escapeCell(emp.workSchedule),
        escapeCell(emp.status),
      ]
      lines.push(row.join(";"))
    }

    return BOM + lines.join("\r\n")
  }

  /**
   * Importa lote de colaboradores a partir de CSV com validação detalhada
   */
  importEmployees(
    csvContent: string,
    tenantId: string,
    operator?: { id?: string; name?: string; role?: string }
  ): CsvImportResult {
    const cleanContent = csvContent.replace(/^\uFEFF/, "").trim()
    if (!cleanContent) {
      return { totalRows: 0, successCount: 0, errorCount: 0, errors: [{ line: 0, error: "Arquivo CSV vazio." }], importedIds: [] }
    }

    const rawLines = cleanContent.split(/\r?\n/).filter((l) => l.trim().length > 0)
    if (rawLines.length < 2) {
      return { totalRows: 0, successCount: 0, errorCount: 0, errors: [{ line: 1, error: "O CSV deve conter cabeçalho e ao menos uma linha de dados." }], importedIds: [] }
    }

    // Detectar delimitador (; ou ,)
    const headerLine = rawLines[0]
    const delimiter = headerLine.includes(";") ? ";" : ","

    // Função simples de parse de linha CSV respeitando aspas
    const parseLine = (line: string): string[] => {
      const fields: string[] = []
      let current = ""
      let insideQuote = false

      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
          if (insideQuote && line[i + 1] === '"') {
            current += '"'
            i++
          } else {
            insideQuote = !insideQuote
          }
        } else if (char === delimiter && !insideQuote) {
          fields.push(current.trim())
          current = ""
        } else {
          current += char
        }
      }
      fields.push(current.trim())
      return fields
    }

    const headers = parseLine(headerLine).map((h) => h.toLowerCase().replace(/[^a-z0-9_]/g, "_"))
    const colIndex = (keys: string[]): number => {
      return headers.findIndex((h) => keys.some((k) => h.includes(k)))
    }

    const idxName = colIndex(["nome", "name", "funcionario"])
    const idxRole = colIndex(["cargo", "role", "funcao"])
    const idxDept = colIndex(["departamento", "department", "setor"])
    const idxEmail = colIndex(["email", "e_mail"])
    const idxPhone = colIndex(["telefone", "phone", "celular"])
    const idxCpf = colIndex(["cpf"])
    const idxHire = colIndex(["admissao", "hire", "data_admissao"])
    const idxSalary = colIndex(["salario", "salary", "remuneracao"])
    const idxManager = colIndex(["gestor", "manager", "lider"])
    const idxContract = colIndex(["contrato", "contract", "regime"])
    const idxSchedule = colIndex(["escala", "schedule", "jornada"])

    if (idxName === -1 || idxRole === -1 || idxEmail === -1) {
      return {
        totalRows: rawLines.length - 1,
        successCount: 0,
        errorCount: rawLines.length - 1,
        errors: [{ line: 1, error: "Colunas obrigatórias ausentes no cabeçalho (necessário: Nome, Cargo, Email)." }],
        importedIds: [],
      }
    }

    const db = getDB()
    const errors: Array<{ line: number; email?: string; error: string }> = []
    const importedIds: string[] = []
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    for (let i = 1; i < rawLines.length; i++) {
      const lineNum = i + 1
      const values = parseLine(rawLines[i])

      const name = idxName !== -1 ? values[idxName] || "" : ""
      const role = idxRole !== -1 ? values[idxRole] || "" : ""
      const department = idxDept !== -1 ? values[idxDept] || "Geral" : "Geral"
      const email = idxEmail !== -1 ? (values[idxEmail] || "").trim().toLowerCase() : ""
      const phone = idxPhone !== -1 ? values[idxPhone] || "" : ""
      const cpf = idxCpf !== -1 ? values[idxCpf] || "" : ""
      const hireDate = idxHire !== -1 ? values[idxHire] || new Date().toISOString().split("T")[0] : new Date().toISOString().split("T")[0]
      const salary = idxSalary !== -1 ? values[idxSalary] || "R$ 0,00" : "R$ 0,00"
      const manager = idxManager !== -1 ? values[idxManager] || "Não atribuído" : "Não atribuído"
      const contractType = idxContract !== -1 ? values[idxContract] || "prazo_indeterminado" : "prazo_indeterminado"
      const workSchedule = idxSchedule !== -1 ? values[idxSchedule] || "escala_5x2" : "escala_5x2"

      if (!name) {
        errors.push({ line: lineNum, error: "Nome do colaborador é obrigatório." })
        continue
      }
      if (!role) {
        errors.push({ line: lineNum, error: "Cargo do colaborador é obrigatório." })
        continue
      }
      if (!email || !emailRegex.test(email)) {
        errors.push({ line: lineNum, email, error: "Endereço de e-mail inválido ou ausente." })
        continue
      }

      // Verificar se e-mail já existe
      const existing = db.exec(`SELECT id FROM employees WHERE tenant_id = ? AND lower(email) = ?`, [tenantId, email])
      if (existing.length && existing[0].values.length) {
        errors.push({ line: lineNum, email, error: `Colaborador com e-mail '${email}' já cadastrado na organização.` })
        continue
      }

      const id = `emp_csv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
      try {
        db.run(
          `INSERT INTO employees (id, name, role, department, status, email, phone, cpf, hireDate, salary, manager, location, contractType, workSchedule, tenant_id)
           VALUES (?, ?, ?, ?, 'Ativo', ?, ?, ?, ?, ?, ?, 'Matriz', ?, ?, ?)`,
          [id, name, role, department, email, phone, cpf, hireDate, salary, manager, contractType, workSchedule, tenantId]
        )
        importedIds.push(id)
      } catch (insertErr: any) {
        errors.push({ line: lineNum, email, error: `Erro de banco de dados: ${insertErr.message}` })
      }
    }

    if (importedIds.length > 0) {
      persist()
      recordAuditLog({
        userId: operator?.id || "sys_csv",
        userName: operator?.name || "Operador CSV",
        userRole: operator?.role || "ADMIN",
        action: "EMPLOYEE_CSV_IMPORT",
        entity: "employees",
        entityId: `batch_${Date.now()}`,
        details: { importedCount: importedIds.length, errorCount: errors.length },
        tenantId,
      })
    }

    return {
      totalRows: rawLines.length - 1,
      successCount: importedIds.length,
      errorCount: errors.length,
      errors,
      importedIds,
    }
  }
}

export const csvEmployeeAdapter = new CsvEmployeeAdapter()
