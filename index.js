// ============================================================
//  血族调查手札 v4.1.0 — SillyTavern Extension (isaviel-blood-codex)
// ============================================================
import { getContext, extension_settings } from '../../../extensions.js';

const EXT = 'isaviel-blood-codex';
const ASSET = `/scripts/extensions/third-party/${EXT}/assets`;

// ── 工具函数 ──
function escapeHTML(v) {
  return String(v).replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[c]);
}

function sv(v) {
  if (v == null) return '';
  if (Array.isArray(v)) return sv(v[0]);
  return typeof v === 'string' ? escapeHTML(v) : v;
}

const CN_NUM = ['零','壹','贰','叁','肆','伍','陆','柒','捌','玖','拾'];
function cn(n) { return CN_NUM[Number(n)] ?? String(n); }

const OATH_MAP = {
  'intact':'誓言依旧有效','strained':'誓言承压','fractured':'誓言裂痕',
  'broken':'誓言已碎','severed':'誓言已断','betrayed':'誓言已背叛',
};
function oathText(v) { return OATH_MAP[sv(v)] || sv(v) || '未知'; }

const STAGE_DESC = {
  1:'他仍将她视为一场被搁期的处决',
  2:'她已变成值得持续观察的被告',
  3:'危险的平等合作者',
  4:'秘密裂隙·审判、信任、与旧时间线彼此冲突',
  5:'当前的塞维林',
  6:'承认欲望',
  7:'爱成为证据污染',
  8:'灾难抉择',
};

const NPC_FULL_NAMES = {
  '梅拉':'梅拉·登', '伯莎':'伯莎·索恩', '维奥拉':'维奥拉·凯斯',
  '玛尔塔':'玛尔塔·格雷文', '艾琳':'艾琳·瓦尔', '奥斯温':'奥斯温·费恩',
  '赫尔曼':'赫尔曼·格劳',
};

// ── 变量读取 ──
function getState() {
  let data = null;

  // 方式1: TavernHelper MVU API
  try {
    if (window.TavernHelper?.getVariables) {
      const vars = window.TavernHelper.getVariables({ type:'message', message_id:'latest' });
      if (vars?.stat_data) data = vars.stat_data;
      else if (vars?.display_data?.stat_data) data = vars.display_data.stat_data;
      else if (vars?.display_data) data = vars.display_data;
    }
  } catch(e) { console.warn('[blood-codex] TavernHelper error:', e); }

  // 方式2: 全局 getVariables / getAllVariables
  if (!data) {
    try {
      const gv = window.getVariables || window.getAllVariables;
      if (gv) {
        const r = gv({ type:'message', message_id:'latest' });
        if (r?.stat_data) data = r.stat_data;
        else if (r) data = r;
      }
    } catch(e) {}
  }

  // 方式3: getContext().chat 遍历
  if (!data) {
    try {
      const ctx = getContext();
      const chat = ctx?.chat;
      if (chat?.length) {
        for (let i = chat.length - 1; i >= 0; i--) {
          const m = chat[i];
          const candidates = [
            m?.variables?.at?.(-1)?.stat_data,
            m?.variables?.at?.(-1)?.display_data?.stat_data,
            m?.data?.stat_data, m?.extra?.variables?.stat_data,
            m?.variables?.stat_data, m?.stat_data,
            m?.data?.display_data?.stat_data, m?.extra?.display_data?.stat_data,
          ];
          for (const c of candidates) {
            if (c && typeof c === 'object' && Object.keys(c).length > 2) {
              data = c; break;
            }
          }
          if (data) break;
          // deep find
          const deepFind = (obj, key, depth=0) => {
            if (!obj || typeof obj !== 'object' || depth > 5) return null;
            if (obj[key] && typeof obj[key] === 'object') return obj[key];
            for (const k of Object.keys(obj)) {
              const r = deepFind(obj[k], key, depth+1);
              if (r) return r;
            }
            return null;
          };
          const found = deepFind(m, 'stat_data');
          if (found && Object.keys(found).length > 2) { data = found; break; }
        }
      }
    } catch(e) {}
  }

  return data;
}

