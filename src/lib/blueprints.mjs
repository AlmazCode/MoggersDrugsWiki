export const normalizeSearch = value => value.toLocaleLowerCase('ru').replace(/ё/g,'е');
export const plantSearchText = plant => `${plant.name} ${plant.material} ${({'ROSE_BUSH':'роза розы','ALLIUM':'аллий','LILY_OF_THE_VALLEY':'ландыш'})[plant.material]||''}`;
export function visibleRequirements(blueprint, layer = 'all', cumulative = false) {
  return blueprint.requirements.filter(r => layer === 'all' || (cumulative ? r.y <= Number(layer) : r.y === Number(layer)));
}
export function materialCounts(requirements) {
  const counts = new Map();
  for (const r of requirements) if (r.material !== 'AIR') counts.set(r.material, (counts.get(r.material) || 0) + 1);
  return [...counts].map(([material, count]) => ({material, count})).sort((a,b) => b.count-a.count || a.material.localeCompare(b.material));
}
export function materialList(blueprint, dictionary, layer = 'all', cumulative = false) {
  const rows = materialCounts(visibleRequirements(blueprint, layer, cumulative));
  return `${blueprint.name}\n${blueprint.width} × ${blueprint.height} × ${blueprint.depth}\n${layer === 'all' ? 'Все слои' : `Слой ${Number(layer)+1}${cumulative?' и нижние':''}`}\n\n${rows.map(r=>`${dictionary[r.material] || r.material} × ${r.count}`).join('\n')}`;
}
export function layerCells(blueprint, layer) {
  const minX = Math.min(...blueprint.requirements.map(r=>r.x));
  const maxX = Math.max(...blueprint.requirements.map(r=>r.x));
  const minZ = Math.min(...blueprint.requirements.map(r=>r.z));
  const maxZ = Math.max(...blueprint.requirements.map(r=>r.z));
  const index = new Map(blueprint.requirements.filter(r=>r.y===layer).map(r=>[`${r.x},${r.z}`,r]));
  const rows=[];
  for (let z=minZ;z<=maxZ;z++) { const cells=[]; for(let x=minX;x<=maxX;x++) cells.push(index.get(`${x},${z}`)||{x,y:layer,z,material:null}); rows.push(cells); }
  return rows;
}
export function searchWiki(query, articles, catalog) {
  const q=normalizeSearch(query.trim()); if(!q)return [];
  const entries=[
    ...articles.map(a=>({title:a.title,description:a.description,href:`#/guide/${a.id}`,text:[a.title,a.description,...(a.intro||[]),...a.sections.flatMap(s=>[s.heading,s.note||'',...s.paragraphs||[],...s.bullets||[],...(s.table?.rows||[]).flat()])].join(' ')})),
    ...catalog.elements.map(e=>({title:e.name,description:`${e.code} · элемент`,href:`#/elements/${e.code}`,text:`${e.name} ${e.code} ${e.family}`})),
    ...catalog.plants.map(p=>({title:p.name,description:'Растения и биомы',href:`#/plants/${p.material}`,text:`${plantSearchText(p)} ${Object.keys(p.base).join(' ')} ${p.profiles.flatMap(r=>[...r.biomes.map(b=>catalog.biomes?.[b]||b),...r.biomes,...Object.keys(r.bonus)]).join(' ')}`})),
    ...catalog.blueprints.map(b=>({title:b.name,description:`${b.width} × ${b.height} × ${b.depth}`,href:`#/blueprints/${b.id}`,text:`${b.name} ${b.id} ${b.type} ${b.tier}`}))
  ];
  return entries.filter(e=>normalizeSearch(e.text).includes(q)).sort((a,b)=>Number(normalizeSearch(b.title).includes(q))-Number(normalizeSearch(a.title).includes(q))).slice(0,25);
}
