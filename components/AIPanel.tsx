'use client'

import { useState } from 'react'
import type { Machine, FleetSettings } from '@/lib/types'
import { buildAIInsights, type AIInsight } from '@/lib/calculations'
import { Bot, ChevronDown, ChevronUp, Sparkles, TrendingUp, AlertTriangle, CheckCircle, Info } from 'lucide-react'

interface Props {
  machines: Machine[]
  settings: FleetSettings
}

const TYPE_CONFIG = {
  critical:    { color: 'var(--red)',    bg: 'rgba(248,113,113,0.07)', border: 'rgba(248,113,113,0.18)', Icon: AlertTriangle },
  warning:     { color: 'var(--yellow)', bg: 'rgba(251,191,36,0.07)',  border: 'rgba(251,191,36,0.16)',  Icon: AlertTriangle },
  opportunity: { color: 'var(--teal)',   bg: 'rgba(56,189,248,0.06)',  border: 'rgba(56,189,248,0.16)',  Icon: TrendingUp },
  positive:    { color: 'var(--green)',  bg: 'rgba(52,211,153,0.07)',  border: 'rgba(52,211,153,0.18)',  Icon: CheckCircle },
}

export default function AIPanel({ machines, settings }: Props) {
  const [expanded, setExpanded] = useState<number | null>(0)
  const insights = buildAIInsights(machines, settings)

  const totalPotential = insights.reduce((s, i) => s + (i.potential ?? 0), 0)

  if (insights.length === 0) return null

  return (
    <div style={{ marginBottom: '28px' }}>
      {/* Header */}
      <div style={{
        background: 'var(--s2)',
        border: '1px solid rgba(56,189,248,0.22)',
        borderRadius: 'var(--r-lg)',
        overflow: 'hidden',
        boxShadow: '0 0 32px rgba(56,189,248,0.06), 0 4px 24px rgba(0,0,0,0.5)',
      }}>
        {/* Panel Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid rgba(56,189,248,0.08)',
          background: 'linear-gradient(135deg, rgba(56,189,248,0.05) 0%, transparent 55%)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, rgba(56,189,248,0.18), rgba(56,189,248,0.08))',
              border: '1px solid rgba(56,189,248,0.22)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 16px rgba(56,189,248,0.14)',
            }}>
              <Bot size={17} color="var(--teal)" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <span style={{ fontSize: '14px', fontWeight: 800 }}>AI Assistant</span>
                <span style={{
                  fontSize: '9px', fontWeight: 700, letterSpacing: '.7px',
                  background: 'rgba(52,211,153,0.10)', color: 'var(--green)',
                  border: '1px solid rgba(52,211,153,0.20)',
                  borderRadius: '99px', padding: '2px 7px',
                }}>
                  LIVE
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                {insights.length} Empfehlung{insights.length !== 1 ? 'en' : ''} · Automatisch aktualisiert
              </div>
            </div>
          </div>

          {totalPotential > 0 && (
            <div style={{
              textAlign: 'right',
              background: 'rgba(52,211,153,0.07)',
              border: '1px solid rgba(52,211,153,0.16)',
              borderRadius: 'var(--r-md)', padding: '10px 16px',
            }}>
              <div style={{ fontSize: '9px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '.7px', marginBottom: '3px' }}>
                IDENTIFIZIERTES POTENZIAL
              </div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--green)', letterSpacing: '-0.5px', lineHeight: 1 }}>
                +€ {totalPotential.toLocaleString('de-AT')}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>pro Monat</div>
            </div>
          )}
        </div>

        {/* Insights list */}
        <div>
          {insights.map((insight, i) => (
            <InsightRow
              key={i}
              insight={insight}
              index={i}
              isLast={i === insights.length - 1}
              isExpanded={expanded === i}
              onToggle={() => setExpanded(expanded === i ? null : i)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function InsightRow({ insight, index, isLast, isExpanded, onToggle }: {
  insight: AIInsight
  index: number
  isLast: boolean
  isExpanded: boolean
  onToggle: () => void
}) {
  const cfg = TYPE_CONFIG[insight.type]
  const isPriority = index === 0

  return (
    <div
      className="insight-row"
      style={{
        borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.035)',
        background: isExpanded
          ? 'rgba(56,189,248,0.03)'
          : isPriority && !isExpanded
          ? 'rgba(56,189,248,0.015)'
          : 'transparent',
      }}
    >
      {/* Priority label — only for first item */}
      {isPriority && (
        <div style={{ padding: '10px 24px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            fontSize: '9px', fontWeight: 700, letterSpacing: '.7px',
            color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
            borderRadius: '4px', padding: '1px 6px',
          }}>
            {insight.type === 'critical' ? '🔴 KRITISCH' : insight.type === 'warning' ? '⚠ WARNUNG' : insight.type === 'opportunity' ? '💡 PRIORITÄT' : '✓ TOP'}
          </span>
        </div>
      )}

      {/* Row header — always visible */}
      <button
        onClick={onToggle}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: isPriority ? '12px 24px 14px' : '14px 24px',
          display: 'flex', alignItems: 'center', gap: '14px',
          textAlign: 'left',
        }}
      >
        {/* Icon */}
        <div style={{
          width: isPriority ? '40px' : '34px',
          height: isPriority ? '40px' : '34px',
          borderRadius: isPriority ? '12px' : '9px',
          flexShrink: 0,
          background: cfg.bg, border: `1px solid ${cfg.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: isPriority ? `0 0 12px ${cfg.border}` : 'none',
          transition: 'transform .15s',
        }}>
          <span style={{ fontSize: isPriority ? '18px' : '15px' }}>{insight.icon}</span>
        </div>

        {/* Title + machine */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: isPriority ? '14px' : '13px',
            fontWeight: isPriority ? 800 : 700,
            color: 'var(--text)', marginBottom: '2px', lineHeight: 1.3,
          }}>
            {insight.title}
          </div>
          {insight.machine && (
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{insight.machine}</div>
          )}
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {insight.potential !== null && (
            <div style={{
              background: insight.potential > 0 ? 'rgba(52,211,153,0.09)' : 'rgba(248,113,113,0.09)',
              border: `1px solid ${insight.potential > 0 ? 'rgba(52,211,153,0.22)' : 'rgba(248,113,113,0.22)'}`,
              borderRadius: '8px', padding: '4px 10px',
              fontSize: isPriority ? '13px' : '12px', fontWeight: 800,
              color: insight.potential > 0 ? 'var(--green)' : 'var(--red)',
              whiteSpace: 'nowrap',
            }}>
              {insight.potential > 0 ? '+' : ''}€ {Math.abs(insight.potential).toLocaleString('de-AT')} /Mo
            </div>
          )}
          <div style={{ color: 'var(--muted)', transition: 'transform .15s' }}>
            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div style={{ padding: '0 24px 20px 82px' }}>
          <div style={{
            background: cfg.bg, border: `1px solid ${cfg.border}`,
            borderRadius: 'var(--r-md)', padding: '14px 16px', marginBottom: '10px',
          }}>
            <div style={{ fontSize: '10px', color: cfg.color, fontWeight: 700, letterSpacing: '.6px', marginBottom: '6px' }}>
              ANALYSE
            </div>
            <div style={{ fontSize: '13px', color: 'var(--label)', lineHeight: 1.65 }}>
              {insight.detail}
            </div>
          </div>

          <div style={{
            background: 'var(--s3)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)', padding: '12px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
          }}>
            <div>
              <div style={{ fontSize: '9px', color: 'var(--muted)', fontWeight: 700, letterSpacing: '.7px', marginBottom: '4px' }}>
                EMPFOHLENE MASSNAHME
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                {insight.action}
              </div>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              background: 'linear-gradient(135deg, #2cb8e8, #0f7ab5)',
              color: '#fff', borderRadius: '8px', padding: '7px 13px',
              fontSize: '12px', fontWeight: 700, flexShrink: 0,
              boxShadow: '0 0 14px rgba(56,189,248,0.22)',
              cursor: 'default',
            }}>
              <Sparkles size={12} />
              Merken
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
