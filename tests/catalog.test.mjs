import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {materialCounts,visibleRequirements,layerCells,materialList,searchWiki} from '../src/lib/blueprints.mjs';
const catalog=JSON.parse(readFileSync(new URL('../src/data/catalog.json',import.meta.url)));
const assets=JSON.parse(readFileSync(new URL('../src/data/minecraft-assets.json',import.meta.url)));
const articles=JSON.parse(readFileSync(new URL('../content/articles.json',import.meta.url)));
const extractor=catalog.blueprints.find(b=>b.id==='extractor-basic');
test('all real station tiers and warehouse are present with unique required coordinates',()=>{
 assert.equal(catalog.elements.length,16);assert.equal(catalog.plants.length,58);assert.equal(catalog.plants.flatMap(p=>p.profiles).length,62);assert.equal(catalog.blueprints.length,16);
 assert.equal(new Set(catalog.blueprints.map(b=>b.id)).size,16);
 for(const b of catalog.blueprints){assert.equal(new Set(b.requirements.map(r=>`${r.x},${r.y},${r.z}`)).size,b.requirements.length);if(b.type==='WAREHOUSE'){assert.equal(b.requirements.length,15);}else{assert.equal(b.height,1+Math.max(...b.requirements.map(r=>r.y)));assert.deepEqual(b.panel,{x:0,y:1,z:1});}}
});
test('extractor column has two green glass blocks and forward-facing dropper/barrel',()=>{
 const counts=materialCounts(extractor.requirements);assert.equal(extractor.height,5);assert.equal(counts.find(r=>r.material==='LIME_STAINED_GLASS').count,2);
 assert.deepEqual(extractor.input,{x:0,y:1,z:-1});assert.deepEqual(extractor.output,{x:-1,y:1,z:1});assert.equal(extractor.requirements.filter(r=>r.facing==='FORWARD').length,2);
});
test('layer selection and cumulative view preserve exact blocks',()=>{
 assert.equal(materialCounts(visibleRequirements(extractor,'0')).reduce((s,r)=>s+r.count,0),9);
 assert.equal(materialCounts(visibleRequirements(extractor,'1')).reduce((s,r)=>s+r.count,0),7);
 assert.equal(materialCounts(visibleRequirements(extractor,'2')).reduce((s,r)=>s+r.count,0),1);
 assert.equal(materialCounts(visibleRequirements(extractor,'1',true)).reduce((s,r)=>s+r.count,0),16);
});
test('unspecified warehouse cells differ from required station air',()=>{
 const hub=catalog.blueprints.find(b=>b.type==='WAREHOUSE');assert.equal(layerCells(hub,2).flat().filter(r=>r.material===null).length,8);assert.equal(layerCells(extractor,2).flat().filter(r=>r.material==='AIR').length,8);assert.equal(layerCells(extractor,2).flat().filter(r=>r.material===null).length,0);
 const sci=catalog.blueprints.find(b=>b.id==='extractor-scientific');assert.equal(layerCells(sci,0).length,5);assert.equal(layerCells(sci,0)[0].length,7);
});
test('all rendered block geometry and original textures exist and match checksums',()=>{
 for(const b of catalog.blueprints)for(const r of b.requirements)if(r.material!=='AIR'){assert.ok(assets.models[r.material]?.some(m=>m.elements.length),r.material);for(const model of assets.models[r.material])for(const e of model.elements)for(const face of Object.values(e.faces))assert.ok(assets.textures[face.texture],face.texture);}
 for(const a of Object.values(assets.textures)){const path=new URL('../public/'+a.url,import.meta.url);assert.ok(existsSync(path),a.url);assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),a.sha256);}
});
test('partial workstation blocks use actual geometry rather than unit cubes',()=>{
 assert.ok(assets.models.CAULDRON[0].elements.length>5);assert.ok(assets.models.HOPPER[0].elements.length>1);assert.ok(assets.models.DECORATED_POT[0].elements.length>1);assert.ok(assets.models.LECTERN[0].elements.some(e=>e.rotation));assert.equal(assets.models.ENCHANTING_TABLE[0].elements[0].to[1],12);
});
test('reference masses, codes and regional biome names are valid',()=>{
 const codes=new Set(catalog.elements.map(e=>e.code));for(const p of catalog.plants){assert.ok(catalog.materials[p.material]);for(const values of [p.base,...p.profiles.map(r=>r.bonus)])for(const [code,mass] of Object.entries(values)){assert.ok(codes.has(code));assert.ok(Number.isSafeInteger(mass)&&mass>0);}for(const r of p.profiles)for(const biome of r.biomes)assert.ok(catalog.biomes[biome]);}
});
test('all detailed articles and tables have complete sections',()=>{
 assert.equal(articles.length,17);assert.equal(new Set(articles.map(a=>a.id)).size,17);for(const a of articles){assert.ok(a.title&&a.description&&a.sections.length>=4);for(const s of a.sections){assert.ok(s.heading);assert.ok(s.paragraphs?.length||s.bullets?.length||s.table);if(s.table)for(const row of s.table.rows)assert.equal(row.length,s.table.headers.length);}}
});
test('Russian search reaches elements, sources, biome profiles and commands',()=>{
 assert.ok(searchWiki('Аэрит',articles,catalog).some(r=>r.href==='#/elements/AER'));
 assert.ok(searchWiki('роза',articles,catalog).some(r=>r.href==='#/plants/ROSE_BUSH'));
 assert.ok(searchWiki('пустыня',articles,catalog).some(r=>r.href.includes('/plants/')));
 assert.ok(searchWiki('/md tool',articles,catalog).some(r=>r.href==='#/guide/commands'));
 assert.equal(searchWiki('   ',articles,catalog).length,0);
});
test('copyable list reflects selected layer and Russian names without air',()=>{
 const text=materialList(extractor,catalog.materials,'2');assert.ok(text.includes('Слой 3'));assert.ok(text.includes('Лаймовое стекло × 1'));assert.ok(!text.includes('Воздух'));assert.ok(!text.includes('Печь'));
});

test('special block entities keep native pot lip and visible static enchanting book',()=>{
 const pot=assets.models.DECORATED_POT[0].elements;assert.ok(pot.length>=3);const lip=pot[2];assert.equal(lip.rotation.angle,180);assert.deepEqual(lip.rotation.origin,[0,18.5,8]);assert.ok(Math.abs(37-lip.to[1]-15.8)<1e-9);
 const table=assets.models.ENCHANTING_TABLE;assert.equal(table.length,2);assert.equal(table[1].elements.length,7);assert.equal(table[1].z,80);assert.deepEqual(table[1].offset,[0,5.6,0]);
 assert.ok(assets.textures['entity/enchanting_table_book']);
});
