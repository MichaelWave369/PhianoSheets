/** Local-only, license-neutral SFZ, WAV and SF2 sample bank ingestion.
 * No uploaded file bytes are sent to a server or stored in project JSON.
 * SF2 intentionally supports core preset/instrument/sample zones, not every
 * SoundFont generator (modulators, linked stereo, envelopes etc.). */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
const keyNumber=value=>{
  if(value===undefined||value===null)return null;
  if(/^-?\d+$/.test(String(value)))return clamp(Math.round(Number(value)),0,127);
  const m=/^([a-g])([#b]?)(-?\d+)$/i.exec(String(value).trim());
  if(!m)return null;
  const base={c:0,d:2,e:4,f:5,g:7,a:9,b:11}[m[1].toLowerCase()];
  return clamp((Number(m[3])+1)*12+base+(m[2]==='#'?1:m[2]==='b'?-1:0),0,127);
};
const safePath=path=>{
  const p=String(path||'').replace(/\\/g,'/').replace(/^\.\//,'').toLowerCase();
  if(!p||p.startsWith('/')||p.split('/').includes('..')||/^[a-z]:/.test(p))throw Error('Unsafe sample path');
  return p;
};
const opcodes=body=>{
  const result={};
  for(const m of body.replace(/\/\/[^\n]*/g,'').matchAll(/([a-z_][\w]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+))/gi))
    result[m[1].toLowerCase()]=m[2]??m[3]??m[4];
  return result;
};

export function parseSFZ(text){
  if(typeof text!=='string'||text.length>2*1024*1024)throw Error('Invalid or oversized SFZ text');
  const tags=[...text.matchAll(/<(control|global|group|region)>/gi)];
  if(!tags.length)throw Error('SFZ has no recognized opcodes');
  let global={},group={},defaultPath='',regions=[];
  for(let i=0;i<tags.length;i++){
    const tag=tags[i],body=text.slice(tag.index+tag[0].length,tags[i+1]?.index??text.length);
    const props=opcodes(body);
    switch(tag[1].toLowerCase()){
      case 'control': defaultPath=props.default_path||defaultPath;break;
      case 'global': global={...global,...props};group={};break;
      case 'group': group={...props};break;
      case 'region': {
        const r={...global,...group,...props};
        if(!r.sample)break;
        const key=keyNumber(r.key),root=keyNumber(r.pitch_keycenter)??key??60;
        const keyLo=keyNumber(r.lokey)??key??0,keyHi=keyNumber(r.hikey)??key??127;
        if(keyLo>keyHi)continue;
        const path=safePath(defaultPath.replace(/\\/g,'/')+r.sample);
        regions.push({path,keyLo,keyHi,velLo:clamp(r.lovel??1,1,127),velHi:clamp(r.hivel??127,1,127),
          root,tune:clamp(r.tune??0,-1200,1200),gain:Math.pow(10,clamp(r.volume??0,-96,12)/20),
          attack:clamp(r.ampeg_attack??.005,0,10),release:clamp(r.ampeg_release??.09,.01,5),
          loop:/^loop_(continuous|sustain)$/.test(r.loop_mode||''),
          loopStart:Math.max(0,Number(r.loop_start)||0),loopEnd:Math.max(0,Number(r.loop_end)||0)});
        break;
      }
    }
  }
  if(!regions.length)throw Error('SFZ has no playable sample regions');
  if(regions.length>512)throw Error('SFZ has too many sample regions');
  return regions;
}
const str=(bytes,pos,n)=>new TextDecoder('latin1').decode(bytes.subarray(pos,pos+n)).replace(/\0.*$/,'').trim();
const viewOf=bytes=>new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
const sliceTable=(bytes,pair,size)=>{if(!pair||pair.size%size)throw Error('Invalid SF2 table');return {offset:pair.offset,count:pair.size/size};};
/** Extract the selected preset of a PCM16 SoundFont 2 RIFF/sfbk file. */
export function inspectSF2(input,presetIndex=0){
  const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
  if(bytes.length<100||bytes.length>192*1024*1024)throw Error('SF2 must be under 192 MB');
  const dv=viewOf(bytes);
  if(str(bytes,0,4)!=='RIFF'||str(bytes,8,4)!=='sfbk'||dv.getUint32(4,true)+8>bytes.length)
    throw Error('Not a valid SoundFont 2 file');
  const chunks=new Map();
  const collect=(from,to,depth=0)=>{
    if(depth>3)throw Error('SF2 nested LIST depth too large');
    for(let offset=from;offset+8<=to;){
      const id=str(bytes,offset,4),size=dv.getUint32(offset+4,true);
      const data=offset+8,end=data+size;
      if(end>to)throw Error('Truncated SoundFont chunk');
      if(id==='LIST'&&size>=4)collect(data+4,end,depth+1);
      else if(!chunks.has(id))chunks.set(id,{offset:data,size});
      offset=end+(size&1);
    }
  };
  collect(12,Math.min(bytes.length,dv.getUint32(4,true)+8));
  const tables={};
  for(const [id,size] of [['phdr',38],['pbag',4],['pgen',4],['inst',22],['ibag',4],['igen',4],['shdr',46]])
    tables[id]=sliceTable(bytes,chunks.get(id),size);
  const smpl=chunks.get('smpl');
  if(!smpl||smpl.size<4||smpl.size%2)throw Error('SoundFont lacks 16-bit PCM sample data');
  const at=(id,index,size)=>{if(index<0||index>=tables[id].count)throw Error('SoundFont index out of range');return tables[id].offset+index*size;};
  const presets=[];
  for(let i=0;i<tables.phdr.count-1;i++){
    const off=at('phdr',i,38);
    presets.push({index:i,name:str(bytes,off,20),program:dv.getUint16(off+20,true),bank:dv.getUint16(off+22,true),bag:dv.getUint16(off+24,true)});
  }
  if(!presets.length)throw Error('No SoundFont presets');
  if(!Number.isInteger(presetIndex)||presetIndex<0||presetIndex>=presets.length)throw Error('Invalid SoundFont preset');
  const gen=(first,last,bagId,genId)=>{
    const ranges=[];
    for(let i=first;i<last;i++){
      const bag=at(bagId,i,4);
      const begin=dv.getUint16(bag,true);
      const next=dv.getUint16(at(bagId,i+1,4),true);
      const ops={};
      for(let j=begin;j<next;j++){
        const pos=at(genId,j,4);
        const op=dv.getUint16(pos,true),raw=dv.getUint16(pos+2,true);
        ops[op]=raw;
      }
      ranges.push(ops);
    }
    return ranges;
  };
  const range=(raw)=>raw===undefined?[0,127]:[raw&255,(raw>>>8)&255];
  const combine=(a,b)=>{
    const x=range(a),y=range(b);
    return [Math.max(x[0],y[0]),Math.min(x[1],y[1])];
  };
  const preset=presets[presetIndex],nextPreset=presets[presetIndex+1];
  const pp=gen(preset.bag,nextPreset?.bag??dv.getUint16(at('phdr',tables.phdr.count-1,38)+24,true),'pbag','pgen');
  let pGlobal={};
  const zones=[],sampleRefs=new Map();
  for(const p of pp){
    if(p[41]===undefined){pGlobal={...pGlobal,...p};continue;}
    const presetZone={...pGlobal,...p};
    const instId=presetZone[41];
    if(instId>=tables.inst.count-1)continue;
    const inst=at('inst',instId,22),instEnd=at('inst',instId+1,22);
    const iZones=gen(dv.getUint16(inst+20,true),dv.getUint16(instEnd+20,true),'ibag','igen');
    let iGlobal={};
    for(const iz of iZones){
      if(iz[53]===undefined){iGlobal={...iGlobal,...iz};continue;}
      const config={...iGlobal,...iz};
      const k=combine(presetZone[43],config[43]);
      const v=combine(presetZone[44],config[44]);
      if(k[0]>k[1]||v[0]>v[1])continue;
      const sampleId=config[53];
      if(sampleId>=tables.shdr.count-1)continue;
      const h=at('shdr',sampleId,46);
      const start=dv.getUint32(h+20,true),end=dv.getUint32(h+24,true);
      const loopStart=dv.getUint32(h+28,true),loopEnd=dv.getUint32(h+32,true);
      const sampleRate=dv.getUint32(h+36,true);
      const sampleType=dv.getUint16(h+44,true);
      if(start>=end||end>smpl.size/2||end-start>8e6||sampleRate<8000||sampleRate>192000||!(sampleType&1))continue;
      const root=config[58]===undefined?bytes[h+40]:config[58]&255;
      const tune=((config[51]||0)<<16>>16)*100+((config[52]||0)<<16>>16)+(dv.getInt8(h+41));
      const att=((config[48]||0)+(presetZone[48]||0))/10;
      const loop=Boolean((config[54]||0)&1)&&loopEnd>loopStart&&loopStart>=start&&loopEnd<=end;
      zones.push({sampleId,keyLo:k[0],keyHi:k[1],velLo:v[0],velHi:v[1],root:clamp(root,0,127),
        tune:clamp(tune,-2400,2400),gain:Math.pow(10,-clamp(att,0,120)/20),attack:.005,release:.12,
        loop,loopStart:loop?loopStart-start:0,loopEnd:loop?loopEnd-start:0});
      if(!sampleRefs.has(sampleId))sampleRefs.set(sampleId,{start,end,sampleRate,name:str(bytes,h,20)});
    }
  }
  if(!zones.length)throw Error('Selected SF2 preset has no supported PCM sample zones');
  if(zones.length>256)throw Error('SF2 preset has too many sample zones');
  return {name:preset.name,program:preset.program,bank:preset.bank,presets,zones,samples:sampleRefs,
    pcmOffset:smpl.offset,bytes};
}
export function chooseRegion(bank,pitch,velocity=100){
  if(!bank?.regions)return null;
  const candidates=bank.regions.filter(z=>pitch>=z.keyLo&&pitch<=z.keyHi&&velocity>=z.velLo&&velocity<=z.velHi);
  if(!candidates.length)return null;
  // Prefer the most specific key + velocity zone when multiple regions overlap.
  candidates.sort((a,b)=>(a.keyHi-a.keyLo+a.velHi-a.velLo)-(b.keyHi-b.keyLo+b.velHi-b.velLo));
  return candidates[0];
}
export async function loadLocalBank(fileList,ctx,presetIndex=0){
  const files=Array.from(fileList||[]);
  if(!files.length||files.length>512)throw Error('Choose a local SF2, WAV or SFZ with its WAV samples');
  const main=files.find(f=>/\.sf2$/i.test(f.name))||files.find(f=>/\.sfz$/i.test(f.name))||files.find(f=>/\.wav$/i.test(f.name));
  if(!main)throw Error('Select an SF2, SFZ or WAV file');
  if(main.size>192*1024*1024)throw Error('Sample file too large (192 MB maximum)');
  if(/\.sf2$/i.test(main.name)){
    const sf2=inspectSF2(await main.arrayBuffer(),presetIndex);
    const {bytes,pcmOffset,samples}=sf2;
    const dv=viewOf(bytes),buffers=new Map();
    for(const [id,s] of samples){
      const frames=s.end-s.start,buffer=ctx.createBuffer(1,frames,s.sampleRate);
      const output=buffer.getChannelData(0);
      for(let i=0;i<frames;i++)output[i]=dv.getInt16(pcmOffset+(s.start+i)*2,true)/32768;
      buffers.set(id,buffer);
    }
    const regions=sf2.zones.map(z=>({...z,buffer:buffers.get(z.sampleId)}));
    return {name:sf2.name+' · SF2',regions,source:'sf2',presets:sf2.presets};
  }
  if(/\.wav$/i.test(main.name)){
    const buffer=await ctx.decodeAudioData(await main.arrayBuffer());
    return {name:main.name,source:'wav',regions:[{buffer,keyLo:0,keyHi:127,velLo:1,velHi:127,
      root:60,tune:0,gain:1,attack:.005,release:.09,loop:false,loopStart:0,loopEnd:0}]};
  }
  const regions=parseSFZ(await main.text());
  const wavs=files.filter(f=>/\.wav$/i.test(f.name));
  const lookup=new Map();
  for(const file of wavs){
    const key=safePath(file.webkitRelativePath||file.name);
    lookup.set(key,file);
  }
  const buffers=new Map();
  let totalBytes=0;
  for(const r of regions){
    let file=lookup.get(r.path);
    if(!file){
      const matches=[...lookup.entries()].filter(([p])=>p.endsWith('/'+r.path)||p.split('/').at(-1)===r.path.split('/').at(-1));
      if(matches.length===1)file=matches[0][1];
    }
    if(!file)throw Error('Missing or ambiguous SFZ WAV sample: '+r.path);
    if(file.size>64*1024*1024)throw Error('Individual WAV sample exceeds 64 MB');
    if(!buffers.has(file)){
      totalBytes+=file.size;
      if(totalBytes>128*1024*1024)throw Error('SFZ sample audio exceeds 128 MB');
      buffers.set(file,await ctx.decodeAudioData(await file.arrayBuffer()));
    }
    r.buffer=buffers.get(file);
    if(r.loop){
      r.loopStart=clamp(r.loopStart/r.buffer.sampleRate,0,r.buffer.duration);
      r.loopEnd=clamp(r.loopEnd/r.buffer.sampleRate,0,r.buffer.duration);
      if(r.loopEnd<=r.loopStart)r.loop=false;
    }
  }
  return {name:main.name+' · SFZ',source:'sfz',regions};
}
