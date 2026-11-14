export const brl = (n: number) =>
  Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// aceita "2,5" ou "2.5"; evite separador de milhar
export const num = (s: string) => {
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

export const PAYMENT_METHODS = [
  ['cash', 'Dinheiro'],
  ['pix', 'Pix'],
  ['transfer', 'Transferência'],
  ['card', 'Cartão'],
  ['check', 'Cheque'],
  ['other', 'Outro'],
] as const

const pad = (n: number) => String(n).padStart(2, '0')

export const toInputDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const todayInput = () => toInputDate(new Date())

export const monthStartInput = () => {
  const d = new Date()
  return toInputDate(new Date(d.getFullYear(), d.getMonth(), 1))
}

// início do dia (horário local) em formato ISO, para filtrar no banco
export const dayStartISO = (s: string) => new Date(`${s}T00:00:00`).toISOString()

// início do dia seguinte: usado como limite "menor que", para incluir o dia final inteiro
export const nextDayStartISO = (s: string) => {
  const d = new Date(`${s}T00:00:00`)
  d.setDate(d.getDate() + 1)
  return d.toISOString()
}

export const monthStartISO = () => dayStartISO(monthStartInput())