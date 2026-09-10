/**
 * routes/pdf.routes.ts — Geração de PDF Oficial de Holerite Modelo Tradicional Simples
 */
import { Router, type Request, type Response } from "express"
import PDFDocument from "pdfkit"

const router = Router()

interface HoleriteItem {
  code: string
  description: string
  reference: string
  proventos: number
  descontos: number
}

function calcularINSS(salarioBruto: number): number {
  let inss = 0
  const f1 = 1518.00
  const f2 = 2793.88
  const f3 = 4190.83
  const f4 = 8157.41

  const valorTeto = Math.min(salarioBruto, f4)

  if (valorTeto > 0) inss += Math.min(valorTeto, f1) * 0.075
  if (valorTeto > f1) inss += (Math.min(valorTeto, f2) - f1) * 0.09
  if (valorTeto > f2) inss += (Math.min(valorTeto, f3) - f2) * 0.12
  if (valorTeto > f3) inss += (valorTeto - f3) * 0.14

  return Math.round(inss * 100) / 100
}

function calcularIRPF(baseIRPF: number): number {
  if (baseIRPF <= 2259.20) return 0
  if (baseIRPF <= 2826.65) return Math.round((baseIRPF * 0.075 - 169.44) * 100) / 100
  if (baseIRPF <= 3751.05) return Math.round((baseIRPF * 0.15 - 381.44) * 100) / 100
  if (baseIRPF <= 4664.68) return Math.round((baseIRPF * 0.225 - 662.77) * 100) / 100
  return Math.round((baseIRPF * 0.275 - 896.00) * 100) / 100
}