// ── 页面构建 ──
function sealHTML(label, value, engName) {
  return `<div class="vbc-seal">
    <img class="bg" src="${ASSET}/stamp.png">
    <span class="lbl">${label}</span>
    <span class="val">${value}</span>
    <span class="en">${engName}</span>
  </div>`;
}
function sevSealHTML(label, value, engName) {
  return `<div class="sev-seal">
    <img class="bg" src="${ASSET}/stamp.png">
    <span class="lbl">${label}</span>
    <span class="val">${value}</span>
    <span class="en">${engName}</span>
  </div>`;
}
function coreMetricGrid(entries) {
  const valid = entries.filter(([,v]) => v !== undefined && v !== null && v !== '');
  if (!valid.length) return '';
  return `<div class="npc-metric-grid core-metric-grid">${valid.map(([k,v]) => `<div class="npc-metric"><span>${sv(k)}</span><b>${sv(v)}</b></div>`).join('')}</div>`;
}

function buildIsaviel(d) {
  const isa = d?.伊萨维尔 || {};
  const rel = isa?.关系 || {};
  const w = d?.世界 || {};
  const stage = sv(rel.关系阶段) || sv(rel.阶段) || '?';
  const stageName = sv(rel.阶段名称) || '';
  const stageN = parseInt(stage) || 0;
  const desc = STAGE_DESC[stageN] || stageName;
  const secret = sv(rel.秘密层级) ?? 0;
  const oath = oathText(rel.誓言状态);

  // 阶段条件→最近依据
  const cond = rel.阶段条件 || {};
  let recentBasis = '';
  const condEntries = Object.entries(cond);
  for (let i = condEntries.length - 1; i >= 0; i--) {
    if (sv(condEntries[i][1]) === true || sv(condEntries[i][1]) === 'true') {
      recentBasis = condEntries[i][0]; break;
    }
  }

  const seals = `
    ${sealHTML('信任', sv(rel.信任)??0, 'Trust')}
    ${sealHTML('尊重', sv(rel.尊重)??0, 'Respect')}
    ${sealHTML('当前性', sv(rel.当前性)??0, 'Present')}
    ${sealHTML('欲望', sv(rel.欲望)??0, 'Desire')}
    ${sealHTML('偏见', sv(rel.偏见)??0, 'Bias')}`;

  const body = sv(isa.身体状态) || '';
  const emotion = sv(isa.情绪状态) || '';
  const judgment = sv(isa.当前判断) || '';
  const relStatus = sv(rel.关系状态) || stageName;

  const time = sv(w.时间) || '';
  const loc = sv(w.当前地点) || '';
  const event = sv(w.当前事件) || '';
  const invest = sv(w.当前调查) || '';
  const signs = w.灾难征兆;
  let signsText = '';
  if (Array.isArray(signs)) signsText = signs.map(s => sv(s)).filter(Boolean).join('；');
  else signsText = sv(signs) || '';

  const oathLine = recentBasis ? `${oath}<br>${recentBasis}` : oath;
  const coreMetrics = coreMetricGrid([
    ['奥术负荷',isa.奥术负荷],['身心疲劳',isa.身心疲劳],['自我控制',isa.自我控制],['旧记忆侵入',isa.旧记忆侵入],
    ['秘密压力',isa.秘密压力],['誓言压力',isa.誓言压力],['私人开放度',isa.私人开放度],['占有倾向',isa.占有倾向]
  ]);

  const scroll = `
    <div class="vbc-stage">
      <div class="vbc-stage-t">阶段-${cn(stageN)}</div>
      <div class="vbc-stage-desc">${desc}</div>
    </div>
    <div class="t-goth">关系状态</div>
    <div class="t-body t-center">${relStatus}</div>
    ${coreMetrics}
    <div class="vbc-cols">
      <div class="vbc-col">
        ${time ? `<div class="t-red">时间</div><div class="t-body">${time}</div>` : ''}
        ${loc ? `<div class="t-red">地点</div><div class="t-body">${loc}</div>` : ''}
        ${event ? `<div class="t-red">事件</div><div class="t-body">${event}</div>` : ''}
        ${invest ? `<div class="t-red">调查</div><div class="t-body">${invest}</div>` : ''}
        ${signsText ? `<div class="t-red">灾难征兆</div><div class="t-body">${signsText}</div>` : ''}
      </div>
      <div class="vbc-vdiv"><div class="vbc-vdiv-inner"></div></div>
      <div class="vbc-col">
        <div class="vbc-secret">
          <span class="vbc-secret-lbl">秘密层级</span>
          <span class="vbc-secret-val">${cn(secret)}</span>
        </div>
        <div class="t-dark">${oathLine}</div>
        ${body ? `<div class="t-red">身体状态</div><div class="t-body">${body}</div>` : ''}
        ${emotion ? `<div class="t-red">情绪状态</div><div class="t-body">${emotion}</div>` : ''}
        ${judgment ? `<div class="t-red">当前判断</div><div class="t-body">${judgment}</div>` : ''}
      </div>
    </div>`;

  return { seals, scroll };
}

