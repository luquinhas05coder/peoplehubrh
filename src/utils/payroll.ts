export interface HoleriteItem {
  code: string
  description: string
  reference: string
  proventos: number
  descontos: number
  type: "provento" | "desconto"
}

export interface HoleriteCalculado {
  salarioBase: number
  proventosTotais: number
  descontosTotais: number
  salarioLiquido: number
  items: HoleriteItem[]
  baseINSS: number
  valorINSS: number
  baseIRPF: number
  valorIRPF: number
  baseFGTS: number
  valorFGTS: number
  mesAnoReferencia: string
}

export function calcularINSS(salarioBruto: number): number {
  let inss = 0
  const f1 = 1518.00
  const f2 = 2793.88
  const f3 = 4190.83
  const f4 = 8157.41 // Teto

  const valorTeto = Math.min(salarioBruto, f4)

  if (valorTeto > 0) {
    const b1 = Math.min(valorTeto, f1)
    inss += b1 * 0.075
  }
  if (valorTeto > f1) {
    const b2 = Math.min(valorTeto, f2) - f1
    inss += b2 * 0.09
  }
  if (valorTeto > f2) {
    const b3 = Math.min(valorTeto, f3) - f2
    inss += b3 * 0.12
  }
  if (valorTeto > f3) {
    const b4 = valorTeto - f3
    inss += b4 * 0.14
  }

  return Math.round(inss * 100) / 100
}

export function calcularIRPF(baseIRPF: number): number {
  if (baseIRPF <= 2259.20) return 0
  if (baseIRPF <= 2826.65) return Math.round((baseIRPF * 0.075 - 169.44) * 100) / 100
  if (baseIRPF <= 3751.05) return Math.round((baseIRPF * 0.15 - 381.44) * 100) / 100
  if (baseIRPF <= 4664.68) return Math.round((baseIRPF * 0.225 - 662.77) * 100) / 100
  return Math.round((baseIRPF * 0.275 - 896.00) * 100) / 100
}

export function calcularHoleriteCompleto(
  salarioStr: string,
  mesAnoStr: string = "08/2026",
  opts?: {
    horasExtrasVal?: number
    temVT?: boolean
    planoSaudeVal?: number
    customItems?: HoleriteItem[]
  }
): HoleriteCalculado {
  // Se foi fornecida lista customizada de rubricas, recalcula com base nela
  if (opts?.customItems && opts.customItems.length > 0) {
    const cleanSal = parseFloat(salarioStr.replace(/[^\d,-]/g, "").replace(",", "."))
    const salBase = isNaN(cleanSal) || cleanSal <= 0 ? 6500.00 : cleanSal
    return recalcularHoleriteComRubricas(salBase, opts.customItems, mesAnoStr)
  }

  // Extract digits from salary string like "R$ 6.500,00" -> 6500.00
  const cleanSal = parseFloat(salarioStr.replace(/[^\d,-]/g, "").replace(",", "."))
  const salarioBase = isNaN(cleanSal) || cleanSal <= 0 ? 6500.00 : cleanSal

  const horasExtras = opts?.horasExtrasVal ?? (salarioBase > 4000 ? 350.00 : 180.00)
  const salarioBruto = salarioBase + horasExtras

  // Calculations
  const valorINSS = calcularINSS(salarioBruto)
  const baseIRPF = Math.max(0, salarioBruto - valorINSS)
  const valorIRPF = Math.max(0, calcularIRPF(baseIRPF))

  const valorVT = opts?.temVT !== false ? Math.round(salarioBase * 0.06 * 100) / 100 : 0
  const valorPlanoSaude = opts?.planoSaudeVal ?? 145.00

  const items: HoleriteItem[] = [
    {
      code: "001",
      description: "SALÁRIO BASE",
      reference: "30D",
      proventos: salarioBase,
      descontos: 0,
      type: "provento",
    },
    {
      code: "015",
      description: "HORAS EXTRAS 50% & DSR",
      reference: "12H",
      proventos: horasExtras,
      descontos: 0,
      type: "provento",
    },
    {
      code: "101",
      description: "INSS - PREVIDÊNCIA SOCIAL",
      reference: `${((valorINSS / salarioBruto) * 100).toFixed(1)}%`,
      proventos: 0,
      descontos: valorINSS,
      type: "desconto",
    },
    {
      code: "102",
      description: "IRPF - IMPOSTO DE RENDA RETIDO",
      reference: valorIRPF > 0 ? "Tab. Prog." : "ISENTO",
      proventos: 0,
      descontos: valorIRPF,
      type: "desconto",
    },
  ]

  if (valorVT > 0) {
    items.push({
      code: "105",
      description: "VALE TRANSPORTE (6%)",
      reference: "6.0%",
      proventos: 0,
      descontos: valorVT,
      type: "desconto",
    })
  }

  if (valorPlanoSaude > 0) {
    items.push({
      code: "110",
      description: "PLANO DE SAÚDE COPARTICIPAÇÃO",
      reference: "Mensal",
      proventos: 0,
      descontos: valorPlanoSaude,
      type: "desconto",
    })
  }

  const proventosTotais = items.reduce((acc, item) => acc + item.proventos, 0)
  const descontosTotais = items.reduce((acc, item) => acc + item.descontos, 0)
  const salarioLiquido = proventosTotais - descontosTotais

  const baseFGTS = salarioBruto
  const valorFGTS = Math.round(baseFGTS * 0.08 * 100) / 100

  return {
    salarioBase,
    proventosTotais: Math.round(proventosTotais * 100) / 100,
    descontosTotais: Math.round(descontosTotais * 100) / 100,
    salarioLiquido: Math.round(salarioLiquido * 100) / 100,
    items,
    baseINSS: salarioBruto,
    valorINSS,
    baseIRPF: Math.round(baseIRPF * 100) / 100,
    valorIRPF,
    baseFGTS,
    valorFGTS,
    mesAnoReferencia: mesAnoStr,
  }
}

