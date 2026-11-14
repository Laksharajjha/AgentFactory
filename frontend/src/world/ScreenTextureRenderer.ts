import * as THREE from 'three';

export interface LiveScreenData {
  roomId: string;
  agentName?: string;
  agentState?: string;
  taskTitle?: string;
  taskProgress?: number;
  taskStatus?: string;
  tokensUsed?: number;
  tokenBudget?: number;
  completedTasksCount?: number;
  totalTasksCount?: number;
  healthScore?: number;
  activeProjectName?: string;
  isLiveGemini?: boolean;
  quality?: 'HIGH' | 'MEDIUM' | 'LOW';
}

const textureCache = new Map<
  string,
  { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture; lastHash: string }
>();

export function getOrUpdateScreenTexture(data: LiveScreenData): THREE.CanvasTexture {
  const hash = `${data.roomId}|${data.agentName || ''}|${data.agentState || ''}|${
    data.taskTitle || ''
  }|${data.taskProgress ?? ''}|${data.taskStatus || ''}|${data.tokensUsed ?? 0}|${
    data.completedTasksCount ?? 0
  }|${data.totalTasksCount ?? 6}|${data.healthScore ?? 98}|${
    data.activeProjectName || ''
  }|${data.isLiveGemini ? 'LIVE' : 'DEMO'}|${data.quality || 'HIGH'}`;

  const existing = textureCache.get(data.roomId);
  if (existing && existing.lastHash === hash) {
    return existing.texture;
  }

  const canvas = existing ? existing.canvas : document.createElement('canvas');
  const targetWidth = data.quality === 'LOW' ? 256 : 512;
  const targetHeight = data.quality === 'LOW' ? 144 : 288;

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.save();
    if (targetWidth === 256) {
      ctx.scale(0.5, 0.5);
    }
    drawRoomInterface(ctx, 512, 288, data);
    ctx.restore();
  }

  if (existing) {
    existing.lastHash = hash;
    existing.texture.needsUpdate = true;
    return existing.texture;
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  textureCache.set(data.roomId, { canvas, texture, lastHash: hash });
  return texture;
}