function buildSeverin(d) {
  const sev = d?.塞维林 || {};
  const hunger = sv(sev.饥饿程度) ?? '';
  const frenzy = sv(sev.狂乱风险?.综合程度) || sv(sev.狂乱风险?.程度) || '';
  const daycall = sv(sev.白昼牵引?.强度) || sv(sev.白昼牵引?.是否生效) || '';
  const sun = sv(sev.日照状态?.暴露程度) || sv(sev.日照状态?.暴露) || '';
  const vitae = sv(sev.驱动绯血?.是否启用) ?? sv(sev.驱动绯血?.启用) ?? '';
  const alive = sv(sev.驱动绯血?.活人化程度) ?? sv(sev.驱动绯血?.活人化) ?? '';

  const vitaeStr = vitae === true || vitae === 'true' ? '开' : vitae === false || vitae === 'false' ? '关' : String(vitae);
  const aliveStr = alive === true || alive === 'true' ? '有' : alive === false || alive === 'false' ? '无' : String(alive);

  const seals = `
    ${sevSealHTML('饥饿', hunger, 'Hunger')}
    ${sevSealHTML('狂乱', frenzy, 'Frenzy')}
    ${sevSealHTML('牵引', daycall, 'Daycall')}
    ${sevSealHTML('日照', sun, 'Sun')}
    ${sevSealHTML('绯血', vitaeStr, 'Vitae')}
    ${sevSealHTML('活人化', aliveStr, 'Alive')}`;

  const status = sv(sev.绯血状态) || sv(sev.身体状态) || '';
  const action = sv(sev.当前行动状态) || '';
  const injury = sv(sev.伤势) || '';
  const recovObj = sev.恢复状态 || {};
  const recov = typeof recovObj === 'object' && !Array.isArray(recovObj)
    ? [sv(recovObj.自愈速度), sv(recovObj.当前阻碍)].filter(Boolean).join('；')
    : sv(recovObj) || '';
  // 阻碍已合并到恢复状态中
  const block = '';

  const dcDesc = sv(sev.白昼牵引?.当前表现) || sv(sev.白昼牵引?.表现) || '';
  const sunProt = sv(sev.日照状态?.防护状态) || sv(sev.日照状态?.防护) || '';
  const sunEff = sv(sev.日照状态?.当前影响) || sv(sev.日照状态?.影响) || '';
  const sunLine = [sunProt, sunEff].filter(Boolean).join('；');

  const feed = sev.最近进食 || {};
  let feedText = '';
  if (typeof feed === 'object' && !Array.isArray(feed)) {
    const parts = [
      sv(feed.时间), sv(feed.来源) || sv(feed.对象),
      sv(feed.血液类型), sv(feed.情绪共鸣), sv(feed.满足程度),
      sv(feed.当前地点) || sv(feed.地点), sv(feed.方式), sv(feed.量)
    ].filter(Boolean);
    feedText = parts.join('，');
  } else {
    feedText = sv(feed);
  }

  const frenzyReason = sv(sev.狂乱风险?.当前诱因) || sv(sev.狂乱风险?.诱因) || '';
  const coreMetrics = coreMetricGrid([
    ['绯血储备',sev.绯血储备],['精神干扰',sev.精神干扰],['记忆完整度',sev.记忆完整度],
    ['政治暴露',sev.政治暴露风险],['城堡控制',sev.城堡控制度]
  ]);
  const triggers = Array.isArray(sev.记忆触发源) ? sev.记忆触发源.map(sv).filter(Boolean).join('；') : sv(sev.记忆触发源);
  const promises = Array.isArray(sev.公开承诺) ? sev.公开承诺.map(sv).filter(Boolean).join('；') : sv(sev.公开承诺);
  const boundaries = Array.isArray(sev.明确边界) ? sev.明确边界.map(sv).filter(Boolean).join('；') : sv(sev.明确边界);

  const scroll = `
    <div class="sev-status-title">${status}</div>
    ${coreMetrics}
    <div class="vbc-cols">
      <div class="vbc-col">
        ${action ? `<div class="t-red">当前行动</div><div class="t-body">${action}</div>` : ''}
        ${injury ? `<div class="t-red">伤势</div><div class="t-body">${injury}</div>` : ''}
        ${recov ? `<div class="t-red">恢复</div><div class="t-body">${recov}</div>` : ''}
        ${block ? `<div class="t-red">阻碍</div><div class="t-body">${block}</div>` : ''}
      </div>
      <div class="vbc-vdiv"><div class="vbc-vdiv-inner"></div></div>
      <div class="vbc-col">
        ${dcDesc ? `<div class="t-red">白昼牵引</div><div class="t-body">${dcDesc}</div>` : ''}
        ${sunLine ? `<div class="t-red">日照防护</div><div class="t-body">${sunLine}</div>` : ''}
        ${feedText ? `<div class="t-red">最近进食</div><div class="t-body">${feedText}</div>` : ''}
        ${frenzyReason ? `<div class="t-red">狂乱诱因</div><div class="t-body">${frenzyReason}</div>` : ''}
        ${triggers ? `<div class="t-red">记忆触发源</div><div class="t-body">${triggers}</div>` : ''}
        ${promises ? `<div class="t-red">公开承诺</div><div class="t-body">${promises}</div>` : ''}
        ${boundaries ? `<div class="t-red">明确边界</div><div class="t-body">${boundaries}</div>` : ''}
      </div>
    </div>`;

  return { seals, scroll };
}

