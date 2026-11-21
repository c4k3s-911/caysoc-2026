import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildZerodayMetrics } from './zerodays.js';
import { buildPaperclipMetrics, discoverCompany } from './adapters/paperclip.js';
import { buildCayscanMetrics } from './adapters/cayscan.js';
import govRoutes from './governance/routes.js';
import opsRoutes from './ops/routes.js';
import assetsRoutes from './assets/routes.js';
import complianceRoutes from './compliance/routes.js';
import communityRoutes from './community/routes.js';
import riskRoutes from './risk/routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 4310);
const BIND = process.env.BIND || '127.0.0.1';
const MOCK = process.env.CAYSOC_MOCK === '1';
const REAL_ZERODAYS = process.env.CAYSOC_REAL_ZERODAYS === '1' || !MOCK;
const ZERODAY_ROOT = process.env.ZERODAY_ROOT || path.resolve('D:/Projects/0xsec.za/0days');
app.use(cors({ origin: process.env.CORS_ORIGIN || false, credentials: true }));
app.use(express.json());

const SAST = () => new Date().toLocaleString('sv-SE', { timeZone: 'Africa/Johannesburg' }).replace(' ', ' ') + ' SAST';
const mockPath = path.resolve(__dirname, '../mock-overview-payload.json');
function loadMock() {
  try { return JSON.parse(fs.readFileSync(mockPath, 'utf8')); } catch {
    return { generated_at: new Date().toISOString(), generated_at_sast: SAST(), fx:{usd_zar:Number(process.env.FX_USD_ZAR||18.5),as_of:new Date().toISOString().slice(0,10),source:process.env.FX_SOURCE||'manual'}, totals:{streams:6,zeroday_count:{total:0,confirmed:0,pending:0,manufactured:0},valuation:{zar_confirmed:0,zar_pipeline:0,usd_confirmed:0},agents:{active:0,total:0},tasks:{in_progress:0,blocked:0,done_24h:0},alerts:{critical:0,high:0,medium:0}}, streams:[] };
  }
}

function mapCompanyToStream(company) {
  const c = String(company || '').toLowerCase();
  if (c.includes('0xsec')) return '0xsec';
  if (c.includes('xploit')) return 'xploit';
  if (c.includes('caelum')) return 'caelum';
  if (c.includes('hacake')) return 'hacakesec';
  if (c.includes('cayscan') || c.includes('scan')) return 'cayscan';
  return 'csg';
}

function applyZerodayMetrics(base, zd) {
  if (!zd) return base;
  base.fx = base.fx || {};
  base.fx.usd_zar = Number(process.env.FX_USD_ZAR || zd.fx_usd_zar || base.fx.usd_zar || 18.5);
  if (!process.env.FX_SOURCE) base.fx.source = `0days-index (1 USD=R ${zd.fx_usd_zar})`;
  base.totals = base.totals || {};
  base.totals.zeroday_count = zd.counts;
  base.totals.valuation = zd.valuation;
  const byStream = {};
  for (const row of (zd.by_company || [])) {
    const sid = mapCompanyToStream(row.company);
    byStream[sid] = byStream[sid] || { total:0, confirmed:0, pending:0, usd_confirmed:0, usd_pipeline:0 };
    byStream[sid].total += (row.confirmed||0)+(row.pending||0)+(row.manufactured||0);
    byStream[sid].confirmed += row.confirmed||0;
    byStream[sid].pending += (row.pending||0)+(row.manufactured||0); // pipeline bucket for display
    byStream[sid].usd_confirmed += row.usd_confirmed||0;
    byStream[sid].usd_pipeline += row.usd_pipeline||0;
  }
  base.streams = (base.streams || []).map(s => {
    // Always override mock/legacy stream counters with the governed 0-day
    // register, so stream totals add up to the headline totals.
    const m = byStream[s.id] || { total:0, confirmed:0, pending:0, usd_confirmed:0, usd_pipeline:0 };
    return { ...s, zeroday_count: { total:m.total, confirmed:m.confirmed, pending:m.pending }, valuation: { zar_confirmed: Math.round(m.usd_confirmed*base.fx.usd_zar), zar_pipeline: Math.round(m.usd_pipeline*base.fx.usd_zar), usd_confirmed: m.usd_confirmed } };
  });
  base.zeroday = { governed:true, source: zd.source, by_company: zd.by_company || [], inventory: zd.inventory, records_meta: zd.records_meta, valuation_note: 'Uses inventory high-bound USD values from 0days index; ZAR computed via displayed FX. Governed/authorized tracking only.' };
  base._zeroday_root = ZERODAY_ROOT;
  return base;
}

