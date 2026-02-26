// Recent posts preview for a fixed profile (alvin.lim.180)
document.addEventListener('DOMContentLoaded', ()=>{
	const status = document.getElementById('recent-status');
	const list = document.getElementById('recent-posts-list');

	// credential inputs and save
	const appIdInput = document.getElementById('app-id');
	const appSecretInput = document.getElementById('app-secret');
	const saveCredsBtn = document.getElementById('save-creds');
	if(saveCredsBtn){
		saveCredsBtn.addEventListener('click', async ()=>{
			const appId = (appIdInput && appIdInput.value||'').trim();
			const appSecret = (appSecretInput && appSecretInput.value||'').trim();
			if(!appId || !appSecret){ alert('Enter both App ID and App Secret'); return }
			try{
				setStatus('Saving credentials...');
				const r = await fetch('http://localhost:3001/set-credentials',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({appId,appSecret})});
				if(!r.ok){ const t = await r.text(); setStatus('Failed to save credentials: '+t); return }
				setStatus('Credentials saved — fetching posts...');
				fetchRecent();
			}catch(err){ setStatus('Failed to save credentials: '+String(err)) }
		})
	}
	function setStatus(msg){ if(status) status.textContent = msg }

	async function fetchRecent(){
		const fixedProfile = 'https://www.facebook.com/profile.php?id=61588645477758';
		setStatus('Trying helper API (/recent)...');
		let used = false;
		try{
			const res = await fetch('http://localhost:3001/recent?profile='+encodeURIComponent(fixedProfile)+'&limit=5');
			if(res.ok){
				const data = await res.json();
				if(data && Array.isArray(data.posts) && data.posts.length>0){
					used = true;
					setStatus('');
					list.innerHTML = '';
					// Embed the first post using Facebook XFBML if available
					const first = data.posts[0];
					const firstUrl = first.permalink_url || fixedProfile;
					const fbContainer = document.createElement('div');
					fbContainer.className = 'fb-post';
					fbContainer.setAttribute('data-href', firstUrl);
					fbContainer.setAttribute('data-width', '500');
					list.appendChild(fbContainer);
					// parse if FB SDK loaded
					try{ if(window.FB && typeof FB.XFBML.parse === 'function'){ FB.XFBML.parse(); } }
					catch(e){ /* ignore */ }
					// Add remaining posts as links
					for(let i=1;i<data.posts.length;i++){
						const p = data.posts[i];
						const li = document.createElement('li');
						const time = p.created_time? new Date(p.created_time).toLocaleString() : '';
						const msg = p.message? (p.message.length>200? p.message.slice(0,200)+'…' : p.message) : '';
						li.innerHTML = `<a target="_blank" rel="noopener" href="${escapeHtml(p.permalink_url||fixedProfile)}">${escapeHtml(msg||p.permalink_url||'View post')}</a> <span class="muted small">${escapeHtml(time)}</span>`;
						list.appendChild(li);
					}
				}
			}
		}catch(err){
			// ignore and try scrape fallback
		}

		if(used) return;
		// fallback: try scraping endpoint
		setStatus('Falling back to scraper (/scrape)...');
		try{
			const r2 = await fetch('http://localhost:3001/scrape?profile='+encodeURIComponent(fixedProfile)+'&limit=5');
			if(!r2.ok){ throw new Error('scrape-unavailable') }
			const d2 = await r2.json();
			if(!d2 || !Array.isArray(d2.posts) || d2.posts.length===0){ setStatus('No posts found by scraper.'); return }
			setStatus(''); list.innerHTML = '';
			d2.posts.forEach(p=>{
				const li = document.createElement('li');
				li.innerHTML = `<a target="_blank" rel="noopener" href="${escapeHtml(p.permalink_url||fixedProfile)}">${escapeHtml(p.permalink_url||'View post')}</a>`;
				list.appendChild(li);
			})
		}catch(err){
			setStatus('Local helper not running or failed. Start it with `npm run server` or run with APP_TOKEN if using the API.');
			list.innerHTML = '';
		}
	}

	fetchRecent();
});

function escapeHtml(str){
	return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
}