function metricLine(label, obj) {
  if (!obj || typeof obj !== 'object') return '';
  const parts = Object.entries(obj).filter(([,v]) => ['string','number','boolean'].includes(typeof v))
    .map(([k,v]) => `${sv(k)} ${sv(v)}`);
  return parts.length ? `<div class="npc-stats"><span class="npc-label">${sv(label)}</span> ${parts.join(' · ')}</div>` : '';
}

function buildMainNPC(d, key, fullName) {
  const info = d?.[key] || {};
  if (!Object.keys(info).length) return `<div class="npc-empty">${sv(fullName)}尚无变量记录</div>`;
  const scalarSkip = new Set(['身体状态','当前地点','在场状态','当前情绪','核心目标','当前计划','个人处境','当前态度','已知秘密','最近变化依据','已处理事件']);
  const metricEntries = Object.entries(info).filter(([k,v]) => !scalarSkip.has(k) && ['string','number','boolean'].includes(typeof v));
  const adrianCore = key === '阿德里安'
    ? ['血缚影响','总管身份边界','私人感情压抑','自主判断']
    : [];
  const coreMetrics = adrianCore
    .map(name => [name, info[name]])
    .filter(([,value]) => value !== undefined && value !== null && value !== '');
  const coreNames = new Set(adrianCore);
  const metrics = metricEntries.filter(([name]) => !coreNames.has(name));
  let html = `<div class="npc-profile-title">${sv(fullName)}</div>`;
  if (info.在场状态 || info.当前地点) html += `<div class="npc-stats npc-center">${[sv(info.在场状态),sv(info.当前地点)].filter(Boolean).join(' · ')}</div>`;
  if (coreMetrics.length) {
    html += '<div class="npc-section"><div class="t-red">血缚与身份</div></div>';
    html += `<div class="npc-metric-grid npc-core-metrics">${coreMetrics.map(([k,v]) => `<div class="npc-metric"><span>${sv(k)}</span><b>${sv(v)}</b></div>`).join('')}</div>`;
  }
  if (metrics.length) html += `<div class="npc-metric-grid">${metrics.map(([k,v]) => `<div class="npc-metric"><span>${sv(k)}</span><b>${sv(v)}</b></div>`).join('')}</div>`;
  for (const [label, value] of Object.entries(info)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && !['已处理事件'].includes(label)) html += metricLine(label, value);
  }
  const rows = [['身体状态',info.身体状态],['当前情绪',info.当前情绪],['当前态度',info.当前态度],['核心目标',info.核心目标],['当前计划',info.当前计划],['个人处境',info.个人处境],['最近变化依据',info.最近变化依据]];
  for (const [label,value] of rows) if (value) html += `<div class="npc-section"><div class="t-red">${label}</div><div class="t-body">${sv(value)}</div></div>`;
  const secrets = Array.isArray(info.已知秘密) ? info.已知秘密.map(s=>sv(s)).filter(Boolean).join('；') : sv(info.已知秘密);
  if (secrets) html += `<div class="npc-section"><div class="t-red">已知秘密</div><div class="t-body">${secrets}</div></div>`;
  return html;
}

