export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { code, code_verifier } = req.body
  if (!code || !code_verifier) return res.status(400).json({ error: 'Missing params' })

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: 'https://artanes.vercel.app/callback',
      client_id: 'dd237293e7f943689b4e603238a19ef7',
      code_verifier
    })
  })
  const data = await response.json()
  return res.status(response.ok ? 200 : 400).json(data)
}
