import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDown, ArrowRight, ArrowUp, ChartColumn, Landmark, Package,
  ShoppingCart, Tag, TrendingUp, Truck, Wallet,
  type LucideIcon,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { displayName, firstName, useMyProfile } from '../lib/profile'
import {
  brl, dayStartISO, monthStartInput, nextDayStartISO, toInputDate, todayInput,
} from '../lib/format'

type Totals = {
  purchases: number
  sales: number
  expenses: number | null
  received: number | null
  paid: number | null
  gross_profit: number | null
}
type Day = {
  day: string
  purchases: number
  sales: number
  expenses: number
  cash_in: number
  cash_out: number
}
type Recent = {
  kind: 'purchase' | 'sale' | 'expense'
  id: string
  at: string
  amount: number
  title: string
  status: 'confirmed' | 'cancelled'
}
type Overview = {
  admin: boolean
  current: Totals
  previous: Totals
  series: Day[]
  recent: Recent[]
  stock_top: { name: string; unit: 'kg' | 'un'; balance: number }[]
  to_pay: number
  to_receive: number
}

type Range = '7' | '30' | '90' | 'month'
const RANGES: [Range, string][] = [
  ['7', '7 dias'], ['30', '30 dias'], ['90', '90 dias'], ['month', 'Este mês'],
]

function rangeBounds(r: Range) {
  let fromStr: string
  if (r === 'month') fromStr = monthStartInput()
  else {
    const d = new Date()
    d.setDate(d.getDate() - (Number(r) - 1))
    fromStr = toInputDate(d)
  }
  return { from: dayStartISO(fromStr), to: nextDayStartISO(todayInput()) }
}

const MOVE: Record<Recent['kind'], { icon: LucideIcon; tone: string; title: string }> = {
  purchase: { icon: ShoppingCart, tone: 'green', title: 'Compra registrada' },
  sale: { icon: Tag, tone: 'blue', title: 'Venda realizada' },
  expense: { icon: Wallet, tone: 'orange', title: 'Gasto registrado' },
}

const moveLink = (m: Recent) =>
  m.kind === 'purchase' ? `/compras/${m.id}` : m.kind === 'sale' ? `/vendas/${m.id}` : '/gastos'

function when(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const hhmm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === now.toDateString()) return `Hoje • ${hhmm}`
  if (d.toDateString() === yesterday.toDateString()) return `Ontem • ${hhmm}`
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} • ${hhmm}`
}

const qty = (n: number) => Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 3 })

function pct(cur: number | null, prev: number | null): number | null {
  if (cur == null || prev == null) return null
  if (prev === 0) return cur === 0 ? 0 : null
  return ((cur - prev) / Math.abs(prev)) * 100
}

function Delta({ value, goodWhenUp }: { value: number | null; goodWhenUp: boolean | null }) {
  if (value == null) return <div className="delta">sem base de comparação</div>
  const up = value > 0.5
  const down = value < -0.5
  const Arrow = up ? ArrowUp : down ? ArrowDown : ArrowRight
  const good = up ? goodWhenUp : down ? goodWhenUp === false : null
  const cls = goodWhenUp === null || (!up && !down) ? '' : good ? 'up' : 'down'
  const shown = Math.min(Math.abs(value), 999).toFixed(0)
  const sign = up ? '+' : down ? '−' : ''
  return (
    <div className="delta">
      <b className={cls}><Arrow size={13} strokeWidth={2.5} />{sign}{shown}%</b> vs. período anterior
    </div>
  )
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const w = 96, h = 40, pad = 3
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => [
    pad + (i * (w - pad * 2)) / (values.length - 1),
    h - pad - ((v - min) / span) * (h - pad * 2),
  ])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`
  const id = `sp${color.replace('#', '')}`
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function niceStep(raw: number) {
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  const f = raw / p
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return nf * p
}

type Series = { key: 'cash_in' | 'cash_out' | 'sales' | 'purchases'; label: string; color: string }

