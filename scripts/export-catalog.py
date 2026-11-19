#!/usr/bin/env python3
"""Export the live Java catalogs to website JSON without changing a Maven build.
Run from any directory: python3 scripts/export-catalog.py [path-to-MoggersDrugs]
Requires Java 25 and a previously built plugin JAR (no running Paper required).
The exporter runs against BlueprintCatalog and PlantCatalog from that JAR.
"""
from pathlib import Path
import json, os, shutil, subprocess, sys, tempfile

WIKI = Path(__file__).resolve().parents[1]
ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else WIKI.parent / 'MoggersDrugs'
if len(sys.argv) == 1 and not ROOT.is_dir():
    ROOT = WIKI.parent / 'Moggers' / 'MoggersDrugs'
jar = ROOT / 'target/MoggersDrugs-0.1.0-SNAPSHOT.jar'
if not jar.is_file():
    raise SystemExit('Pass the plugin directory to npm run catalog -- <path> and build it with mvn package first.')
snake = sorted((Path.home() / '.m2/repository/org/yaml/snakeyaml').glob('*/snakeyaml-*.jar'))
if not snake:
    raise SystemExit('SnakeYAML dependency was not found in the local Maven cache.')
java_home = Path(os.environ['JAVA_HOME']) if os.environ.get('JAVA_HOME') else Path(shutil.which('javac')).resolve().parents[1]
TYPES = {'EXTRACTOR':'Извлекатель','ASSEMBLY':'Сборочная станция','REACTOR':'Реактор','STABILIZER':'Стабилизатор','SEPARATOR':'Разделитель','WAREHOUSE':'Складской узел'}
TIERS = {'BASIC':'Базовый','NORMAL':'Обычный','SCIENTIFIC':'Научный'}
MATERIALS = {'AIR':'Воздух','POLISHED_ANDESITE':'Полированный андезит','SMOOTH_STONE':'Гладкий камень','FURNACE':'Печь','PACKED_ICE':'Плотный лёд','CRAFTING_TABLE':'Верстак','BREWING_STAND':'Зельеварка','CAULDRON':'Котёл','WHITE_STAINED_GLASS':'Белое стекло','RED_STAINED_GLASS':'Красное стекло','BLUE_STAINED_GLASS':'Синее стекло','GRAY_STAINED_GLASS':'Серое стекло','LIME_STAINED_GLASS':'Лаймовое стекло','BARREL':'Бочка','HOPPER':'Воронка','DROPPER':'Выбрасыватель','REDSTONE_LAMP':'Редстоуновая лампа','IRON_BLOCK':'Железный блок','GLASS':'Стекло','BLAST_FURNACE':'Плавильная печь','SMITHING_TABLE':'Стол кузнеца','REDSTONE_BLOCK':'Редстоуновый блок','HONEYCOMB_BLOCK':'Блок пчелиных сот','DECORATED_POT':'Узорчатая ваза','LECTERN':'Кафедра','ENCHANTING_TABLE':'Стол зачарований','QUARTZ_BLOCK':'Кварцевый блок','AMETHYST_BLOCK':'Аметистовый блок','COPPER_BLOCK':'Медный блок','WAXED_COPPER_BLOCK':'Вощёный медный блок'}
MATERIALS.update({'SMOOTH_STONE_SLAB':'Плита из гладкого камня','SPRUCE_FENCE':'Еловый забор','POLISHED_BLACKSTONE_BRICKS':'Полированные чернокаменные кирпичи','POLISHED_BLACKSTONE_BRICK_WALL':'Ограда из полированных чернокаменных кирпичей','WAXED_COPPER_GRATE':'Вощёная медная решётка'})
JAVA = r'''
import dev.moggers.drugs.station.*;
import dev.moggers.drugs.ecology.*;
import dev.moggers.drugs.core.element.*;
import com.google.gson.*;
import java.util.*;
import java.nio.file.*;
public class ExportWiki {
 public static void main(String[] args) throws Exception {
  Path resources=Path.of(args[0]);
  ElementCatalog elements=ElementCatalog.read(Files.newInputStream(resources.resolve("elements.json")));
  PlantCatalog plants=PlantCatalog.read(Files.newInputStream(resources.resolve("plants.yml")),elements);
  Map<String,Object> data=new LinkedHashMap<>(); data.put("elements",elements.all());
  List<Object> plantRows=new ArrayList<>();
  for(String material:plants.materials()) {
   List<Object> profiles=new ArrayList<>();
   for(var p:plants.profiles(material))profiles.add(Map.of("bonus",p.bonus().amounts(),"biomes",p.biomes().stream().sorted().toList(),"maturityMinutes",p.maturityTicks()/1200,"priority",p.priority()));
   plantRows.add(Map.of("material",material,"name",plants.profiles(material).getFirst().name(),"base",plants.base(material).amounts(),"profiles",profiles));
  }
  data.put("plants",plantRows);List<Object> builds=new ArrayList<>();var catalog=new BlueprintCatalog();
  for(var type:StationType.values())for(var tier:StationTier.values()) {
   var b=catalog.forType(type,tier);Map<String,Object> out=new LinkedHashMap<>();
   out.put("id",type.name().toLowerCase()+"-"+tier.name().toLowerCase());out.put("type",type);out.put("tier",tier);
   out.put("width",b.width());out.put("depth",b.depth());out.put("height",b.height());out.put("requirements",b.requirements());
   out.put("panel",Map.of("x",0,"y",1,"z",1));
   out.put("port",Map.of("x",0,"y",1,"z",tier==StationTier.SCIENTIFIC?-3:-1));
   if(type==StationType.EXTRACTOR){out.put("input",Map.of("x",0,"y",1,"z",-1));out.put("output",Map.of("x",-1,"y",1,"z",1));}
   out.put("limits",Map.of("capacityGrams",tier.capacity().grams(),"functions",tier.functions,"plants",tier.plants,"secondsPerGram",tier.secondsPerGram,"yieldPercent",tier.yieldBasisPoints/100.0,"otherLossPercent",tier.otherLossBasisPoints/100.0,"speed",tier.speed,"bufferFractions",2<<tier.ordinal()));
   builds.add(out);
  }
  data.put("blueprints",builds);data.put("counts",Map.of("elements",elements.all().size(),"plants",plants.materialCount(),"profiles",plants.profileCount(),"stations",builds.size()));
  System.out.print(new GsonBuilder().serializeNulls().create().toJson(data));
 }
}
'''
with tempfile.TemporaryDirectory(prefix='moggers-wiki-export-') as temp:
    temp = Path(temp)
    runner = temp / 'ExportWiki.java'
    runner.write_text(JAVA)
    cp = os.pathsep.join([str(jar), str(snake[-1])])
    subprocess.run([str(java_home/'bin/javac'),'-encoding','UTF-8','--release','25','-cp',cp,'-d',str(temp),str(runner)],check=True)
    result=subprocess.run([str(java_home/'bin/java'),'-cp',os.pathsep.join([str(temp),str(ROOT/'src/main/resources'),cp]),'ExportWiki',str(ROOT/'src/main/resources')],check=True,capture_output=True,text=True)
    data=json.loads(result.stdout)
