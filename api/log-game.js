const WEBHOOK = process.env.DISCORD_LOG_WEBHOOK;

const COUNTRY_NAMES = {
  BR:'Brasil',PT:'Portugal',US:'Estados Unidos',MX:'México',AR:'Argentina',
  CO:'Colômbia',PE:'Peru',CL:'Chile',UY:'Uruguai',BO:'Bolívia',
  RU:'Rússia',BY:'Bielorrússia',UA:'Ucrânia',KZ:'Cazaquistão',
  DE:'Alemanha',FR:'França',GB:'Reino Unido',ES:'Espanha',IT:'Itália',
  CA:'Canadá',AU:'Austrália',JP:'Japão',KR:'Coreia do Sul',CN:'China',IN:'Índia',
  TR:'Turquia',ID:'Indonésia',PH:'Filipinas',VN:'Vietnã',TH:'Tailândia',
};

function flag(code) {
  if (!code || code.length !== 2) return '🌍';
  try { return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)); }
  catch(e) { return '🌍'; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  let body = {};
  try { body = req.body || {}; } catch(e) {}

  const { gameName, gameUrl, username } = body;
  const ip = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'N/A').split(',')[0].trim();
  const country = (req.headers['x-vercel-ip-country'] || '').toUpperCase();
  const city = req.headers['x-vercel-ip-city'] || '';
  const countryName = COUNTRY_NAMES[country] || country || 'Desconhecido';
  const emoji = flag(country);
  const location = city ? `${city}, ${countryName}` : countryName;
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    embeds: [{
      title: '🎮  Jogo Acessado',
      color: 0x8B5CF6,
      fields: [
        { name: '🎯  Jogo', value: gameName ? `**${gameName}**` : 'N/A', inline: false },
        { name: '🔗  URL', value: gameUrl ? `[Abrir jogo](${gameUrl})` : 'N/A', inline: false },
        { name: '👤  Usuário', value: username ? `@${username}` : 'N/A', inline: true },
        { name: '🌍  IP', value: `\`${ip}\``, inline: true },
        { name: `${emoji}  País`, value: location, inline: true },
        { name: '🕐  Horário', value: `<t:${now}:F>`, inline: false },
      ],
      footer: { text: 'Roblox Condo • Logs de Jogos' },
      timestamp: new Date().toISOString(),
    }],
  };

  try {
    await fetch(WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.status(200).json({ ok: true });
  } catch(e) {
    return res.status(500).json({ ok: false });
  }
}
