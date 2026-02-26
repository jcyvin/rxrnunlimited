const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Allow simple CORS for local development (caller from localhost:3000)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Allow setting credentials at runtime via a local POST (only for local development)
app.post('/set-credentials', (req, res) => {
  const { appId, appSecret } = req.body || {};
  if (!appId || !appSecret) return res.status(400).json({ error: 'missing appId or appSecret' });
  // store in environment for this process
  process.env.APP_ID = String(appId);
  process.env.APP_SECRET = String(appSecret);
  process.env.APP_TOKEN = `${process.env.APP_ID}|${process.env.APP_SECRET}`;
  console.log('Credentials set via /set-credentials; APP_TOKEN configured for this process.');
  return res.json({ ok: true });
});

// Provide a safe fetch implementation: prefer global fetch, fall back to node-fetch v2
let fetchFn = global.fetch;
if(!fetchFn){
  try{
    // node-fetch v2 is CommonJS-compatible
    fetchFn = require('node-fetch');
  }catch(e){
    console.error('node-fetch not installed. Install with `npm install node-fetch@2`');
  }
}

function extractUsername(profileUrl){
  try{
    const u = new URL(profileUrl);
    // facebook.com/<username> or facebook.com/profile.php?id=123
    if(u.pathname && u.pathname !== '/'){
      // strip leading /
      return u.pathname.replace(/^\//,'').replace(/\/.*/,'');
    }
    if(u.searchParams && u.searchParams.get('id')) return u.searchParams.get('id');
  }catch(e){
    // maybe it's already a username
    return profileUrl;
  }
  return profileUrl;
}

app.get('/latest', async (req, res) => {
  const profile = req.query.profile;
  if(!profile) return res.status(400).json({error:'missing profile parameter'});
  const token = process.env.APP_TOKEN;
  if(!token) return res.status(500).json({error:'APP_TOKEN not set in environment'});

  const username = extractUsername(profile);

  try{
    const url = `https://graph.facebook.com/v17.0/${encodeURIComponent(username)}/posts?fields=permalink_url,created_time&limit=10&access_token=${encodeURIComponent(token)}`;
    const r = await fetch(url);
    if(!r.ok){
      const txt = await r.text();
      return res.status(502).json({error:'graph_error','detail':txt});
    }
    const j = await r.json();
    if(j && Array.isArray(j.data) && j.data.length>0){
      // prefer the most recent with a permalink
      const found = j.data.find(p=>p.permalink_url) || j.data[0];
      return res.json({post_url: found.permalink_url, raw: found});
    }
    return res.status(404).json({error:'no_posts_found'});
  }catch(err){
    return res.status(500).json({error:'server_error', detail: String(err)});
  }
});

// Return recent posts (permalink_url, message, created_time)
app.get('/recent', async (req, res) => {
  const profile = req.query.profile;
  const limit = parseInt(req.query.limit, 10) || 5;
  if (!profile) return res.status(400).json({ error: 'missing profile parameter' });
  const token = process.env.APP_TOKEN;
  if (!token) return res.status(500).json({ error: 'APP_TOKEN not set in environment' });

  const username = extractUsername(profile);

  try {
    const url = `https://graph.facebook.com/v17.0/${encodeURIComponent(username)}/posts?fields=permalink_url,message,created_time&limit=${limit}&access_token=${encodeURIComponent(token)}`;
    if(!fetchFn) return res.status(500).json({ error: 'fetch_not_available', detail: 'node fetch not available on server' });
    const r = await fetchFn(url);
    if (!r.ok) {
      const txt = await r.text();
      return res.status(502).json({ error: 'graph_error', detail: txt });
    }
    const j = await r.json();
    if (j && Array.isArray(j.data)) {
      return res.json({ posts: j.data });
    }
    return res.status(404).json({ error: 'no_posts_found' });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', detail: String(err) });
  }
});

// Scrape public mobile Facebook page for possible post links (fallback when API token not available)
app.get('/scrape', async (req, res) => {
  const profile = req.query.profile;
  const limit = parseInt(req.query.limit,10) || 5;
  if(!profile) return res.status(400).json({ error: 'missing profile parameter' });
  if(!fetchFn) return res.status(500).json({ error: 'fetch_not_available', detail: 'Install node-fetch or use Node 18+' });

  try{
    // Use the mobile site which is simpler to parse
    let pageUrl = profile.replace('www.facebook.com','m.facebook.com');
    if(!/^https?:\/\//i.test(pageUrl)) pageUrl = 'https://m.facebook.com/' + profile.replace(/^\/*/,'');
    const r = await fetchFn(pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36' } });
    if(!r.ok){ const txt = await r.text(); return res.status(502).json({ error:'fetch_failed', detail: txt.slice(0,2000) }); }
    const html = await r.text();

    // Find candidate post links in the mobile HTML
    const linkRe = /href=\"([^\"]*(?:\/story.php|\/permalink.php|\/photos\/|\/posts\/|\/photo.php)[^\"]*)\"/gi;
    const matches = [];
    let m;
    while((m = linkRe.exec(html)) !== null){
      let href = m[1];
      // normalize
      if(href.startsWith('/')) href = 'https://www.facebook.com'+href;
      if(!matches.includes(href)) matches.push(href);
      if(matches.length>=limit) break;
    }

    // As a last resort, look for /story.php?story_fbid= or /posts/ patterns without href attr
    if(matches.length===0){
      const altRe = /(https?:\\\/\\\/www\.facebook\.com\\\/(?:profile.php\?id=|[^\/]++\/posts\/)[^"'\s]+)/g;
      const alt = [];
      let mm;
      while((mm = altRe.exec(html))!==null){ if(!alt.includes(mm[1])) alt.push(mm[1]); if(alt.length>=limit) break }
      alt.forEach(a=>matches.push(a));
    }

    if(matches.length===0) return res.status(404).json({ error:'no_links_found' });

    // Build simple post objects (url only). Optionally we could fetch each link to extract text, but keep light-weight.
    const posts = matches.slice(0,limit).map(u=>({ permalink_url: u }));
    return res.json({ posts });
  }catch(err){
    return res.status(500).json({ error:'scrape_error', detail: String(err) });
  }
});

app.listen(PORT, ()=>{
  console.log(`Local helper server listening on http://localhost:${PORT}`);
  console.log('Endpoint: GET /latest?profile=https://www.facebook.com/username');
});
