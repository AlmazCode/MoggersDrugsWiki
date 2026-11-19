import React,{useEffect,useRef} from 'react';
import catalog from '../data/catalog.json';
export default function MiniBlueprint(){
 const container=useRef(null);
 useEffect(()=>{let scene=null,cancelled=false;import('../lib/minecraft-scene.js').then(({createMinecraftScene})=>{if(cancelled||!container.current)return;try{scene=createMinecraftScene(container.current,{});scene.update(catalog.blueprints.find(b=>b.id==='extractor-basic'),{layer:'all',exploded:false,cumulative:false});}catch{}});return()=>{cancelled=true;scene?.destroy();};},[]);
 return <div className="mini-blueprint" ref={container} aria-hidden="true"/>;
}
