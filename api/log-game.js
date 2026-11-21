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

async function fetchGameThumbnail(userId, username) {
  let resolvedId = Number(userId);
  if (!Number.isSafeInteger(resolvedId) || resolvedId <= 0) {
    const cleanUsername = String(username || '').replace(/^@/, '').trim();
    if (!cleanUsername) return null;
    try {
      const userResponse = await fetch('https://users.roblox.com/v1/usernames/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: [cleanUsername], excludeBannedUsers: false }),
      });
      if (!userResponse.ok) return null;
      const userData = await userResponse.json();
      resolvedId = Number(userData.data?.[0]?.id);
    } catch(e) {
      return null;
    }
  }
  if (!Number.isSafeInteger(resolvedId) || resolvedId <= 0) return null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${resolvedId}&size=420x420&format=Png&isCircular=false`
      );
      if (!response.ok) return null;
      const data = await response.json();
      const image = data.data?.[0];
      if (image?.imageUrl) return image.imageUrl;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 250));
    } catch(e) {
      if (attempt === 2) return null;
    }
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

  const { gameName, username, userId, gameNumber, gameIndex } = body;
  const rawGameNumber = gameNumber ?? gameIndex;
  const normalizedGameName = String(gameName || '').trim().toLowerCase();
  const mappedGame = {
    'fun combat': 1,
    'sex game': 2,
    'sword game': 3,
  }[normalizedGameName];
  const selectedGame = mappedGame ?? Number(String(rawGameNumber ?? '').split('/')[0]);
  const gameSlot = Number.isInteger(selectedGame) && selectedGame >= 1 && selectedGame <= 3
    ? String(selectedGame).padStart(2, '0')
    : '??';
  const cleanUsername = String(username || '').replace(/^@/, '').trim();
  const avatarUrl = await fetchGameThumbnail(userId, cleanUsername);
  const gameHeader = [
    '<:announcement:1552114337668141176> **Jogo Acessado**',
    '',
    '<:bot:1552114339417297027> **Jogo:**',
    `**${gameSlot}**${gameName ? ` — ${gameName}` : ''}`,
    '',
    '<:member:1552114515682787411> **Usuário:**',
    cleanUsername ? `@${cleanUsername}` : 'N/A',
  ].join(String.fromCharCode(10));
  const gameSection = avatarUrl
    ? {
        type: 9,
        components: [{ type: 10, content: gameHeader }],
        accessory: {
          type: 11,
          media: { url: avatarUrl },
          description: `Avatar de ${cleanUsername || 'usuário Roblox'}`,
        },
      }
    : { type: 10, content: gameHeader };
  const components = [{ type: 17, components: [gameSection] }];

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