/**
 * Recalcula o holerite a partir de uma lista de rubricas customizadas/editadas,
 * recalculando automaticamente INSS, IRPF, bases e líquido.
 */
export function recalcularHoleriteComRubricas(
  salarioBase: number,
  rubricas: HoleriteItem[],
  mesAnoStr: string = "08/2026"
): HoleriteCalculado {
  // Proventos que compõem a base de cálculo tributável (INSS e FGTS)
  // Ignora itens com código de desconto e soma proventos
  const proventos = rubricas.filter((r) => r.type === "provento" || r.proventos > 0)
  const outrosDescontos = rubricas.filter(
    (r) => (r.type === "desconto" || r.descontos > 0) && r.code !== "101" && r.code !== "102"
  )

  const salarioBruto = proventos.reduce((acc, r) => acc + r.proventos, 0)
  const valorINSS = calcularINSS(salarioBruto)
  const baseIRPF = Math.max(0, salarioBruto - valorINSS)
  const valorIRPF = Math.max(0, calcularIRPF(baseIRPF))

  // Atualiza ou insere rubricas fiscais
  const items: HoleriteItem[] = []

  // 1. Proventos
  proventos.forEach((p) => {
    items.push({ ...p })
  })

  // 2. INSS
  items.push({
    code: "101",
    description: "INSS - PREVIDÊNCIA SOCIAL",
    reference: `${((valorINSS / Math.max(1, salarioBruto)) * 100).toFixed(1)}%`,
    proventos: 0,
    descontos: valorINSS,
    type: "desconto",
  })

  // 3. IRPF
  items.push({
    code: "102",
    description: "IRPF - IMPOSTO DE RENDA RETIDO",
    reference: valorIRPF > 0 ? "Tab. Prog." : "ISENTO",
    proventos: 0,
    descontos: valorIRPF,
    type: "desconto",
  })

  // 4. Outros descontos (VT, Saúde, Empréstimo, Adiantamento, Faltas...)
  outrosDescontos.forEach((d) => {
    items.push({ ...d })
  })

  const proventosTotais = items.reduce((acc, item) => acc + item.proventos, 0)
  const descontosTotais = items.reduce((acc, item) => acc + item.descontos, 0)
  const salarioLiquido = proventosTotais - descontosTotais

  const baseFGTS = salarioBruto
  const valorFGTS = Math.round(baseFGTS * 0.08 * 100) / 100

  return {
    salarioBase,
    proventosTotais: Math.round(proventosTotais * 100) / 100,
    descontosTotais: Math.round(descontosTotais * 100) / 100,
    salarioLiquido: Math.round(salarioLiquido * 100) / 100,
    items,
    baseINSS: salarioBruto,
    valorINSS,
    baseIRPF: Math.round(baseIRPF * 100) / 100,
    valorIRPF,
    baseFGTS,
    valorFGTS,
    mesAnoReferencia: mesAnoStr,
  }
}

export function formatBRL(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}