async function buildOverview() {
  const base = loadMock();
  base.generated_at = new Date().toISOString();
  base.generated_at_sast = SAST();
  base.fx.usd_zar = Number(process.env.FX_USD_ZAR || base.fx?.usd_zar || 18.5);
  base.fx.source = process.env.FX_SOURCE || base.fx?.source || 'manual';
  const modes = [];
  if (MOCK && !REAL_ZERODAYS) modes.push('mock');
  if (REAL_ZERODAYS || !MOCK) {
    try {
      const fxOverride = process.env.FX_USD_ZAR ? Number(process.env.FX_USD_ZAR) : undefined;
      const zd = buildZerodayMetrics(ZERODAY_ROOT, fxOverride);
      applyZerodayMetrics(base, zd);
      if (fxOverride) base.fx = { ...base.fx, usd_zar: fxOverride, source: process.env.FX_SOURCE || `env override (1 USD=R ${fxOverride})` };
      modes.push('zerodays:real');
    } catch (e) {
      base._zeroday_error = String(e && e.message || e);
      modes.push('zerodays:error');
    }
  }
  // Read-only adapters (safe when unreachable; configure via env)
  const paperclipBase = process.env.PAPERCLIP_BASE_URL;
  const paperclipEnabled = process.env.PAPERCLIP_ENABLED === '1' || (!!paperclipBase && process.env.PAPERCLIP_ENABLED !== '0' && !MOCK);
  if (paperclipEnabled && paperclipBase) {
    try {
      const pc = await buildPaperclipMetrics({ baseUrl: paperclipBase, token: process.env.PAPERCLIP_API_TOKEN, companyId: process.env.PAPERCLIP_COMPANY_ID });
      base.adapters = base.adapters || {}; base.adapters.paperclip = pc;
      if (pc.agents) base.totals.agents = { active: pc.agents.active, total: pc.agents.total };
      if (pc.issues) base.totals.tasks = { in_progress: pc.issues.in_progress, blocked: pc.issues.blocked, done_24h: pc.issues.done_24h };
      // Merge company into CSG stream summary when identity matches
      if (pc.company && pc.company.issuePrefix === 'CAY') {
        base.streams = (base.streams||[]).map(s => s.id === 'csg' ? { ...s, paperclip_company: pc.company, agents: pc.agents ? {active:pc.agents.active,total:pc.agents.total} : s.agents, tasks: pc.issues ? {in_progress:pc.issues.in_progress,blocked:pc.issues.blocked} : s.tasks } : s);
      }
      modes.push(pc.discovery?.ok ? 'paperclip:ok' : 'paperclip:degraded');
    } catch (e) { base.adapters = base.adapters || {}; base.adapters.paperclip = { enabled:true, error:String(e&&e.message||e) }; modes.push('paperclip:error'); }
  } else modes.push('paperclip:pending');

  const cayscanBase = process.env.CAYSCAN_BASE_URL;
  const cayscanEnabled = process.env.CAYSCAN_ENABLED === '1' || (!!cayscanBase && process.env.CAYSCAN_ENABLED !== '0' && !MOCK);
  if (cayscanEnabled && cayscanBase) {
    try {
      const cs = await buildCayscanMetrics({ baseUrl: cayscanBase, token: process.env.CAYSCAN_API_TOKEN });
      base.adapters = base.adapters || {}; base.adapters.cayscan = cs;
      modes.push(cs.ok ? 'cayscan:ok' : 'cayscan:degraded');
    } catch (e) { base.adapters = base.adapters || {}; base.adapters.cayscan = { enabled:true, error:String(e&&e.message||e) }; modes.push('cayscan:error'); }
  } else modes.push('cayscan:pending');

  base._mode = modes.join(';');
  return base;
}

app.use('/logos', express.static(path.join(__dirname, '../public/logos'), { maxAge: '1d' }));
app.get('/dashboard', (_req,res)=>res.sendFile(path.join(__dirname, '../public/index.html')));
app.get('/health', (_req,res)=>res.json({ok:true,service:'caysoc-dashboard-aggregator',mock:MOCK,sast:SAST()}));
app.get('/api/csg/dashboard/overview', async (_req,res)=>res.json(await buildOverview()));
app.get('/api/csg/dashboard/streams/:id', async (req,res)=>{ const o=await buildOverview(); const s=(o.streams||[]).find(x=>x.id===req.params.id); if(!s) return res.status(404).json({error:'not_found'}); res.json({stream:s, generated_at:o.generated_at, generated_at_sast:o.generated_at_sast}); });
app.get('/api/csg/dashboard/zeroday', async (_req,res)=>{ const o=await buildOverview(); res.json({totals:o.totals?.zeroday_count, valuation:o.totals?.valuation, fx:o.fx, governed:true, note:'Sensitive details role-gated; authorized/internal tracking only.', generated_at_sast:o.generated_at_sast}); });
app.get('/api/csg/dashboard/ops', async (_req,res)=>{
  const o = await buildOverview();
  res.json({host:'cx-serv1',paperclip:process.env.PAPERCLIP_BASE_URL||null,cayscan:process.env.CAYSCAN_BASE_URL||null,mock:MOCK,mode:o._mode,adapters:o.adapters||null,generated_at_sast:SAST()});
});

app.use('/api/csg/gov', govRoutes);
app.use('/api/csg/ops', opsRoutes);
app.use('/api/csg/assets', assetsRoutes);
app.use('/api/csg/compliance', complianceRoutes);
app.use('/api/csg/community', communityRoutes);
app.use('/api/csg/risk', riskRoutes);

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/api/csg/dashboard/live' });
async function broadcast(event, payload){ const msg=JSON.stringify({event, payload, at:new Date().toISOString(), sast:SAST()}); for(const c of wss.clients) if(c.readyState===1) c.send(msg); }
wss.on('connection', async (ws)=>{ ws.send(JSON.stringify({event:'hello', payload: await buildOverview()})); });
setInterval(async ()=>{ try{ broadcast('tick', await buildOverview()); }catch{} }, 15000);
server.listen(PORT, BIND, ()=>console.log(`caysoc-dashboard-aggregator listening on http://${BIND}:${PORT} mock=${MOCK}`));
