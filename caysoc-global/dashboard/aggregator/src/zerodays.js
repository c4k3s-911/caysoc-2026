import fs from 'fs';
import path from 'path';

function parseMoneyRange(s) {
  // "$50,000 – $200,000" / "$500K – $2M" / "$0"
  if (!s) return { low:0, high:0 };
  const norm = String(s).replace(/\s+/g,' ').replace(/[–—]/g,'-').trim();
  const parts = norm.split('-').map(p=>p.trim());
  const parseOne = (p) => {
    let m = p.match(/\$?([\d,.]+)\s*([KMB])?/i);
    if (!m) return 0;
    let n = parseFloat(m[1].replace(/,/g,''));
    const u = (m[2]||'').toUpperCase();
    if (u==='K') n*=1e3; if (u==='M') n*=1e6; if (u==='B') n*=1e9;
    return n;
  };
  if (parts.length===1) { const v=parseOne(parts[0]); return {low:v, high:v}; }
  return { low: parseOne(parts[0]), high: parseOne(parts[1]||parts[0]) };
}
function parseZarRange(s){ return parseMoneyRange(String(s||'').replace(/R\s*/gi,'$')); }

export function parseIndexMd(root) {
  const idx = path.join(root, '_index.md');
  if (!fs.existsSync(idx)) return null;
  const t = fs.readFileSync(idx, 'utf8');
  const res = { source: idx, portfolio:{}, companies:[], inventory:[], fx_usd_zar:18.5 };
  const fxm = t.match(/1 USD\s*=\s*R\s*([\d.]+)/i); if (fxm) res.fx_usd_zar = Number(fxm[1]);
  const metric = (label) => { const m=t.match(new RegExp(`\\|\\s*\\*\\*${label}\\*\\*\\s*\\|\\s*([^|]+)\\|`,'i')); return m?m[1].trim():null; };
  const num = (v)=>{ const m=String(v||'').match(/([\d,.]+)/); return m?Number(m[1].replace(/,/g,'')):0; };
  res.portfolio = {
    confirmed: num(metric('Confirmed 0Days')),
    manufactured: num(metric('Manufactured Exploits')),
    pending: num(metric('Pending Review')),
    total_reports: num(metric('Total Reports')),
    est_usd: metric('Estimated Value \\(USD\\)'),
    est_zar: metric('Estimated Value \\(ZAR\\)')
  };
  // company distribution table
  const lines = t.split(/\r?\n/);
  let inCo=false, inInv=false;
  for (const line of lines) {
    if (/^\|\s*Company\s*\|/.test(line)) { inCo=true; inInv=false; continue; }
    if (/^\|\s*#\s*\|\s*ID\s*\|/.test(line)) { inInv=true; inCo=false; continue; }
    if (!line.startsWith('|')) { if (inCo||inInv) { /* keep scanning */ } continue; }
    if (/^\|\s*-+/.test(line)) continue;
    const cells = line.split('|').map(c=>c.trim()).filter((_,i,a)=>i>0 && i<a.length-1);
    if (inCo && cells.length>=5) {
      const usd=parseMoneyRange(cells[4]);
      res.companies.push({ company:cells[0], confirmed:num(cells[1]), manufactured:num(cells[2]), pending:num(cells[3]), est_usd_low:usd.low, est_usd_high:usd.high, est_usd_label:cells[4] });
    }
    if (inInv && cells.length>=8) {
      const usd=parseMoneyRange(cells[6]);
      res.inventory.push({ n:cells[0], id:cells[1], title:cells[2], type:cells[3], company:cells[4], cvss:cells[5], est_usd_low:usd.low, est_usd_high:usd.high, status:cells[7] });
    }
  }
  return res;
}

function parseFrontmatter(file) {
  try {
    const t = fs.readFileSync(file,'utf8');
    const m = t.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) return null;
    const o={}; for (const ln of m[1].split(/\r?\n/)) { const kv=ln.match(/^([^:]+):\s*(.*)$/); if(kv){ let v=kv[2].trim().replace(/^"|"$/g,''); if(/^\d+(\.\d+)?$/.test(v)) v=Number(v); o[kv[1].trim()]=v; } }
    o._file=file; return o;
  } catch { return null; }
}

