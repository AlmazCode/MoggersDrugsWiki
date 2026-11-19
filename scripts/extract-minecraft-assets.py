#!/usr/bin/env python3
"""Copy official client assets unchanged and resolve vanilla models for the wiki.
Usage: python3 scripts/extract-minecraft-assets.py ../.superpowers/minecraft-1.21.11-client.jar
No full client redistribution. The client SHA-1 must match minecraft-source.json.
"""
import hashlib,json,math,struct,sys,zipfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
source=json.loads((root/'scripts/minecraft-source.json').read_text())
client=Path(sys.argv[1]) if len(sys.argv)>1 else root.parent/'.superpowers/minecraft-1.21.11-client.jar'
assert hashlib.sha1(client.read_bytes()).hexdigest()==source['client']['sha1'], 'Client checksum mismatch'
z=zipfile.ZipFile(client); cache={}; textures={}; models={}; icons={}
assets=root/'public/assets/minecraft'; assets.mkdir(parents=True,exist_ok=True)
catalog=json.loads((root/'src/data/catalog.json').read_text())
def clean(name): return name.removeprefix('minecraft:')
def read(path): return json.loads(z.read('assets/minecraft/'+path))
def resolve(name):
 name=clean(name)
 if name in cache:return cache[name]
 raw=read('models/'+name+'.json'); parent=raw.get('parent','')
 result=resolve(parent).copy() if parent and not parent.startswith('builtin/') else {}
 result['textures']={**result.get('textures',{}),**raw.get('textures',{})}
 if 'elements' in raw:result['elements']=raw['elements']
 cache[name]=result;return result

def extract_texture(name):
 name=clean(name)
 if name in textures:return
 payload=z.read('assets/minecraft/textures/'+name+'.png');path=assets/(name+'.png');path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(payload)
 width,height=struct.unpack('>II',payload[16:24]); textures[name]={'url':'assets/minecraft/'+name+'.png','width':width,'height':height,'sha256':hashlib.sha256(payload).hexdigest()}

def bake(name):
 result=resolve(name);tx=result.get('textures',{})
 def tex(ref):
  seen=set()
  while ref.startswith('#'):
   if ref in seen: raise ValueError('Texture cycle '+ref)
   seen.add(ref);ref=tx[ref[1:]]
  extract_texture(ref);return clean(ref)
 elements=[]
 for e in result.get('elements',[]):
  item={**e,'faces':{direction:{**face,'texture':tex(face['texture'])} for direction,face in e.get('faces',{}).items()}}
  elements.append(item)
 return elements

def cube(a,b,texture):
 return {'from':a,'to':b,'faces':{d:{'texture':texture,'uv':[0,0,16,16]} for d in ['east','west','up','down','north','south']}}

# Verified against 1.21.11 DecoratedPotRenderer.createBaseLayer/createSidesLayer
# (official client hrs.a()/hrs.d()) and ModelPart.Cube atlas layout. Base uses a
# 32x32 atlas; side panels use a separate 16x16 atlas. UV values below are scaled
# into the block-model renderer's 0..16 coordinates, without cropping the atlas.
def pot():
 tx='entity/decorated_pot/decorated_pot_side';base='entity/decorated_pot/decorated_pot_base'
 extract_texture(tx);extract_texture(base)
 body=cube([1,0,1],[15,16,15],tx)
 for d in ['north','south','east','west']:body['faces'][d]['uv']=[1,0,15,16]
 # Source cap cube: texOffs(-14,13), size(14,0,14). Keep only each
 # outward cap to avoid coplanar faces with different atlas rectangles.
 body['faces']['up']={'texture':base,'uv':[7,13.5,14,6.5]}
 body['faces']['down']={'texture':base,'uv':[0,6.5,7,13.5]}
 def neck_box(position,size,offset,deformation):
  x,y,z=position;w,h,d=size;u,v=offset
  item=cube([x-deformation,y-deformation,z-deformation],
            [x+w+deformation,y+h+deformation,z+d+deformation],base)
  # ModelPart.Cube's six distinct unwrapped atlas rectangles. Side
  # rectangles reverse both axes to match block-model vertex ordering.
  rects={'down':[u+d,v,u+d+w,v+d],
         'up':[u+d+w,v+d,u+d+2*w,v],
         'west':[u+d,v+d+h,u,v+d],
         'north':[u+d+w,v+d+h,u+d,v+d],
         'east':[u+2*d+w,v+d+h,u+d+w,v+d],
         'south':[u+2*d+2*w,v+d+h,u+2*d+w,v+d]}
  for direction,rect in rects.items():item['faces'][direction]['uv']=[n/2 for n in rect]
  # Source PartPose.offsetAndRotation(0,37,16,PI,0,0). A 180-degree
  # rotation about (0,18.5,8) is the same transform p -> (x,37-y,16-z).
  item['rotation']={'origin':[0,18.5,8],'axis':'x','angle':180,'rescale':False}
  return item
 neck=neck_box([4,17,4],[8,3,8],[0,0],-.1)
 lip=neck_box([5,20,5],[6,1,6],[0,5],.2)
 return [body,neck,lip]

