const $=id=>document.getElementById(id);
const KEY='elux-library-v1';
let apps=JSON.parse(localStorage.getItem(KEY)||'[]');
function save(){localStorage.setItem(KEY,JSON.stringify(apps));render()}
function toast(message){const t=$('toast');t.textContent=message;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2400)}
function page(name){
  document.querySelectorAll('.page').forEach(p=>p.classList.add('hidden'));
  $(name+'Page').classList.remove('hidden');
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.page===name));
}
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>page(t.dataset.page)));
$('settingsBtn').onclick=()=>{page('settings');document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'))};
['importHero','importCard','importLibrary','importEmpty'].forEach(id=>$(id).onclick=()=>$('ipaInput').click());
$('ipaInput').addEventListener('change',e=>{
  const file=e.target.files[0];if(!file)return;
  if(!file.name.toLowerCase().endsWith('.ipa')){toast('Please choose an .ipa file.');e.target.value='';return}
  apps.unshift({id:crypto.randomUUID(),name:file.name.replace(/\.ipa$/i,''),fileName:file.name,size:file.size,added:new Date().toISOString()});
  save();page('library');toast('Added to your Elux library.');
  e.target.value='';
});
function render(){
  $('count').textContent=apps.length;
  $('libraryEmpty').classList.toggle('hidden',apps.length>0);
  $('appList').innerHTML='';
  apps.forEach(app=>{
    const row=document.createElement('div');row.className='app-row';
    const icon=document.createElement('div');icon.className='app-icon';icon.textContent='▣';
    const info=document.createElement('div');info.className='app-info';
    const name=document.createElement('b');name.textContent=app.name;
    const meta=document.createElement('small');meta.textContent=app.fileName+' • '+formatSize(app.size);
    info.append(name,meta);
    const remove=document.createElement('button');remove.className='remove';remove.textContent='Remove';
    remove.onclick=()=>{apps=apps.filter(x=>x.id!==app.id);save();toast('Removed from library.')};
    row.append(icon,info,remove);$('appList').append(row);
  });
}
function formatSize(n){if(!n)return 'Size unavailable';const units=['B','KB','MB','GB'];let i=0;while(n>=1024&&i<3){n/=1024;i++}return n.toFixed(i?1:0)+' '+units[i]}
if('serviceWorker'in navigator && location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
render();