export function scanRecords(root) {
  const out=[]; for (const dir of ['confirmed','pending','manufactured']) {
    const p=path.join(root,dir); if(!fs.existsSync(p)) continue;
    for (const f of fs.readdirSync(p).filter(x=>x.endsWith('.md'))) { const fm=parseFrontmatter(path.join(p,f)); if(fm) out.push({dir,...fm}); }
  } return out;
}

export function buildZerodayMetrics(root, fxOverride) {
  const idx = parseIndexMd(root);
  const records = scanRecords(root);
  const fx = Number(fxOverride || idx?.fx_usd_zar || 18.5);
  // prefer index inventory values; fallback to record frontmatter
  const inv = idx?.inventory || [];
  let confirmed=0,pending=0,manufactured=0, usdConfirmed=0, usdPipeline=0;
  const byCompany = {};
  const addCo=(name,patch)=>{ const cname=String(name??'unknown'); const k=cname.toLowerCase(); byCompany[k]=byCompany[k]||{company:cname,confirmed:0,pending:0,manufactured:0,usd_confirmed:0,usd_pipeline:0}; Object.assign(byCompany[k], {confirmed:byCompany[k].confirmed+(patch.confirmed||0),pending:byCompany[k].pending+(patch.pending||0),manufactured:byCompany[k].manufactured+(patch.manufactured||0),usd_confirmed:byCompany[k].usd_confirmed+(patch.usd_confirmed||0),usd_pipeline:byCompany[k].usd_pipeline+(patch.usd_pipeline||0)}); };
  if (inv.length) {
    for (const r of inv) {
      const t=(r.type||'').toLowerCase(), st=(r.status||'').toLowerCase(), co=r.company||'unknown';
      const isConf = t.includes('confirm') || st.includes('verif') || st.includes('confirm');
      const isMan = t.includes('manufact');
      const usd = r.est_usd_high || r.est_usd_low || 0; // headline uses high bound? keep transparent; use mid-like high for pipeline label
      if (isConf){ confirmed++; usdConfirmed+=usd; addCo(co,{confirmed:1,usd_confirmed:usd}); }
      else if (isMan){ manufactured++; usdPipeline+=usd; addCo(co,{manufactured:1,usd_pipeline:usd}); }
      else { pending++; usdPipeline+=usd; addCo(co,{pending:1,usd_pipeline:usd}); }
    }
  } else {
    for (const r of records) {
      const st=String(r.status||'').toLowerCase(); const usd=Number(r.est_value_usd_high||r.est_value_usd_low||0); const co=r.company||'unknown';
      if (st.includes('verif')||st.includes('confirm')){ confirmed++; usdConfirmed+=usd; addCo(co,{confirmed:1,usd_confirmed:usd}); }
      else if (String(r.dir)==='manufactured'){ manufactured++; usdPipeline+=usd; addCo(co,{manufactured:1,usd_pipeline:usd}); }
      else { pending++; usdPipeline+=usd; addCo(co,{pending:1,usd_pipeline:usd}); }
    }
  }
  return {
    source: { index: idx?.source||null, root, mode: inv.length?'index+records':'records', index_last_updated: (idx?.source && fs.existsSync(idx.source) ? ((fs.readFileSync(idx.source,'utf8').match(/Last Updated\*\*:\s*([^\n]+)/i)||[])[1]||null) : null) },
    fx_usd_zar: fx,
    counts: { total: confirmed+pending+manufactured, confirmed, pending, manufactured },
    valuation: { usd_confirmed: usdConfirmed, usd_pipeline: usdPipeline, zar_confirmed: Math.round(usdConfirmed*fx), zar_pipeline: Math.round(usdPipeline*fx) },
    by_company: Object.values(byCompany),
    inventory: inv,
    records_meta: records.map(r=>({id:r.id,title:r.title,type:r.type,company:r.company,status:r.status,cvss:r.cvss,usd_low:r.est_value_usd_low,usd_high:r.est_value_usd_high,file:r._file}))
  };
}