function FlowChart({ days, a, b }: { days: Day[]; a: Series; b: Series }) {
  const W = 640, H = 240, L = 56, R = 14, T = 12, B = 28
  const n = days.length
  if (n === 0) return <p>Sem movimento no período.</p>

  const av = days.map((d) => Number(d[a.key]))
  const bv = days.map((d) => Number(d[b.key]))
  const step = niceStep(Math.max(1, ...av, ...bv) / 4)
  const max = step * 4
  const x = (i: number) => (n === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (n - 1))
  const y = (v: number) => T + (1 - v / max) * (H - T - B)
  const line = (vals: number[]) =>
    vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = (vals: number[]) =>
    `${line(vals)} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`
  const compact = (v: number) =>
    v.toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })
  const labelIdx = n <= 7
    ? days.map((_, i) => i)
    : [...new Set([0, 1, 2, 3, 4].map((k) => Math.round((k * (n - 1)) / 4)))]
  const fmtDay = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}`
  const pairs: [number[], Series][] = [[av, a], [bv, b]]

  return (
    <div className="chart">
      <div className="chart-legend">
        {[a, b].map((s) => (
          <span key={s.key}>
            <i className="legend-dot" style={{ background: s.color }} />{s.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img">
        <defs>
          {[a, b].map((s) => (
            <linearGradient key={s.key} id={`fc-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {[0, 1, 2, 3, 4].map((k) => (
          <g key={k}>
            <line x1={L} x2={W - R} y1={y(step * k)} y2={y(step * k)} stroke="#e6ebf2" />
            <text x={L - 8} y={y(step * k) + 4} textAnchor="end" fontSize="11" fill="#6b7a90">
              R$ {compact(step * k)}
            </text>
          </g>
        ))}
        {labelIdx.map((i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#6b7a90">
            {fmtDay(days[i].day)}
          </text>
        ))}
        {n > 1 && pairs.map(([vals, s]) => (
          <path key={`a-${s.key}`} d={area(vals)} fill={`url(#fc-${s.key})`} />
        ))}
        {n > 1 && pairs.map(([vals, s]) => (
          <path key={`l-${s.key}`} d={line(vals)} fill="none" stroke={s.color}
            strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {n <= 14 && pairs.map(([vals, s]) =>
          vals.map((v, i) => (
            <circle key={`${s.key}-${i}`} cx={x(i)} cy={y(v)} r="3.5"
              fill={s.color} stroke="#fff" strokeWidth="1.5" />
          )),
        )}
      </svg>
    </div>
  )
}

const TILE_COLORS = ['#0e9f6e', '#3b82f6', '#f97316', '#8b5cf6']

type Action = {
  to: string
  label: string
  hint: string
  icon: LucideIcon
  fill: string
  tone: string
}

export default function Home() {
  const { company, session } = useAuth()
  const companyId = company!.id
  const isAdmin = company!.role !== 'operator'
  const { data: profile } = useMyProfile()
  const [range, setRange] = useState<Range>('30')

  const greeting = firstName(displayName(profile?.full_name, session?.user.email))

  const { data: ov, isLoading, error } = useQuery({
    queryKey: ['dashboard', companyId, range, todayInput()],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { from, to } = rangeBounds(range)
      const { data, error } = await supabase.rpc('dashboard_overview', {
        p_company_id: companyId,
        p_from: from,
        p_to: to,
        p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      if (error) throw error
      return data as Overview
    },
  })

  const balance = (t: Totals) => (t.received ?? 0) - (t.paid ?? 0)

  const actions: Action[] = [
    { to: '/compras/nova', label: 'Nova compra', hint: 'Registrar entrada de material', icon: ShoppingCart, fill: 'fill-green', tone: '' },
    { to: '/vendas/nova', label: 'Nova venda', hint: 'Registrar saída de material', icon: Tag, fill: 'fill-blue', tone: '' },
    ...(isAdmin
      ? [
        { to: '/gastos', label: 'Registrar gasto', hint: 'Luz, frete, salários...', icon: Wallet, fill: '', tone: 'tone-orange' },
        { to: '/relatorios', label: 'Ver relatórios', hint: 'Resumo para o WhatsApp', icon: ChartColumn, fill: '', tone: 'tone-purple' },
      ]
      : [
        { to: '/materiais', label: 'Ver estoque', hint: 'Saldo de cada material', icon: Package, fill: '', tone: 'tone-orange' },
        { to: '/fornecedores', label: 'Fornecedores', hint: 'Quem vende para você', icon: Truck, fill: '', tone: 'tone-purple' },
      ]),
  ]

  return (
    <>
      <div className="hello">
        <div className="hello-ico"><TrendingUp size={28} /></div>
        <div>
          <h1>Olá, {greeting}! 👋</h1>
          <p>Aqui está um resumo do seu negócio.</p>
        </div>
        <div className="range">
          {RANGES.map(([key, label]) => (
            <button key={key} className={range === key ? 'on' : ''} onClick={() => setRange(key)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="actions-strip">
        {actions.map((a) => {
          const Icon = a.icon
          return (
            <Link key={a.to} to={a.to} className={`action ${a.fill}`}>
              <span className={`aico ${a.tone ? a.tone : ''}`.trim()}
                style={a.tone ? { background: 'var(--bg)' } : undefined}>
                <Icon size={22} />
              </span>
              <span>
                <strong>{a.label}</strong>
                <small>{a.hint}</small>
              </span>
            </Link>
          )
        })}
      </div>

      {isLoading && !ov && <p>Carregando...</p>}
      {error && <p className="msg">{(error as { message?: string }).message ?? 'Erro ao carregar o painel'}</p>}

      {ov && (() => {
        const cur = ov.current
        const prev = ov.previous
        const s = ov.series
        const kpis: {
          label: string; icon: LucideIcon; tone: string; color: string
          value: number; delta: number | null; goodWhenUp: boolean | null; spark: number[]
        }[] = [
            {
              label: 'Compras', icon: ShoppingCart, tone: 'green', color: '#0e9f6e',
              value: cur.purchases, delta: pct(cur.purchases, prev.purchases),
              goodWhenUp: null, spark: s.map((d) => Number(d.purchases)),
            },
            {
              label: 'Vendas', icon: Tag, tone: 'blue', color: '#3b82f6',
              value: cur.sales, delta: pct(cur.sales, prev.sales),
              goodWhenUp: true, spark: s.map((d) => Number(d.sales)),
            },
            ...(ov.admin ? [
              {
                label: 'Gastos', icon: Wallet, tone: 'orange', color: '#f97316',
                value: cur.expenses ?? 0, delta: pct(cur.expenses, prev.expenses),
                goodWhenUp: false, spark: s.map((d) => Number(d.expenses)),
              },
              {
                label: 'Saldo do caixa', icon: Landmark, tone: 'purple', color: '#8b5cf6',
                value: balance(cur), delta: pct(balance(cur), balance(prev)),
                goodWhenUp: true,
                spark: s.map((d) => Number(d.cash_in) - Number(d.cash_out)),
              },
            ] : []),
          ]

        const a: Series = ov.admin
          ? { key: 'cash_in', label: 'Entradas', color: '#0e9f6e' }
          : { key: 'sales', label: 'Vendas', color: '#3b82f6' }
        const b: Series = ov.admin
          ? { key: 'cash_out', label: 'Saídas', color: '#f97316' }
          : { key: 'purchases', label: 'Compras', color: '#0e9f6e' }

        return (
          <>
            <div className="kpis">
              {kpis.map((k) => {
                const Icon = k.icon
                return (
                  <div className="kpi" key={k.label}>
                    <div className="kpi-row">
                      <div className={`kpi-ico tone-${k.tone}`}><Icon size={22} /></div>
                      <div>
                        <div className="label">{k.label}</div>
                        <div className="value">{brl(k.value)}</div>
                      </div>
                      <Sparkline values={k.spark} color={k.color} />
                    </div>
                    <Delta value={k.delta} goodWhenUp={k.goodWhenUp} />
                  </div>
                )
              })}
            </div>

            <div className="grid-2">
              <div className="panel">
                <div className="panel-head">
                  <h3>{ov.admin ? 'Movimentação financeira' : 'Vendas x compras'}</h3>
                </div>
                <FlowChart days={s} a={a} b={b} />
              </div>

              <div className="panel">
                <div className="panel-head">
                  <h3>Últimas movimentações</h3>
                </div>
                {ov.recent.length === 0 ? <p>Nenhuma movimentação ainda.</p> : (
                  ov.recent.map((m) => {
                    const Icon = MOVE[m.kind].icon
                    return (
                      <Link key={`${m.kind}-${m.id}`} to={moveLink(m)}
                        className={`move ${m.status === 'cancelled' ? 'cancelled' : ''}`}>
                        <div className={`ico tone-${MOVE[m.kind].tone}`}><Icon size={20} /></div>
                        <div className="txt">
                          <strong>{MOVE[m.kind].title}</strong>
                          <small>{m.title}</small>
                        </div>
                        <div className="amt">
                          <strong>{brl(m.amount)}</strong>
                          <small>{m.status === 'cancelled' ? 'Cancelada' : when(m.at)}</small>
                        </div>
                      </Link>
                    )
                  })
                )}
              </div>
            </div>

            <div className="grid-2 even">
              <div className="panel">
                <div className="panel-head">
                  <h3>Estoque</h3>
                  <Link className="link-more" to="/materiais">Ver estoque →</Link>
                </div>
                {ov.stock_top.length === 0 ? <p>Nenhum material com saldo.</p> : (
                  <div className="tiles">
                    {ov.stock_top.map((m, i) => (
                      <div className="tile" key={m.name}>
                        <div className="tile-ico" style={{ background: TILE_COLORS[i % 4] }}>
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                        <strong>{m.name}</strong>
                        <small>{qty(m.balance)} {m.unit}</small>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="panel">
                <div className="panel-head">
                  <h3>Resumo do período</h3>
                </div>
                <div className="sum-row">
                  <span><i className="dot" style={{ background: '#0e9f6e' }} />Compras</span>
                  <strong>{brl(cur.purchases)}</strong>
                </div>
                <div className="sum-row">
                  <span><i className="dot" style={{ background: '#3b82f6' }} />Vendas</span>
                  <strong>{brl(cur.sales)}</strong>
                </div>
                {ov.admin && (
                  <div className="sum-row">
                    <span><i className="dot" style={{ background: '#f97316' }} />Gastos</span>
                    <strong>{brl(cur.expenses ?? 0)}</strong>
                  </div>
                )}
                <div className="sum-sep" />
                <div className="sum-row">
                  <span>A pagar a fornecedores</span>
                  <strong>{brl(ov.to_pay)}</strong>
                </div>
                <div className="sum-row">
                  <span>A receber de clientes</span>
                  <strong>{brl(ov.to_receive)}</strong>
                </div>
                {ov.admin && (
                  <>
                    <div className="profit">
                      <span>Lucro bruto estimado</span>
                      <strong>{brl(cur.gross_profit ?? 0)}</strong>
                    </div>
                    <p><small>Estimativa pelo custo médio de compra do material.</small></p>
                  </>
                )}
              </div>
            </div>
          </>
        )
      })()}
    </>
  )
}