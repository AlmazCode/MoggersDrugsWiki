import React,{useState,useEffect,useRef} from 'react';
import {Box,BookOpen,FlaskConical,Leaf,ChartNoAxesColumn,Network,Terminal,Search,Menu,X,Settings2,ShieldCheck,Sparkles,Package,SlidersHorizontal,Layers,HelpCircle,ArrowUpRight,ChevronDown,MessagesSquare} from 'lucide-react';
import catalog from './data/catalog.json';
import articles from '../content/articles.json';
import BlueprintViewer from './components/BlueprintViewer.jsx';
import Article from './components/Article.jsx';
import {Elements,Plants} from './components/Reference.jsx';
import SearchDialog from './components/SearchDialog.jsx';
const groups=[
 {label:'Начало',items:[['guide/start','С чего начать',BookOpen],['guide/first-experiment','Первый опыт',FlaskConical],['guide/workflow','Процесс производства',Settings2],['blueprints','Чертежи',Box]]},
 {label:'Справочник',items:[['elements','Элементы',FlaskConical],['plants','Растения и биомы',Leaf]]},
 {label:'Производство',items:[['guide/extraction','Извлечение',Layers],['guide/assembly','Сборка',Box],['guide/reactions','Реакции',FlaskConical],['guide/stabilization','Стабилизация',SlidersHorizontal],['guide/separation','Разделение',Layers],['guide/packaging','Упаковка',Package]]},
 {label:'Лаборатория',items:[['guide/quality','Качество',Sparkles],['guide/effects','Эффекты и сочетания',FlaskConical],['guide/research','Исследования',ChartNoAxesColumn],['guide/formulas','Формулы',Network],['guide/warehouse','Общий склад',Package],['guide/permissions','Права доступа',ShieldCheck],['guide/commands','Команды',Terminal],['guide/troubleshooting','Помощь',HelpCircle]]}
];
function readRoute(){const hash=window.location.hash.slice(1).replace(/^\//,'');return hash||'blueprints/extractor-basic';}
export default function App(){
 const [route,setRoute]=useState(readRoute),[navOpen,setNavOpen]=useState(false),[searchOpen,setSearchOpen]=useState(false),[mobile,setMobile]=useState(()=>window.matchMedia('(max-width:760px)').matches);
 const navRef=useRef(null),menuRef=useRef(null);
 useEffect(()=>{const query=window.matchMedia('(max-width:760px)');const change=()=>{setMobile(query.matches);if(!query.matches)setNavOpen(false);};query.addEventListener('change',change);return()=>query.removeEventListener('change',change);},[]);
 useEffect(()=>{if(mobile&&navOpen)navRef.current?.querySelector('.mobile-nav-close')?.focus();else if(mobile&&document.activeElement?.closest('.sidebar'))menuRef.current?.focus();},[mobile,navOpen]);
 useEffect(()=>{const change=()=>{setRoute(readRoute());setNavOpen(false);window.scrollTo({top:0,behavior:'instant'});};window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change);},[]);
 useEffect(()=>{function key(e){if((e.key==='k'&&(e.ctrlKey||e.metaKey))||(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))){e.preventDefault();setSearchOpen(true);}if(e.key==='Escape'){setNavOpen(false);if(mobile&&navOpen)menuRef.current?.focus();}if(e.key==='Tab'&&mobile&&navOpen){const nodes=[...navRef.current.querySelectorAll('a[href],button,summary')].filter(node=>node.checkVisibility());const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[mobile,navOpen]);
 useEffect(()=>{const before=document.body.style.overflow;if(navOpen)document.body.style.overflow='hidden';return()=>{document.body.style.overflow=before;};},[navOpen]);
 const [page,id]=route.split('/');const article=articles.find(a=>a.id===id);const title=page==='blueprints'?'Чертежи':page==='elements'?(catalog.elements.find(e=>e.code===id)?.name||'Элементы'):page==='plants'?(catalog.plants.find(p=>p.material===id)?.name||'Растения и биомы'):(article?.title||'Вики');
 useEffect(()=>{document.title=`${title} — MoggersDrugs`;},[title]);
 const active=(path)=>path==='blueprints'?page==='blueprints':path===route||(path===page);
 return <><a href="#main" className="skip-link" onClick={e=>{e.preventDefault();document.getElementById('main').focus();}}>Перейти к содержимому</a>{navOpen&&<button className="nav-overlay" aria-label="Закрыть меню" onClick={()=>setNavOpen(false)}/>}
  <aside ref={navRef} inert={mobile&&!navOpen?true:undefined} role={mobile?'dialog':undefined} aria-label="Навигация по вики" aria-modal={mobile&&navOpen?true:undefined} className={`sidebar ${navOpen?'open':''}`}><a href="#/guide/start" className="brand"><Box size={42} strokeWidth={1.7}/><div><strong>MoggersDrugs</strong><span>Вики для игроков</span></div></a><button className="mobile-nav-close" onClick={()=>setNavOpen(false)} aria-label="Закрыть меню"><X size={20}/></button><nav className="site-nav">{groups.map((group,index)=>{
    const links=group.items.map(([path,label,Icon])=><a key={path} className={active(path)?'active':''} href={`#/${path}`} aria-current={active(path)?'page':undefined}><Icon size={17}/>{label}</a>);
    if(index<2)return <div className="nav-group" key={group.label}><div className="nav-heading">{group.label}</div>{links}</div>;
    return <details key={group.label} className="nav-group nav-fold" open={group.items.some(([path])=>active(path))}><summary>{group.label}<ChevronDown size={16}/></summary>{links}</details>;
   })}</nav><div className="sidebar-footer"><a className="community-link" href="https://discord.gg/Kq8TEbw9vn" target="_blank" rel="noopener noreferrer"><MessagesSquare size={19}/>Discord сервера<ArrowUpRight size={16}/></a></div></aside>
  <div className="main-shell" inert={mobile&&navOpen?true:undefined}><header className="topbar"><button ref={menuRef} className="mobile-menu" aria-label="Открыть меню" aria-expanded={navOpen} onClick={()=>setNavOpen(!navOpen)}><Menu size={22}/></button><div className="breadcrumbs"><a href="#/guide/start">Вики</a><span>/</span><span>{title}</span></div><button aria-label="Поиск по вики" className="search-trigger" onClick={()=>setSearchOpen(true)}><Search size={17}/><span>Поиск по вики</span><kbd>{navigator.platform.includes('Mac')?'⌘ K':'Ctrl K'}</kbd></button></header><main id="main" tabIndex="-1" className="main-content">{page==='blueprints'?<BlueprintViewer id={id}/>:page==='guide'?<Article article={article}/>:page==='elements'?<Elements key={id||'all'} code={id}/>:page==='plants'?<Plants key={id||'all'} material={id}/>:<section className="empty-state"><h1>Страница не найдена</h1><a href="#/guide/start">Открыть вики</a></section>}<footer className="page-footer"><span>MoggersDrugs разработан специально для приватного сервера Moggers. Плагин недоступен для скачивания.</span><a href="./credits.html" target="_blank" rel="noopener noreferrer">Текстуры и лицензии <ArrowUpRight size={13}/></a></footer></main></div>
  {searchOpen&&<SearchDialog articles={articles} catalog={catalog} onClose={()=>setSearchOpen(false)}/>}
 </>;
}
