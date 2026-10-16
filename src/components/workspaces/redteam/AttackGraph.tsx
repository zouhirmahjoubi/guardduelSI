import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  BackgroundVariant,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { GuardrailState } from '@/types';

interface AttackGraphProps {
  patched: boolean;
  guardrails: GuardrailState;
  activeAttack: string | null;
}

const ATTACKER_STYLES = {
  normal: { border: '#EF4444', bg: '#0D1220', text: '#F87171', glow: 'rgba(239,68,68,0.3)' },
  blocked: { border: '#10B981', bg: '#0D1220', text: '#34D399', glow: 'rgba(16,185,129,0.3)' },
  decoy: { border: '#F59E0B', bg: '#0D1220', text: '#FBBF24', glow: 'rgba(245,158,11,0.3)' },
};

function createNodes(patched: boolean, activeAttack: string | null): Node[] {
  const attackerStyle = patched ? ATTACKER_STYLES.blocked : ATTACKER_STYLES.normal;

  const attackers = [
    { id: 'persona', label: 'Persona\nHijacker', x: 0, y: 100 },
    { id: 'payload', label: 'Payload\nInjector', x: 0, y: 250 },
    { id: 'logic', label: 'Logic\nExploiter', x: 0, y: 400 },
    { id: 'extractor', label: 'System\nExtractor', x: 400, y: 100 },
  ];

  const nodes: Node[] = [
    {
      id: 'target',
      position: { x: 200, y: 250 },
      data: { label: patched ? 'HARDENED\nTarget AI' : 'VULNERABLE\nTarget AI' },
      type: 'default',
      style: {
        background: patched ? '#062018' : '#1a0808',
        border: `2px solid ${patched ? '#10B981' : '#EF4444'}`,
        borderRadius: '8px',
        color: patched ? '#34D399' : '#F87171',
        fontSize: '11px',
        fontWeight: 700,
        width: '120px',
        textAlign: 'center',
        boxShadow: patched ? '0 0 20px rgba(16,185,129,0.3)' : '0 0 20px rgba(239,68,68,0.3)',
      },
      targetPosition: Position.Left,
      sourcePosition: Position.Right,
    },
  ];

  attackers.forEach((a) => {
    const isActive = activeAttack && (activeAttack === 'persona' && a.id === 'persona' ||
      activeAttack === 'prompt-injection' && a.id === 'payload' ||
      activeAttack === 'persona-hijack' && a.id === 'persona' ||
      activeAttack === 'data-exfil' && a.id === 'extractor' ||
      activeAttack === 'canary-leak' && a.id === 'extractor' ||
      activeAttack === 'jailbreak' && a.id === 'persona' ||
      activeAttack === 'sql-injection' && a.id === 'payload' ||
      activeAttack === 'pii-extract' && a.id === 'logic' ||
      activeAttack === 'schema-escape' && a.id === 'logic');

    nodes.push({
      id: a.id,
      position: { x: a.x, y: a.y },
      data: { label: a.label },
      type: 'default',
      style: {
        background: attackerStyle.bg,
        border: `1.5px solid ${attackerStyle.border}`,
        borderRadius: '8px',
        color: attackerStyle.text,
        fontSize: '10px',
        fontWeight: 600,
        width: '100px',
        textAlign: 'center',
        opacity: isActive ? 1 : 0.7,
        boxShadow: isActive ? `0 0 15px ${attackerStyle.glow}` : 'none',
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    });
  });

  // Constitutional AI Consensus Router
  nodes.push({
    id: 'router',
    position: { x: 200, y: 50 },
    data: { label: patched ? 'Constitutional AI\nConsensus Router' : 'No Router\n(Unprotected)' },
    type: 'default',
    style: {
      background: patched ? '#061520' : '#0D1220',
      border: `1.5px solid ${patched ? '#06B6D4' : '#243049'}`,
      borderRadius: '8px',
      color: patched ? '#22D3EE' : '#475569',
      fontSize: '9px',
      fontWeight: 600,
      width: '120px',
      textAlign: 'center',
    },
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
  });

  // Honeypot node (post-patch)
  if (patched) {
    nodes.push({
      id: 'honeypot',
      position: { x: 400, y: 250 },
      data: { label: 'HONEYPOT\nDecoy Env' },
      type: 'default',
      style: {
        background: '#1a1200',
        border: '1.5px solid #F59E0B',
        borderRadius: '8px',
        color: '#FBBF24',
        fontSize: '10px',
        fontWeight: 600,
        width: '100px',
        textAlign: 'center',
        boxShadow: '0 0 15px rgba(245,158,11,0.2)',
      },
      sourcePosition: Position.Left,
      targetPosition: Position.Right,
    });
  }

  return nodes;
}

function createEdges(patched: boolean): Edge[] {
  const style = patched
    ? { stroke: '#10B981', strokeWidth: 1.5, animated: false }
    : { stroke: '#EF4444', strokeWidth: 1.5, animated: true };

  const edges: Edge[] = [
    { id: 'e-persona-target', source: 'persona', target: 'target', style, animated: !patched, label: patched ? 'BLOCKED' : 'INJECT' },
    { id: 'e-payload-target', source: 'payload', target: 'target', style, animated: !patched, label: patched ? 'BLOCKED' : 'FUZZ' },
    { id: 'e-logic-target', source: 'logic', target: 'target', style, animated: !patched, label: patched ? 'BLOCKED' : 'EXPLOIT' },
    { id: 'e-extractor-target', source: 'extractor', target: 'target', style, animated: !patched, label: patched ? 'BLOCKED' : 'EXFIL' },
    { id: 'e-router-target', source: 'router', target: 'target', style: { stroke: patched ? '#06B6D4' : '#243049', strokeWidth: 1 } },
  ];

  if (patched) {
    edges.push({
      id: 'e-target-honeypot',
      source: 'target',
      target: 'honeypot',
      style: { stroke: '#F59E0B', strokeWidth: 1, strokeDasharray: '5 3' },
      label: 'DECOY',
    });
  }

  return edges;
}

export function AttackGraph({ patched, guardrails, activeAttack }: AttackGraphProps) {
  const nodes = createNodes(patched, activeAttack);
  const edges = createEdges(patched);

  return (
    <div className="relative w-full h-full bg-obsidian-950/50 grid-bg">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        panOnDrag
        zoomOnScroll
        nodesDraggable
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#1A2236" />
        <Controls showInteractive={false} />
      </ReactFlow>
      {/* Legend */}
      <div className="absolute bottom-2 left-2 panel px-2 py-1.5 space-y-1 z-10">
        <div className="flex items-center gap-2 text-[9px]">
          <div className={`w-2 h-2 rounded-full ${patched ? 'bg-emerald-500' : 'bg-crimson-500'}`} />
          <span className="text-slate-500">{patched ? 'Defended (Post-Patch)' : 'Vulnerable (Pre-Patch)'}</span>
        </div>
        {patched && guardrails.honeypot && (
          <div className="flex items-center gap-2 text-[9px]">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-slate-500">Honeypot Decoy Active</span>
          </div>
        )}
      </div>
    </div>
  );
}