assert data['counts'] == {'elements':16,'plants':58,'profiles':62,'stations':15}, data['counts']
for build in data['blueprints']:
    build['name'] = TYPES[build['type']] + ' · ' + TIERS[build['tier']].lower()
    keys={(r['x'],r['y'],r['z']) for r in build['requirements']}
    assert len(keys)==len(build['requirements'])
    assert build['height'] == 1 + max(y for x,y,z in keys)
warehouse_cells=[]
for x in range(-1,2):
    for z in range(-1,2): warehouse_cells.append(dict(x=x,y=0,z=z,material='POLISHED_ANDESITE',facing=None))
warehouse_cells.append(dict(x=0,y=1,z=0,material='BARREL',facing=None))
for x,z in [(1,0),(-1,0),(0,1),(0,-1)]: warehouse_cells.append(dict(x=x,y=1,z=z,material='COPPER_BLOCK',facing=None))
warehouse_cells.append(dict(x=0,y=2,z=0,material='REDSTONE_LAMP',facing=None))
data['blueprints'].append(dict(id='warehouse-basic',type='WAREHOUSE',tier='BASIC',name=TYPES['WAREHOUSE'],width=3,height=3,depth=3,requirements=warehouse_cells,panel=dict(x=0,y=1,z=0),port=None,limits=dict(barrels=32,stations=16,pipes=256,routeLength=32)))
data['materials']=MATERIALS
data['types']=TYPES; data['tiers']=TIERS
data['families']={'SUPPORT':'Опорные','CONNECTOR':'Связующие','DIRECTOR':'Направляющие','MOBILE':'Подвижные'}
data['elementProperties']={'valence':'Сумма кратностей всех связей узла не может превышать валентность.','affinity':'Вместе с семейством и полярностью участвует в силе связи и энергии структуры.','mobility':'Влияет на скорость преобразований и профиль действия соединения.','polarity':'Влияет на взаимодействие элементов и среду; значения бывают положительными и отрицательными.','strain':'Определяет вклад элемента в напряжение разветвлённой структуры.'}
data['biomes']={'BADLANDS':'Пустоши','BAMBOO_JUNGLE':'Бамбуковые джунгли','BASALT_DELTAS':'Базальтовые дельты','BIRCH_FOREST':'Берёзовый лес','CHERRY_GROVE':'Вишнёвая роща','COLD_OCEAN':'Холодный океан','CRIMSON_FOREST':'Багровый лес','DARK_FOREST':'Тёмный лес','DEEP_COLD_OCEAN':'Глубокий холодный океан','DEEP_DARK':'Тёмные глубины','DEEP_FROZEN_OCEAN':'Глубокий замёрзший океан','DEEP_LUKEWARM_OCEAN':'Глубокий умеренно тёплый океан','DEEP_OCEAN':'Глубокий океан','DESERT':'Пустыня','DRIPSTONE_CAVES':'Карстовые пещеры','END_BARRENS':'Окраины Энда','END_HIGHLANDS':'Возвышенности Энда','END_MIDLANDS':'Средние земли Энда','ERODED_BADLANDS':'Размытые пустоши','FLOWER_FOREST':'Цветочный лес','FOREST':'Лес','FROZEN_OCEAN':'Замёрзший океан','JUNGLE':'Джунгли','LUKEWARM_OCEAN':'Умеренно тёплый океан','LUSH_CAVES':'Пышные пещеры','MANGROVE_SWAMP':'Мангровое болото','MEADOW':'Луг','MUSHROOM_FIELDS':'Грибные поля','NETHER_WASTES':'Пустоши Незера','OCEAN':'Океан','OLD_GROWTH_BIRCH_FOREST':'Старовозрастный берёзовый лес','OLD_GROWTH_PINE_TAIGA':'Старовозрастная сосновая тайга','OLD_GROWTH_SPRUCE_TAIGA':'Старовозрастная еловая тайга','PALE_GARDEN':'Бледный сад','PLAINS':'Равнины','SAVANNA':'Саванна','SAVANNA_PLATEAU':'Плато саванны','SMALL_END_ISLANDS':'Маленькие острова Энда','SNOWY_TAIGA':'Заснеженная тайга','SOUL_SAND_VALLEY':'Долина песка душ','SPARSE_JUNGLE':'Редкие джунгли','SUNFLOWER_PLAINS':'Подсолнечные равнины','SWAMP':'Болото','TAIGA':'Тайга','THE_END':'Энд','WARM_OCEAN':'Тёплый океан','WARPED_FOREST':'Искажённый лес','WINDSWEPT_SAVANNA':'Ветреная саванна','WOODED_BADLANDS':'Лесистые пустоши'}
for plant in data['plants']: data['materials'].setdefault(plant['material'],plant['name'])
assert all(biome in data['biomes'] for plant in data['plants'] for profile in plant['profiles'] for biome in profile['biomes'])
data['warehouse']={'allowedCopper':['COPPER_BLOCK','EXPOSED_COPPER','WEATHERED_COPPER','OXIDIZED_COPPER','CHISELED_COPPER','EXPOSED_CHISELED_COPPER','WEATHERED_CHISELED_COPPER','OXIDIZED_CHISELED_COPPER'],'waxedAllowed':True,'diagonalLinks':False,'routeLength':32,'barrels':32,'stations':16,'pipes':256}
data['massUnit']='micrograms';data['version']='0.1.0-SNAPSHOT';data['paperVersion']='26.3'
output=WIKI/'src/data/catalog.json'
output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print(f'Exported {len(data["elements"])} elements, {len(data["plants"])} plants, {data["counts"]["profiles"]} profiles, {len(data["blueprints"])} blueprints to {output}')