function buildNPC(d) {
  const others = d?.其他NPC || {};

  let html = '';

  // 其他NPC
  if (typeof others === 'object' && Object.keys(others).length) {
    for (const [name, info] of Object.entries(others)) {
      if (!info || typeof info !== 'object') continue;
      const displayName = NPC_FULL_NAMES[name] || name;
      html += `<div class="npc-name">${sv(displayName)}</div>`;
      const parts = [];
      if (info.身份) parts.push(sv(info.身份));
      if (info.当前地点 || info.地点) parts.push(`地点: ${sv(info.当前地点) || sv(info.地点)}`);
      if (info.在场状态) parts.push(sv(info.在场状态));
      if (parts.length) html += `<div class="npc-stats">${parts.join(' · ')}</div>`;
      if (info.身体状态) html += `<div class="npc-stats"><span class="npc-label">身体</span> <span class="npc-val">${sv(info.身体状态)}</span></div>`;
      if (info.当前态度) html += `<div class="npc-stats"><span class="npc-label">态度</span> <span class="npc-val">${sv(info.当前态度)}</span></div>`;

      const ts = info.对塞维林 || {};
      const ti = info.对伊萨维尔 || {};
      const tsParts = [];
      if (ts.信任 != null) tsParts.push(`信任${sv(ts.信任)}`);
      if (ts.忠诚 != null) tsParts.push(`忠诚${sv(ts.忠诚)}`);
      if (ts.畏惧 != null) tsParts.push(`畏惧${sv(ts.畏惧)}`);
      const tiParts = [];
      if (ti.信任 != null) tiParts.push(`信任${sv(ti.信任)}`);
      if (ti.警戒 != null) tiParts.push(`警戒${sv(ti.警戒)}`);
      if (tsParts.length) html += `<div class="npc-stats"><span class="npc-label">对塞维林</span> ${tsParts.join(' · ')}</div>`;
      if (tiParts.length) html += `<div class="npc-stats"><span class="npc-label">对伊萨维尔</span> ${tiParts.join(' · ')}</div>`;

      const secrets = info.已知秘密;
      if (secrets) {
        let st = Array.isArray(secrets) ? secrets.map(s=>sv(s)).filter(Boolean).join('；') : sv(secrets);
        if (st) html += `<div class="npc-stats"><span class="npc-label">已知秘密</span> <span class="npc-val">${st}</span></div>`;
      }
    }
  }

  if (!html) html = '<div class="npc-empty">暂无其他NPC记录</div>';
  return html;
}