# Native BookModel.createBodyLayer/setupAnim, verified from official client hgr.
# Freeze EnchantTableRenderer.submit's animation at animationPos=0, open=1,
# pageFlip1=.1, pageFlip2=.9, yaw=0. Preserve its 80-degree Z tilt and .85-block
# centre height. Model.z is degrees; model.offset is a post-rotation translation
# in Minecraft pixels. The ordinary block-model base remains a separate entry.
def enchanting_book():
 texture='entity/enchanting_table_book';extract_texture(texture)
 assert (textures[texture]['width'],textures[texture]['height'])==(64,32)
 spread=1.25;page_x=math.sin(spread)
 def part(name,position,size,offset,translation=(0,0,0),angle=0):
  x,y,z=position;w,h,d=size;u,v=offset
  origin=[8+n for n in translation]
  item=cube([origin[0]+x,origin[1]+y,origin[2]+z],
            [origin[0]+x+w,origin[1]+y+h,origin[2]+z+d],texture)
  item['name']=name
  rects={'down':[u+d,v,u+d+w,v+d],
         'up':[u+d+w,v+d,u+d+2*w,v],
         'west':[u+d,v+d+h,u,v+d],
         'north':[u+d+w,v+d+h,u+d,v+d],
         'east':[u+2*d+w,v+d+h,u+d+w,v+d],
         'south':[u+2*d+2*w,v+d+h,u+2*d+w,v+d]}
  for direction,rect in rects.items():
   item['faces'][direction]['uv']=[rect[0]/4,rect[1]/2,rect[2]/4,rect[3]/2]
  item['rotation']={'origin':origin,'axis':'y','angle':math.degrees(angle),'rescale':False}
  return item
 elements=[
  part('left_lid',[-6,-5,-.005],[6,10,.005],[0,0],(0,0,-1),math.pi+spread),
  part('right_lid',[0,-5,-.005],[6,10,.005],[16,0],(0,0,1),-spread),
  part('seam',[-1,-5,0],[2,10,.005],[12,0],angle=math.pi/2),
  part('left_pages',[0,-4,-.99],[5,8,1],[0,10],(page_x,0,0),spread),
  part('right_pages',[0,-4,-.01],[5,8,1],[12,10],(page_x,0,0),-spread),
  part('flip_page1',[0,-4,0],[5,8,.005],[24,10],(page_x,0,0),spread-2*spread*.1),
  part('flip_page2',[0,-4,0],[5,8,.005],[24,10],(page_x,0,0),spread-2*spread*.9)
 ]
 return {'elements':elements,'x':0,'y':0,'z':80,'offset':[0,5.6,0]}

materials=sorted({r['material'] for b in catalog['blueprints'] for r in b['requirements']} - {'AIR'})
for material in materials:
 state=read('blockstates/'+material.lower()+'.json')
 choices=[]
 if 'variants' in state:
  for key,value in state['variants'].items():
   parts=dict(p.split('=',1) for p in key.split(',') if '=' in p)
   score=0
   for prop,val in parts.items():
    preferred={'type':'bottom','facing':'south' if material in ('BARREL','DROPPER') else ('down' if material=='HOPPER' else 'north'),'open':'false','lit':'false','triggered':'false','cracked':'false','waterlogged':'false','bloom':'false'}
    score+=100 if val==preferred.get(prop,'false') else -1
   choices.append((score,key,value[0] if isinstance(value,list) else value))
  chosen=max(choices,key=lambda c:c[0]);entries=[chosen[2]]
 else:
  entries=[]
  for part in state['multipart']:
   when=part.get('when',{})
   if when and any(v!=('true' if prop=='up' else 'false') for prop,v in when.items()):continue
   value=part['apply'];entries.append(value[0] if isinstance(value,list) else value)
 baked=[{'elements':pot() if material=='DECORATED_POT' else bake(entry['model']),'x':entry.get('x',0),'y':entry.get('y',0)} for entry in entries]
 if material=='ENCHANTING_TABLE':baked.append(enchanting_book())
 assert any(m['elements'] for m in baked),material+' missing geometry'
 models[material]=baked
 first=next(iter(baked[0]['elements'][0]['faces'].values()))['texture'];icons[material]=textures[first]['url']

# Use vanilla item sprites where present, block particle textures otherwise.
for material in [e['dye'] for e in catalog['elements']]+[p['material'] for p in catalog['plants']]:
 name=material.lower()
 candidates=['item/'+name,'block/'+name,'block/'+name+'_top','block/'+name+'_bottom','block/'+name+'_stage0']
 for candidate in candidates:
  if 'assets/minecraft/textures/'+candidate+'.png' in z.namelist():
   extract_texture(candidate);icons[material]=textures[candidate]['url'];break
 if material not in icons:
  try:
   tx=resolve('block/'+name).get('textures',{});t=next(v for v in tx.values() if not v.startswith('#'));extract_texture(t);icons[material]=textures[clean(t)]['url']
  except (KeyError,StopIteration):pass
manifest={'version':source['version'],'source':source,'models':models,'textures':textures,'icons':icons,'notes':{'ENCHANTING_TABLE':'Native base plus seven cuboids from official Minecraft 1.21.11 BookModel.createBodyLayer/setupAnim (mapped hgr), using unchanged entity/enchanting_table_book.png (64x32) and native atlas UVs. Static open pose: animationPos=0, open=1, pageFlip1=0.1, pageFlip2=0.9, spread=1.25 radians. Native EnchantTableRenderer.submit (hrt) tilt=80 degrees about Z, yaw=0, book centre height=0.85 blocks. Book follows no player and does not animate. Model.z is degrees; model.offset is post-rotation Minecraft-pixel translation.','DECORATED_POT':'Verified from official Minecraft 1.21.11 client DecoratedPotRenderer.createBaseLayer/createSidesLayer (mapped class hrs) and ModelPart.Cube (hdg$a): 14x16x14 body, 8x3x8 neck with -0.1 deformation, 6x1x6 lip with +0.2 deformation, original 32x32 base atlas UVs and 16x16 side atlas UVs. Native source cuboids and transforms preserved; vanilla textures unchanged.'}}
(root/'src/data/minecraft-assets.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(f'{len(models)} block models, {len(textures)} original textures, {len(icons)} icons exported')
