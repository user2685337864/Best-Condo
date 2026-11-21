const WEBHOOK = process.env.DISCORD_LOG_WEBHOOK;

const COUNTRY_NAMES = {
  BR:'Brasil',PT:'Portugal',US:'Estados Unidos',MX:'México',AR:'Argentina',
  CO:'Colômbia',PE:'Peru',CL:'Chile',UY:'Uruguai',BO:'Bolívia',PY:'Paraguai',
  VE:'Venezuela',EC:'Equador',CR:'Costa Rica',PA:'Panamá',DO:'Rep. Dominicana',
  GT:'Guatemala',HN:'Honduras',SV:'El Salvador',NI:'Nicarágua',CU:'Cuba',
  RU:'Rússia',BY:'Bielorrússia',UA:'Ucrânia',KZ:'Cazaquistão',
  DE:'Alemanha',FR:'França',GB:'Reino Unido',ES:'Espanha',IT:'Itália',
  NL:'Países Baixos',PL:'Polônia',SE:'Suécia',NO:'Noruega',FI:'Finlândia',
  CA:'Canadá',AU:'Austrália',JP:'Japão',KR:'Coreia do Sul',CN:'China',IN:'Índia',
  TR:'Turquia',ID:'Indonésia',PH:'Filipinas',VN:'Vietnã',TH:'Tailândia',
  ZA:'África do Sul',NG:'Nigéria',EG:'Egito',MA:'Marrocos',
};

function flag(code) {
  if (!code || code.length !== 2) return '🌍';
  try { return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)); }
  catch(e) { return '🌍'; }
}

function parseUA(ua = '') {
  let browser = 'Desconhecido', os = 'Desconhecido', device = '🖥️ Desktop';
  if (/Mobile|Android|iPhone/i.test(ua)) device = '📱 Mobile';
  else if (/iPad|Tablet/i.test(ua)) device = '📱 Tablet';
  if (/Edg\//i.test(ua))          browser = 'Edge';
  else if (/OPR\//i.test(ua))     browser = 'Opera';
  else if (/Chrome\//i.test(ua))  browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua))  browser = 'Safari';
  const wm = ua.match(/Windows NT ([\d.]+)/);
  if (wm) {
    const v = {'10.0':'Windows 10/11','6.3':'Win 8.1','6.2':'Win 8','6.1':'Win 7'};
    os = v[wm[1]] || 'Windows';
  } else if (/iPhone|iPad/i.test(ua)) {
    const m = ua.match(/OS ([\d_]+)/); os = 'iOS ' + (m ? m[1].replace(/_/g,'.') : '');
  } else if (/Android/i.test(ua)) {
    const m = ua.match(/Android ([\d.]+)/); os = 'Android ' + (m ? m[1] : '');
  } else if (/Mac OS X/i.test(ua)) {
    os = 'macOS';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  }
  return { browser, os, device };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const ip = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'N/A').split(',')[0].trim();
  const country = (req.headers['x-vercel-ip-country'] || '').toUpperCase();
  const decodeGeo = value => {
    if (!value) return '';
    try { return decodeURIComponent(String(value).replace(/\+/g, ' ')); }
    catch(e) { return String(value); }
  };
  const city = decodeGeo(req.headers['x-vercel-ip-city']);
  const region = decodeGeo(req.headers['x-vercel-ip-country-region']);
  const ua = req.headers['user-agent'] || '';
  const { browser, os, device } = parseUA(ua);
  const countryName = COUNTRY_NAMES[country] || country || 'Desconhecido';
  const now = Math.floor(Date.now() / 1000);
  const location = [countryName, region, city].filter(Boolean).join(', ');

  const accessDetails = [
    '<:web:1552114517402460350> **IP**',
    ip,
    '',
    '<:website:1552114526466605106> **País / Cidade**',
    location,
    '',
    '<:folder:1552114343376846858> **Navegador**',
    browser,
    '',
    '<:save:1552115261958791258> **Sistema**',
    os,
    '',
    '<:bot:1552114339417297027> **Dispositivo**',
    device.split(' ').slice(1).join(' ') || device,
    '',
    '<:information:1552114347562500128> **Horário**',
    `<t:${now}:F>`,
  ].join(String.fromCharCode(10));

  const components = [{
    type: 17,
    components: [
      { type: 10, content: '<:warn:1552114519860576357> **Novo Acesso ao Site**' },
      { type: 10, content: accessDetails },
    ],
  }];

  try {
    const webhookUrl = new URL(WEBHOOK);
    webhookUrl.searchParams.set('with_components', 'true');
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flags: 1 << 15, components }),
    });
    return res.status(200).json({ ok: true });
  } catch(e) {
    return res.status(500).json({ ok: false });
  }
}