function drawRoomInterface(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  data: LiveScreenData
): void {
  // Base high-contrast dark IDE/Dashboard canvas
  ctx.fillStyle = '#0b1120';
  ctx.fillRect(0, 0, w, h);

  // Top window chrome bar
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, w, 32);

  // Traffic light window dots
  const dots = ['#ef4444', '#f59e0b', '#10b981'];
  dots.forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(16 + i * 14, 16, 4.5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(`FORGE-OS // ${data.roomId.toUpperCase()}`, 62, 20);

  // Explicit Mode Badge (DEMO vs LIVE GEMINI) + Agent State Badge
  const modeBadge = data.isLiveGemini ? 'LIVE GEMINI' : 'DEMO SIM';
  ctx.fillStyle = data.isLiveGemini ? '#059669' : '#475569';
  ctx.fillRect(w - 208, 6, 88, 20);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 10px monospace';
  ctx.fillText(modeBadge, w - 198, 19);

  const stateLabel = data.agentState || 'STANDBY';
  ctx.fillStyle = stateLabel === 'WORKING' ? '#10b981' : '#38bdf8';
  ctx.fillRect(w - 112, 6, 102, 20);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 10px monospace';
  ctx.fillText(stateLabel.slice(0, 11), w - 104, 19);

  const roomId = data.roomId;

  if (roomId === 'backend_room') {
    // Left pane: Code Editor with syntax highlighting
    ctx.fillStyle = '#060a12';
    ctx.fillRect(10, 40, 292, 172);
    const codeLines = [
      { c: '#c084fc', t: '@router.post("/v2/tx", status=200)' },
      { c: '#38bdf8', t: 'async def execute_tx(req: TxSchema):' },
      { c: '#94a3b8', t: '  # Verify Zero-Trust JWT scope' },
      { c: '#e2e8f0', t: '  principal = await auth.verify(req)' },
      { c: '#34d399', t: '  return await domain.commit(req)' },
      { c: '#f59e0b', t: `  # Engineer: ${data.agentName || 'Sarah'} (${stateLabel})` },
    ];
    ctx.font = 'bold 11px monospace';
    codeLines.forEach((line, idx) => {
      ctx.fillStyle = '#64748b';
      ctx.fillText(`${idx + 1}`, 16, 60 + idx * 24);
      ctx.fillStyle = line.c;
      ctx.fillText(line.t, 36, 60 + idx * 24);
    });

    // Right pane: API Latency & Status
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(310, 40, 192, 172);
    ctx.fillStyle = '#c4b5fd';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('API LOGS & THROUGHPUT', 320, 58);
    [0.75, 0.55, 0.9, 0.65, 0.85].forEach((v, i) => {
      ctx.fillStyle = '#8b5cf6';
      ctx.fillRect(322 + i * 34, 165 - v * 82, 22, v * 82);
    });

    // Bottom Terminal Output
    ctx.fillStyle = '#020617';
    ctx.fillRect(10, 220, w - 20, 58);
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`$ pytest backend/tests/test_api_contracts.py -> PASSED`, 18, 240);
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(
      `Task: ${(data.taskTitle || 'API & Security Audit [Seeded Demo]').slice(0, 42)} [${
        data.taskProgress ?? 100
      }%]`,
      18,
      262
    );
  } else if (roomId === 'frontend_room') {
    // Component Hierarchy & Browser Preview
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(10, 40, 152, 236);
    ctx.fillStyle = '#f472b6';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('COMPONENT TREE', 20, 58);
    [
      '<App>',
      '  ├─ <TopBar />',
      '  ├─ <WorldScene>',
      '  │   ├─ <Building />',
      '  │   └─ <Character />',
      '  └─ <RightInspector />',
    ].forEach((node, i) => {
      ctx.fillStyle = i === 2 ? '#38bdf8' : '#e2e8f0';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(node, 16, 82 + i * 24);
    });

    // Right: Browser UI Preview & Dev Console
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 2;
    ctx.strokeRect(172, 40, 330, 162);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(184, 52, 306, 24);
    ctx.fillStyle = '#334155';
    ctx.fillRect(184, 84, 195, 106);
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(390, 84, 100, 106);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('LIVE UI PREVIEW • 60 FPS', 202, 140);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(172, 212, 330, 64);
    ctx.fillStyle = '#f472b6';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`Console: ${data.agentName || 'Daniel'} • State Sync OK`, 184, 236);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(
      `Task: ${(data.taskTitle || 'UI Component Architecture [Demo]').slice(0, 36)}`,
      184,
      258
    );
  } else if (roomId === 'architecture_lab') {
    // Service Dependency Graph & Data Flow
    ctx.fillStyle = '#091326';
    ctx.fillRect(10, 40, w - 20, h - 50);
    const nodes = [
      { x: 95, y: 110, label: 'API Gateway', col: '#06b6d4' },
      { x: 256, y: 82, label: 'Zero-Trust Auth', col: '#f59e0b' },
      { x: 256, y: 185, label: 'Domain Core', col: '#10b981' },
      { x: 415, y: 135, label: 'Event Bus WS', col: '#8b5cf6' },
    ];
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(95, 110);
    ctx.lineTo(256, 82);
    ctx.lineTo(256, 185);
    ctx.lineTo(415, 135);
    ctx.stroke();

    nodes.forEach((n) => {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(n.x - 60, n.y - 22, 120, 44);
      ctx.strokeStyle = n.col;
      ctx.lineWidth = 2;
      ctx.strokeRect(n.x - 60, n.y - 22, 120, 44);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(n.label, n.x - 48, n.y + 4);
    });
    ctx.fillStyle = '#67e8f9';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(
      `Architect: ${data.agentName || 'Marcus'} • Data Flow: ${(
        data.taskTitle || 'Service Topology Blueprint'
      ).slice(0, 28)}`,
      20,
      262
    );
  } else if (roomId === 'qa_lab') {
    // Test Results, Pass/Fail Indicators, Bug Reports
    const isFailed = data.taskStatus === 'FAILED';
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(12, 40, 235, 110);
    ctx.fillStyle = '#2dd4bf';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('TEST SUITE COVERAGE', 24, 62);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px monospace';
    ctx.fillText(isFailed ? '78.2%' : '94.2%', 24, 108);
    ctx.fillStyle = isFailed ? '#ef4444' : '#10b981';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(isFailed ? '▼ 1 Regression Detected' : '✔ All Suites Passing', 24, 134);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(260, 40, 240, 110);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('BUG TRIAGE & VERIFICATION', 274, 62);
    ctx.fillStyle = '#10b981';
    ctx.fillText('✔ 142 Contract Tests PASS', 274, 90);
    ctx.fillStyle = isFailed ? '#ef4444' : '#f59e0b';
    ctx.fillText(isFailed ? '✖ 1 Critical Bug Report Open' : '● 0 Active Regressions', 274, 114);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(12, 162, w - 24, 112);
    [
      'test_jwt_scope_guard.py      [PASS]',
      'test_webhook_hmac_raw.py     [PASS]',
      `test_ws_sequence_sync.py     [${isFailed ? 'FAIL' : 'PASS'}]`,
    ].forEach((t, i) => {
      ctx.fillStyle = i === 2 && isFailed ? '#ef4444' : '#34d399';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`${i === 2 && isFailed ? '✖' : '✔'} ${t}`, 24, 190 + i * 26);
    });
  } else if (roomId === 'security_room') {
    // Vulnerability Assessment, Security Findings, Severity Levels
    ctx.fillStyle = '#1e1b2e';
    ctx.fillRect(12, 40, w - 24, 234);
    ctx.fillStyle = '#f87171';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('VULNERABILITY ASSESSMENT & SEVERITY MATRIX', 24, 66);
    const items = [
      { label: 'JWT Audience & Scope Verification', sev: 'CRITICAL -> HARDENED', col: '#10b981' },
      { label: 'Raw-Body Webhook HMAC Validation', sev: 'HIGH -> ENFORCED', col: '#10b981' },
      { label: 'Rate Limit & Circuit Breaker Guard', sev: 'MEDIUM -> ACTIVE', col: '#38bdf8' },
      { label: 'Payload Schema Bounds Check', sev: 'LOW -> VERIFIED', col: '#f59e0b' },
    ];
    items.forEach((it, i) => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(24, 84 + i * 42, w - 48, 34);
      ctx.fillStyle = '#f1f5f9';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(it.label, 34, 105 + i * 42);
      ctx.fillStyle = it.col;
      ctx.font = 'bold 10px monospace';
      ctx.fillText(it.sev, w - 175, 105 + i * 42);
    });
  } else if (roomId === 'product_room') {
    // Kanban Board, Product Roadmap, Feature Priorities
    const cols = [
      { title: 'ROADMAP / BACKLOG', col: '#94a3b8', items: ['P1: Async Event Bus', 'P2: Canary Telemetry'] },
      {
        title: 'IN PROGRESS',
        col: '#f59e0b',
        items: [data.taskTitle?.slice(0, 19) || 'P0: Core Scope Spec'],
      },
      { title: 'COMPLETED', col: '#10b981', items: ['Product Charter', 'SLA Acceptance'] },
    ];
    cols.forEach((c, idx) => {
      const x = 14 + idx * 164;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(x, 42, 154, 232);
      ctx.fillStyle = c.col;
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(c.title, x + 10, 62);
      c.items.forEach((card, ci) => {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x + 10, 76 + ci * 56, 134, 46);
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText(card, x + 16, 103 + ci * 56);
      });
    });
  } else if (roomId === 'ceo_office' || roomId === 'ops_centre') {
    // CEO Office (Company Health, Initiatives, Decisions) & Operations (Workforce Overview, Agent Status, Task Completion)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(14, 42, 230, 105);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(roomId === 'ceo_office' ? 'COMPANY HEALTH' : 'WORKFORCE OVERVIEW', 26, 64);
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 36px monospace';
    ctx.fillText(`${data.healthScore ?? 98}%`, 26, 112);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '11px sans-serif';
    ctx.fillText('6 AUTONOMOUS AGENTS READY', 26, 134);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(258, 42, 240, 105);
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('LIVE API TOKEN LEDGER', 270, 64);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px monospace';
    ctx.fillText(`${(data.tokensUsed || 0).toLocaleString()} tok`, 270, 104);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px monospace';
    ctx.fillText(
      data.isLiveGemini ? `Budget: ${(data.tokenBudget || 100000).toLocaleString()}` : 'Demo Mode (0 Paid API Calls)',
      270,
      132
    );

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(14, 158, w - 28, 114);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(
      `INITIATIVE: ${(data.activeProjectName || 'Project Forge Core [Demo]').slice(0, 34)}`,
      26,
      184
    );
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(
      `Task Completion: ${data.completedTasksCount ?? 0} / ${data.totalTasksCount ?? 6} Deliverables`,
      26,
      214
    );
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`Lead: ${data.agentName || 'Alex'} (${stateLabel})`, 26, 242);
  } else {
    // DevOps (Deployment Pipeline, Service Monitoring, Build Status) & Reception
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(14, 42, w - 28, 230);
    ctx.fillStyle = '#f97316';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('DEPLOYMENT PIPELINE & SERVICE MONITORING', 26, 68);
    [
      'Build Status: TypeScript & Container Image [PASS]',
      'Service Monitor: API & WebSocket Bus [HEALTHY]',
      `Rollout Stage: ${(data.taskTitle || 'Canary Cluster Ready').slice(0, 30)} [OK]`,
    ].forEach((st, i) => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(26, 88 + i * 48, w - 52, 38);
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`● ${st}`, 38, 112 + i * 48);
    });
  }
}
