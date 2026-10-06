export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const response = await fetch('https://discord.com/api/v10/invites/2kSQztRfvu?with_counts=true');
    if (!response.ok) return res.status(response.status).json({ error: 'Discord API request failed' });

    const data = await response.json();
    return res.status(200).json({
      name: data.profile?.name || data.guild?.name || 'Discord',
      memberCount: data.approximate_member_count ?? data.profile?.member_count ?? null,
      onlineCount: data.approximate_presence_count ?? data.profile?.online_count ?? null,
      inviteUrl: 'https://discord.gg/xskrFJ8QQc',
    });
  } catch (error) {
    return res.status(502).json({ error: 'Unable to fetch Discord statistics' });
  }
}