// ── UI 构建 ──
let currentPage = 'isaviel';
let overlay = null;
let refreshTimer = null;
let lastStateSignature = '';

function stateSignature() {
  const d = getState();
  return d ? JSON.stringify(d) : '';
}

function stopAutoRefresh() {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
}

function startAutoRefresh() {
  stopAutoRefresh();
  lastStateSignature = stateSignature();
  refreshTimer = setInterval(() => {
    if (!overlay || !overlay.classList.contains('open')) return;
    const next = stateSignature();
    if (next && next !== lastStateSignature) {
      lastStateSignature = next;
      overlay.remove(); overlay = null; buildUI();
    }
  }, 1800);
}

function buildUI() {
  stopAutoRefresh();
  if (overlay) overlay.remove();

  const d = getState();

  overlay = document.createElement('div');
  overlay.className = 'vbc-overlay open';
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  const shell = document.createElement('div');
  shell.className = 'vbc-shell';

  // 关闭 & 刷新按钮
  const closeBtn = document.createElement('button');
  closeBtn.className = 'vbc-close'; closeBtn.textContent = '✕';
  closeBtn.onclick = close;
  shell.appendChild(closeBtn);

  const refreshBtn = document.createElement('button');
  refreshBtn.className = 'vbc-refresh'; refreshBtn.textContent = '↻';
  refreshBtn.onclick = () => { overlay.remove(); overlay = null; buildUI(); };
  shell.appendChild(refreshBtn);

  // 火漆
  const waxImg = document.createElement('img');
  waxImg.className = 'vbc-wax'; waxImg.src = `${ASSET}/wax.png`; waxImg.draggable = false;
  shell.appendChild(waxImg);

  if (!d) {
    shell.innerHTML += `<div style="flex:1;display:flex;align-items:center;justify-content:center;text-align:center;padding:20px;z-index:3">
      <div><div class="t-goth" style="font-size:16px;margin-bottom:8px">最新楼层尚未找到 <code style="background:rgba(0,0,0,.15);padding:2px 6px;border-radius:3px">stat_data</code></div>
      <div class="t-dark">请确认 MVU 已初始化，或先生成一条新回复。</div></div></div>`;
    overlay.appendChild(shell);
    document.body.appendChild(overlay);
    startAutoRefresh();
    return;
  }

  // === 头部 ===
  const top = document.createElement('div');
  top.className = 'vbc-top';

  const titleRow = `<div class="vbc-title-row">
    <div class="vbc-title-deco"></div><h1>血族调查手札</h1><div class="vbc-title-deco"></div>
  </div>
  <img class="vbc-header-divider" src="${ASSET}/divider.png" draggable="false">`;

  const isaData = buildIsaviel(d);
  const sevData = buildSeverin(d);

  top.innerHTML = titleRow +
    `<div class="vbc-seals" id="bc-isaviel-seals">${isaData.seals}</div>` +
    `<div class="sev-seals-grid" id="bc-sev-seals">${sevData.seals}</div>`;
  shell.appendChild(top);

  // === 中部 ===
  const mid = document.createElement('div');
  mid.className = 'vbc-mid';

  const npcHTML = buildNPC(d);
  const mainNPCPages = {
    adrian: buildMainNPC(d, '阿德里安', '阿德里安·维斯'),
    lucien: buildMainNPC(d, '吕西安', '吕西安·凡恩'),
    vilesian: buildMainNPC(d, '维莱西安', '维莱西安·阿玛瑞斯'),
    valentin: buildMainNPC(d, '瓦伦汀', '瓦伦汀·维恩'),
    herman: buildMainNPC(d, '赫尔曼', '赫尔曼·格劳'),
  };

  mid.innerHTML = `
    <div class="vbc-scroll vbc-page active" id="bc-page-isaviel">${isaData.scroll}</div>
    <div class="vbc-scroll vbc-page" id="bc-page-severin">${sevData.scroll}</div>
    <div class="vbc-scroll vbc-page" id="bc-page-adrian">${mainNPCPages.adrian}</div>
    <div class="vbc-scroll vbc-page" id="bc-page-lucien">${mainNPCPages.lucien}</div>
    <div class="vbc-scroll vbc-page" id="bc-page-vilesian">${mainNPCPages.vilesian}</div>
    <div class="vbc-scroll vbc-page" id="bc-page-valentin">${mainNPCPages.valentin}</div>
    <div class="vbc-scroll vbc-page" id="bc-page-herman">${mainNPCPages.herman}</div>
    <div class="vbc-scroll vbc-page" id="bc-page-npc">${npcHTML}</div>`;
  shell.appendChild(mid);

  // === 底部导航 ===
  const bot = document.createElement('nav');
  bot.className = 'vbc-bot';
  bot.innerHTML = `
    <button class="vbc-nbtn" id="bc-btn-left"><img src="${ASSET}/brush.png"><span id="bc-lbl-left"></span></button>
    <div class="vbc-ncur" id="bc-nav-cur"></div>
    <button class="vbc-nbtn mir" id="bc-btn-right"><img src="${ASSET}/brush.png"><span id="bc-lbl-right"></span></button>`;
  shell.appendChild(bot);

  overlay.appendChild(shell);
  document.body.appendChild(overlay);
  startAutoRefresh();

  currentPage = 'isaviel';
  updateNav();

  document.getElementById('bc-btn-left').onclick = () => {
    const i = PAGE_ORDER.indexOf(currentPage);
    switchTo(PAGE_ORDER[(i - 1 + PAGE_ORDER.length) % PAGE_ORDER.length]);
  };
  document.getElementById('bc-btn-right').onclick = () => {
    const i = PAGE_ORDER.indexOf(currentPage);
    switchTo(PAGE_ORDER[(i + 1) % PAGE_ORDER.length]);
  };
}

