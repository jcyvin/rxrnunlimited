// Client-side stories feature using localStorage
document.addEventListener('DOMContentLoaded', ()=>{
  const form = document.getElementById('story-form');
  const list = document.getElementById('stories-list');
  const clearBtn = document.getElementById('clear-stories');

  function readStories(){
    try{const raw = localStorage.getItem('rxrn_stories'); return raw?JSON.parse(raw):[] }catch(e){return[]}
  }
  function writeStories(arr){ localStorage.setItem('rxrn_stories', JSON.stringify(arr)) }

  function render(){
    const stories = readStories();
    list.innerHTML = '';
    if(stories.length===0){
      list.innerHTML = '<p class="muted">No stories yet — be the first to share!</p>';
      return;
    }
    stories.slice().reverse().forEach(s=>{
      const el = document.createElement('article'); el.className='story';
      el.innerHTML = `<div class="meta"><strong>${escapeHtml(s.name)}</strong> — ${escapeHtml(s.title)}${s.metrics?` · <em>${escapeHtml(s.metrics)}</em>`:''}</div><p>${escapeHtml(s.body)}</p><div style="margin-top:.5rem;text-align:right"><button data-id="${s.id}" class="btn btn-ghost delete">Delete</button></div>`;
      list.appendChild(el);
    })
    // attach delete handlers
    list.querySelectorAll('.delete').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id = btn.getAttribute('data-id');
        const next = readStories().filter(x=>x.id!==id); writeStories(next); render();
      })
    })
  }

  form.addEventListener('submit', e=>{
    e.preventDefault();
    const fd = new FormData(form);
    const story = { id: String(Date.now()), name: fd.get('name')||'Anonymous', title: fd.get('title')||'', body: fd.get('body')||'', metrics: fd.get('metrics')||'', created: new Date().toISOString() };
    const curr = readStories(); curr.push(story); writeStories(curr); form.reset(); render();
  })

  clearBtn.addEventListener('click', ()=>{ if(confirm('Clear all stories from local browser storage?')){ localStorage.removeItem('rxrn_stories'); render(); } })

  // Seed with one example if empty
  if(readStories().length===0){
    writeStories([{id:'seed-1',name:'Alex Morgan',title:'Lost 7% body fat',body:'After 10 weeks I saw great changes in energy and body composition.',metrics:'-7% body fat, +8% strength',created:new Date().toISOString()}])
  }
  render();
});

function escapeHtml(str){
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')
}
