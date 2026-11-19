import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import assets from '../data/minecraft-assets.json';
import {visibleRequirements} from './blueprints.mjs';

const deg=Math.PI/180;
const faceVertices={
 south:([a,b,c],[d,e,f])=>[[a,e,f],[a,b,f],[d,b,f],[d,e,f]],
 north:([a,b,c],[d,e,f])=>[[d,e,c],[d,b,c],[a,b,c],[a,e,c]],
 east:([a,b,c],[d,e,f])=>[[d,e,f],[d,b,f],[d,b,c],[d,e,c]],
 west:([a,b,c],[d,e,f])=>[[a,e,c],[a,b,c],[a,b,f],[a,e,f]],
 up:([a,b,c],[d,e,f])=>[[a,e,c],[a,e,f],[d,e,f],[d,e,c]],
 down:([a,b,c],[d,e,f])=>[[a,b,f],[a,b,c],[d,b,c],[d,b,f]]
};
function defaultUV(direction,from,to){
 const [a,b,c]=from,[d,e,f]=to;
 return ({down:[a,16-f,d,16-c],up:[a,c,d,f],north:[16-d,16-e,16-a,16-b],south:[a,16-e,d,16-b],west:[c,16-e,f,16-b],east:[16-f,16-e,16-c,16-b]})[direction];
}
export function createMinecraftScene(container,{onSelect,onReady,onError}) {
 let disposed=false, frame=0, current=null, settings=null, geometries=[], meshes=[];
 const scene=new THREE.Scene();scene.background=new THREE.Color('#171e1a');
 const camera=new THREE.PerspectiveCamera(35,1,.1,100);camera.position.set(7,6,10);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor('#171e1a');container.appendChild(renderer.domElement);
 renderer.domElement.setAttribute('aria-label','Интерактивная трёхмерная схема. Вращайте перетаскиванием, меняйте масштаб колесом. Для выбора блока нажмите на него.');
 renderer.domElement.setAttribute('role','img');
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.09;controls.minDistance=3;controls.maxDistance=26;controls.maxPolarAngle=Math.PI*.86;controls.target.set(0,1.4,0);
 scene.add(new THREE.HemisphereLight(0xffffff,0x566559,2.4));
 const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(7,12,9);scene.add(light);
 const group=new THREE.Group();scene.add(group);
 const grid=new THREE.GridHelper(18,18,0x364b3b,0x27352c);grid.position.y=-.51;scene.add(grid);
 const materials=new Map(),textures=new Map(),loader=new THREE.TextureLoader();
 function getMaterial(name,glass=false){
  const key=name+(glass?':glass':'');if(materials.has(key))return materials.get(key);
  let texture=textures.get(name);
  if(!texture){const a=assets.textures[name]; texture=loader.load(import.meta.env.BASE_URL+a.url,()=>{if(disposed){texture.dispose();return;}},undefined,()=>{if(!disposed)onError?.('Не удалось загрузить текстуры. Проверьте файлы сайта.');});texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;
   const ratio=a.width/a.height;if(ratio<1){texture.repeat.y=ratio;texture.offset.y=1-ratio;}textures.set(name,texture);
  }
  const material=new THREE.MeshLambertMaterial({map:texture,side:THREE.DoubleSide,alphaTest:glass?.03:.25,transparent:glass,opacity:glass?.52:1,depthWrite:!glass});materials.set(key,material);return material;
 }
 function makeBlock(req){
  const block=new THREE.Group();block.userData.requirement=req;
  for(const model of assets.models[req.material]||[]){
   const modelGroup=new THREE.Group();block.add(modelGroup);
   for(const element of model.elements){
    const elementGroup=new THREE.Group();modelGroup.add(elementGroup);
    const from=element.from.map(v=>v/16-.5),to=element.to.map(v=>v/16-.5);
    for(const [direction,face] of Object.entries(element.faces)){
     const geometry=new THREE.BufferGeometry();const vertices=faceVertices[direction](from,to).flat();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex([0,1,2,0,2,3]);
     const [u1,v1,u2,v2]=face.uv||defaultUV(direction,element.from,element.to);let uv=[[u1/16,1-v1/16],[u1/16,1-v2/16],[u2/16,1-v2/16],[u2/16,1-v1/16]];
     const turns=(face.rotation||0)/90;if(turns)uv=uv.map((_,i)=>uv[(i+turns)%4]);geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv.flat(),2));geometry.computeVertexNormals();geometries.push(geometry);
     const mesh=new THREE.Mesh(geometry,getMaterial(face.texture,req.material.includes('GLASS')));mesh.userData.requirement=req;elementGroup.add(mesh);meshes.push(mesh);
    }
    if(element.rotation){const r=element.rotation,origin=new THREE.Vector3(...r.origin.map(v=>v/16-.5));for(const child of elementGroup.children)child.position.sub(origin);elementGroup.position.copy(origin);elementGroup.rotation[r.axis]=r.angle*deg;
     if(r.rescale){const scale=1/Math.cos(r.angle*deg);for(const axis of ['x','y','z'])if(axis!==r.axis)elementGroup.scale[axis]=scale;}
    }
   }
   modelGroup.rotation.x=(model.x||0)*deg;modelGroup.rotation.y=-(model.y||0)*deg;modelGroup.rotation.z=(model.z||0)*deg;
   modelGroup.position.set(...(model.offset||[0,0,0]).map(v=>v/16));
   // The exported barrel/dropper model points south for required forward faces.
   if(req.material==='BARREL' && req.facing!=='FORWARD')modelGroup.rotation.set(0,0,0);
  }
  block.position.set(req.x,req.y,req.z);return block;
 }
 const highlight=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.025,1.025,1.025)),new THREE.LineBasicMaterial({color:0xc4ee87}));highlight.visible=false;scene.add(highlight);
 const arrow=new THREE.ArrowHelper(new THREE.Vector3(0,0,1),new THREE.Vector3(0,-.45,2),1.4,0xc4ee87,.3,.2);scene.add(arrow);
 let id='';
 function resetCamera(view='iso'){
  if(!current)return;const bounds=new THREE.Box3().setFromObject(group),centre=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());const radius=Math.max(size.x,size.y,size.z,3);
  controls.target.copy(centre);const distance=radius*1.42/Math.min(1,camera.aspect);
  if(view==='top')camera.position.copy(centre).add(new THREE.Vector3(0,distance*1.5,.01));
  else if(view==='front')camera.position.copy(centre).add(new THREE.Vector3(0,.1,distance*1.6));
  else camera.position.copy(centre).add(new THREE.Vector3(distance*.85,distance*.72,distance*1.15));
  camera.updateProjectionMatrix();controls.update();
 }
 function update(blueprint,options){
  const previousExploded=settings?.exploded,previousLayer=settings?.layer,previousCumulative=settings?.cumulative;current=blueprint;settings=options;
  for(const geometry of geometries)geometry.dispose();geometries=[];meshes=[];group.clear();
  const requirements=visibleRequirements(blueprint,options.layer,options.cumulative);
  for(const req of requirements){if(req.material==='AIR')continue;const block=makeBlock(req);if(options.exploded)block.position.y+=req.y*1.15;group.add(block);}
  arrow.position.z=Math.max(...blueprint.requirements.map(r=>r.z))+1;arrow.position.x=blueprint.panel?.x||0;
  if(id!==blueprint.id){id=blueprint.id;resetCamera();}else if(options.exploded!==previousExploded||options.layer!==previousLayer||options.cumulative!==previousCumulative)resetCamera();
  highlight.visible=false;renderer.domElement.dataset.blueprint=blueprint.id;renderer.domElement.dataset.visibleBlocks=String(group.children.length);onReady?.(group.children.length);
 }
 function select(req){
  if(!req){highlight.visible=false;return;}
  highlight.position.set(req.x,req.y+(settings?.exploded?req.y*1.15:0),req.z);highlight.visible=true;
 }
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=null;
 function pointerDown(e){down={x:e.clientX,y:e.clientY};}
 function pointerUp(e){
  if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)return;down=null;
  const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects(meshes,false)[0];const req=hit?.object.userData.requirement||null;select(req);onSelect?.(req);
 }
 renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);
 function resize(){const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}
 const observer=new ResizeObserver(resize);observer.observe(container);resize();
 function animate(){if(disposed)return;controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(animate);}animate();
 return {update,view:resetCamera,select,destroy(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();for(const g of geometries)g.dispose();for(const t of textures.values())t.dispose();for(const m of materials.values())m.dispose();highlight.geometry.dispose();highlight.material.dispose();arrow.line.geometry.dispose();arrow.line.material.dispose();arrow.cone.geometry.dispose();arrow.cone.material.dispose();grid.geometry.dispose();grid.material.dispose();renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}};
}
