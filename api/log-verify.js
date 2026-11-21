const WEBHOOK = process.env.DISCORD_VERIFY_WEBHOOK;

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

async function fetchThumbnail(userId) {
  // Try up to 3 times (Roblox thumbnail can return Pending on first call)
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`
      );
      const data = await r.json();
      const item = data?.data?.[0];
      if (item?.state === 'Completed' && item?.imageUrl) return item.imageUrl;
    } catch(e) {}
    // Wait 500ms between retries
    await new Promise(ok => setTimeout(ok, 500));
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  let body = {};
  try { body = req.body || {}; } catch(e) {}

  const { userId, username, days, created } = body;
  const ip      = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'N/A').split(',')[0].trim();
  const country = (req.headers['x-vercel-ip-country'] || '').toUpperCase();
  const city    = req.headers['x-vercel-ip-city'] || '';
  const countryName = COUNTRY_NAMES[country] || country || 'Desconhecido';
  const emoji   = flag(country);
  const region = req.headers['x-vercel-ip-country-region'] || '';
  const location = [countryName, region, city].filter(Boolean).join(', ');
  const now     = Math.floor(Date.now() / 1000);

  // Format creation date
  let createdFormatted = 'N/A';
  if (created) {
    try {
      createdFormatted = new Date(created).toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      });
    } catch(e) { createdFormatted = String(created); }
  }

  // Fetch avatar (with retry for Pending state)
  const avatarUrl = userId ? await fetchThumbnail(userId) : null;

  const embed = {
    title: '<:warn:1552114519860576357>  Conta Roblox Verificada',
    color: 0x22C55E,
    fields: [
      { name: '<:member:1552114515682787411> Username', value: `**@${username || 'N/A'}**`, inline: true },
      { name: '<:embed:1552114534615879700> Data de Criação', value: createdFormatted, inline: true },
      { name: '<:information:1552114347562500128> Dias da conta', value: `**${days || 0} dias**`, inline: true },
      { name: '<:web:1552114517402460350> IP', value: `\`${ip}\``, inline: true },
      { name: '<:website:1552114526466605106> País/Estado', value: location, inline: true },
      { name: '<:bot:1552114339417297027> Verificado em', value: `<t:${now}:F>`, inline: true },
    ],
    footer:    { text: 'Roblox Condo • Logs de Verificação' },
    timestamp: new Date().toISOString(),
  };

  // Only set thumbnail if we got a real URL
  if (avatarUrl) embed.thumbnail = { url: avatarUrl };

  try {
    await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        content: '',
        embeds: [embed] 
      }),
    });
    return res.status(200).json({ ok: true });
  } catch(e) {
    return res.status(500).json({ ok: false });
  }
}