function formatRaw(val: number): string {
  if (!val || val === 0) return ""
  return val.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// POST /api/pdf/holerite
router.post("/holerite", (req: Request, res: Response) => {
  try {
    const {
      employeeName = "Colaborador",
      cpf = "123.456.789-00",
      role = "Analista de RH",
      department = "Recursos Humanos",
      registration = "MAT-2026-101",
      admissionDate = "01/02/2022",
      cbo = "2124-05",
      salary = "R$ 6.500,00",
      month = "08/2026",
    } = req.body

    const cleanSal = parseFloat(String(salary).replace(/[^\d,-]/g, "").replace(",", "."))
    const salarioBase = isNaN(cleanSal) || cleanSal <= 0 ? 6500.00 : cleanSal
    const horasExtras = salarioBase > 4000 ? 350.00 : 180.00
    const salarioBruto = salarioBase + horasExtras

    const valorINSS = calcularINSS(salarioBruto)
    const baseIRPF = Math.max(0, salarioBruto - valorINSS)
    const valorIRPF = Math.max(0, calcularIRPF(baseIRPF))
    const valorVT = Math.round(salarioBase * 0.06 * 100) / 100

    const items: HoleriteItem[] = [
      { code: "001", description: "SALARIO", reference: "30", proventos: salarioBase, descontos: 0 },
      { code: "015", description: "HORAS EXTRAS 50% & DSR", reference: "12", proventos: horasExtras, descontos: 0 },
      { code: "101", description: "INSS", reference: `${((valorINSS / salarioBruto) * 100).toFixed(1)}%`, proventos: 0, descontos: valorINSS },
      { code: "102", description: "IRPF", reference: valorIRPF > 0 ? "Tab." : "0", proventos: 0, descontos: valorIRPF },
      { code: "105", description: "VALE TRANSPORTE", reference: "6%", proventos: 0, descontos: valorVT },
    ]

    const proventosTotais = items.reduce((acc, item) => acc + item.proventos, 0)
    const descontosTotais = items.reduce((acc, item) => acc + item.descontos, 0)
    const salarioLiquido = proventosTotais - descontosTotais

    const cleanName = String(employeeName).replace(/\s+/g, "_").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    const cleanMonth = String(month).replace("/", "_")
    const fileName = `Contra_Cheque_${cleanName}_${cleanMonth}.pdf`

    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`)

    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 20,
    })

    doc.pipe(res)

    const startX = 30
    const startY = 30
    const gridW = 730
    const gridH = 500
    const rightColW = 60
    const mainW = gridW - rightColW

    const line = (x1: number, y1: number, x2: number, y2: number) => {
      doc.moveTo(x1, y1).lineTo(x2, y2).stroke()
    }

    doc.lineWidth(1).strokeColor("#000000")

    // Moldura principal
    doc.rect(startX, startY, gridW, gridH).stroke()

    // Divisória vertical direita para assinatura
    line(startX + mainW, startY, startX + mainW, startY + gridH)

    // 1. Cabeçalho Empresa & Título
    line(startX, startY + 60, startX + mainW, startY + 60)
    line(startX + 400, startY, startX + 400, startY + 60)

    doc.font("Helvetica-Bold").fontSize(11).fillColor("#000000").text("PEOPLEHUB RH S/A", startX + 10, startY + 10)
    doc.font("Helvetica").fontSize(9).text("Av. Paulista, 1000 — Jardim Paulista", startX + 10, startY + 25)
    doc.text("São Paulo - SP  |  CNPJ: 12.345.678/0001-90", startX + 10, startY + 40)

    doc.font("Helvetica-Bold").fontSize(12).text("Recibo de Pagamento de Salário", startX + 410, startY + 12)
    doc.font("Helvetica").fontSize(10).text(`Mês Referência: ${month}`, startX + 410, startY + 32)

    // 2. Bar do Funcionário
    line(startX, startY + 95, startX + mainW, startY + 95)
    line(startX + 60, startY + 60, startX + 60, startY + 95)
    line(startX + 370, startY + 60, startX + 370, startY + 95)
    line(startX + 470, startY + 60, startX + 470, startY + 95)
    line(startX + 530, startY + 60, startX + 530, startY + 95)

    doc.fontSize(7).font("Helvetica").text("Código", startX + 5, startY + 65)
    doc.fontSize(9).font("Helvetica-Bold").text(String(registration), startX + 5, startY + 77)

    doc.fontSize(7).font("Helvetica").text("Nome do Funcionário", startX + 65, startY + 65)
    doc.fontSize(9).font("Helvetica-Bold").text(String(employeeName), startX + 65, startY + 77)

    doc.fontSize(7).font("Helvetica").text("Admissão", startX + 375, startY + 65)
    doc.fontSize(8).font("Helvetica").text(String(admissionDate), startX + 375, startY + 77)

    doc.fontSize(7).font("Helvetica").text("CBO", startX + 475, startY + 65)
    doc.fontSize(8).font("Helvetica").text(String(cbo), startX + 475, startY + 77)

    doc.fontSize(7).font("Helvetica").text("Função", startX + 535, startY + 65)
    doc.fontSize(8).font("Helvetica").text(String(role), startX + 535, startY + 77)

    // 3. Tabela de Rubricas
    line(startX, startY + 120, startX + mainW, startY + 120)
    line(startX + 60, startY + 95, startX + 60, startY + 410)
    line(startX + 400, startY + 95, startX + 400, startY + 410)
    line(startX + 530, startY + 95, startX + 530, startY + 460)
    line(startX + 600, startY + 95, startX + 600, startY + 460)

    doc.fontSize(8).font("Helvetica").text("Código", startX + 5, startY + 103, { width: 50, align: "center" })
    doc.text("Descrição", startX + 65, startY + 103)
    doc.text("Referência", startX + 405, startY + 103, { width: 120, align: "center" })
    doc.text("Vencimentos", startX + 535, startY + 103, { width: 60, align: "right" })
    doc.text("Descontos", startX + 605, startY + 103, { width: 60, align: "right" })

    let rY = startY + 130
    items.forEach((item) => {
      doc.fontSize(8).font("Helvetica")
      doc.text(item.code, startX + 5, rY, { width: 50, align: "center" })
      doc.text(item.description, startX + 65, rY)
      doc.text(item.reference, startX + 405, rY, { width: 120, align: "center" })
      if (item.proventos > 0) doc.text(formatRaw(item.proventos), startX + 535, rY, { width: 60, align: "right" })
      if (item.descontos > 0) doc.text(formatRaw(item.descontos), startX + 605, rY, { width: 60, align: "right" })
      rY += 22
    })

    // 4. Totais
    line(startX + 400, startY + 410, startX + mainW, startY + 410)
    line(startX, startY + 435, startX + mainW, startY + 435)
    line(startX, startY + 460, startX + mainW, startY + 460)

    doc.fontSize(7).font("Helvetica").text("Total de Vencimentos", startX + 405, startY + 413, { width: 120, align: "center" })
    doc.text("Total de Descontos", startX + 535, startY + 413, { width: 130, align: "center" })

    doc.fontSize(8).font("Helvetica-Bold")
    doc.text(formatRaw(proventosTotais), startX + 535, startY + 423, { width: 60, align: "right" })
    doc.text(formatRaw(descontosTotais), startX + 605, startY + 423, { width: 60, align: "right" })

    doc.fontSize(9).font("Helvetica-Bold").text("Valor Líquido R$ ->", startX + 410, startY + 444)
    doc.fontSize(10).text(formatRaw(salarioLiquido), startX + 605, startY + 443, { width: 60, align: "right" })

    // 5. Bases Footer (5 Colunas)
    const baseColW = mainW / 5
    for (let i = 1; i < 5; i++) {
      line(startX + i * baseColW, startY + 460, startX + i * baseColW, startY + gridH)
    }

    const baseCols = [
      { label: "Salário Base", val: formatRaw(salarioBase), x: startX + 5 },
      { label: "Salário Contr. INSS", val: formatRaw(salarioBruto), x: startX + baseColW + 5 },
      { label: "Base FGTS", val: formatRaw(salarioBruto), x: startX + baseColW * 2 + 5 },
      { label: "FGTS do Mês", val: formatRaw(Math.round(salarioBruto * 0.08 * 100) / 100), x: startX + baseColW * 3 + 5 },
      { label: "Base Calc. IRPF", val: formatRaw(baseIRPF), x: startX + baseColW * 4 + 5 },
    ]

    baseCols.forEach((c) => {
      doc.fontSize(6.5).font("Helvetica").text(c.label, c.x, startY + 464)
      doc.fontSize(8.5).font("Helvetica-Bold").text(c.val, c.x, startY + 480, { width: baseColW - 10, align: "right" })
    })

    // 6. Faixa Vertical Direita (Assinatura)
    doc.save()
    doc.translate(startX + mainW + 35, startY + gridH - 20)
    doc.rotate(-90)
    doc.fontSize(7).font("Helvetica")
    doc.text("Declaro ter recebido a importância líquida discriminada neste recibo    ____ / ____ / ________  Data", 0, 0)
    doc.text("___________________________________________________ Assinatura do Funcionário", 0, 15)
    doc.restore()

    doc.end()
  } catch (err: any) {
    console.error("Erro ao gerar PDF do Contra-Cheque:", err)
    res.status(500).json({ ok: false, error: "Falha ao gerar arquivo PDF." })
  }
})

export default router