const PAGE_ORDER = ['isaviel','severin','adrian','lucien','vilesian','valentin','herman','npc'];
const PAGE_NAMES = {
  isaviel: '伊萨维尔·塞兰尼斯',
  severin: '塞维林·诺克提斯',
  adrian: '阿德里安·维斯',
  lucien: '吕西安·凡恩',
  vilesian: '维莱西安·阿玛瑞斯',
  valentin: '瓦伦汀·维恩',
  herman: '赫尔曼·格劳',
  npc: '其他人物',
};

function switchTo(target) {
  if (target === currentPage) return;
  document.querySelectorAll('.vbc-page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById('bc-page-' + target);
  if (page) page.classList.add('active');

  // 印章切换
  const isaSeals = document.getElementById('bc-isaviel-seals');
  const sevSeals = document.getElementById('bc-sev-seals');
  if (isaSeals) isaSeals.style.display = target === 'isaviel' ? 'flex' : 'none';
  if (sevSeals) sevSeals.classList.toggle('show', target === 'severin');

  currentPage = target;
  updateNav();
}

function updateNav() {
  const i = PAGE_ORDER.indexOf(currentPage);
  document.getElementById('bc-nav-cur').textContent = PAGE_NAMES[currentPage];
  document.getElementById('bc-lbl-left').textContent = PAGE_NAMES[PAGE_ORDER[(i - 1 + PAGE_ORDER.length) % PAGE_ORDER.length]];
  document.getElementById('bc-lbl-right').textContent = PAGE_NAMES[PAGE_ORDER[(i + 1) % PAGE_ORDER.length]];
}

function close() {
  if (overlay) { overlay.classList.remove('open'); stopAutoRefresh(); }
}

// ── 注册到魔棒菜单 ──
jQuery(async () => {
  $('#blood-codex-btn').remove();
  const buttonHtml = `<div id="blood-codex-btn" class="list-group-item flex-container flexGap5">
    <div class="fa-solid fa-book-skull"></div>
    <span>血族调查手札</span>
  </div>`;
  $('#extensionsMenu').append(buttonHtml);
  $('#blood-codex-btn').on('click', () => {
    if (overlay && overlay.classList.contains('open')) { close(); }
    else { buildUI(); }
  });
  console.log('[blood-codex] v4.1.0 loaded');
});
