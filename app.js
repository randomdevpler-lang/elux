const $=id=>document.getElementById(id);
const DB_NAME='EluxVault', STORE='ipaFiles', KEY='elux-library-v2';
let apps=JSON.parse(localStorage.getItem(KEY)||'[]');
let db;
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id'})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function storeFile(record,file){try{db=db||await openDB();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({...record,file});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}catch(e){console.warn('File storage unavailable',e);throw e}}
async function deleteFile(id){try{db=db||await openDB();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}catch(e){console.warn(e)}}
function save(){localStorage.setItem(KEY,JSON.stringify(apps));render()}
let toastTimer;
function toast(message){const t=$('toast');t.textContent=message;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2500)}
function page(name){document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden'));$(name+'Page').classList.remove('hidden');document.querySelectorAll('.nav-tab').forEach(t=>t.classList.toggle('active',t.dataset.page===name));window.scrollTo({top:0,behavior:'smooth'})}
document.querySelectorAll('.nav-tab').forEach(t=>t.addEventListener('click',()=>page(t.dataset.page)));
$('settingsBtn').onclick=()=>{document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden'));$('settingsPage').classList.remove('hidden');document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));window.scrollTo({top:0,behavior:'smooth'})};
$('exploreBtn').onclick=()=>page('library');$('goLibrary').onclick=()=>page('library');$('goDownloads').onclick=()=>page('downloads');
['importHero','importCard','importLibrary','importEmpty'].forEach(id=>$(id).onclick=()=>$('ipaInput').click());
$('ipaInput').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  if(!file.name.toLowerCase().endsWith('.ipa')){toast('Please choose an .ipa file.');e.target.value='';return}
  const record={id:crypto.randomUUID(),name:file.name.replace(/\.ipa$/i,''),fileName:file.name,size:file.size,added:new Date().toISOString()};
  try{await storeFile(record,file);apps.unshift(record);save();page('library');toast('IPA saved to your local Elux library.')}
  catch(err){toast('Could not save this file. Check available iPhone storage.')}
  e.target.value='';
});
$('appSearch').addEventListener('input',render);
function render(){
  $('count').textContent=apps.length;$('heroCount').textContent=apps.length;
  const query=$('appSearch').value.trim().toLowerCase();
  const filtered=apps.filter(a=>(a.name+' '+a.fileName).toLowerCase().includes(query));
  $('libraryEmpty').classList.toggle('hidden',apps.length>0);
  $('noMatches').classList.toggle('hidden',apps.length===0||filtered.length>0);
  $('appList').innerHTML='';
  filtered.forEach(app=>{
    const row=document.createElement('div');row.className='app-row';
    const icon=document.createElement('div');icon.className='app-icon';icon.textContent='▣';
    const info=document.createElement('div');info.className='app-info';
    const name=document.createElement('b');name.textContent=app.name;
    const meta=document.createElement('small');meta.textContent=app.fileName+' · '+formatSize(app.size);
    info.append(name,meta);
    const remove=document.createElement('button');remove.className='remove';remove.textContent='Remove';
    remove.onclick=async()=>{await deleteFile(app.id);apps=apps.filter(x=>x.id!==app.id);save();toast('Removed from Elux library.')};
    row.append(icon,info,remove);$('appList').append(row);
  });
}
function formatSize(n){if(!n)return 'Size unavailable';const units=['B','KB','MB','GB'];let i=0;while(n>=1024&&i<3){n/=1024;i++}return n.toFixed(i?1:0)+' '+units[i]}
if('serviceWorker'in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
render();
