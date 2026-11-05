/** ZIP "store" encoder: valid CRC32, no compression, one browser download for six stems. */
const table=new Uint32Array(256);
for(let n=0;n<256;n++){
  let c=n;
  for(let i=0;i<8;i++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;
  table[n]=c>>>0;
}
export function crc32(bytes){
  let c=0xffffffff;
  for(const b of bytes)c=table[(c^b)&255]^(c>>>8);
  return (c^0xffffffff)>>>0;
}
const u16=(v)=>[v&255,(v>>>8)&255],u32=(v)=>[v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];
const safeName=name=>{
  const s=String(name||'stem.wav').replace(/\\/g,'/').split('/').at(-1).replace(/[^\w .()-]+/g,'-');
  if(!s||s==='.'||s==='..')throw Error('Invalid ZIP entry name');
  return s;
};
/** Build ZIP as a Blob so browsers can keep large WAV file chunks out of JS copies. */
export function zipStore(entries){
  if(!Array.isArray(entries)||entries.length<1||entries.length>20)throw Error('ZIP needs 1–20 files');
  const parts=[],central=[];let offset=0,centralBytes=0;
  const encoder=new TextEncoder();
  for(const entry of entries){
    const name=encoder.encode(safeName(entry.name));
    const data=entry.bytes;
    if(!(data instanceof Uint8Array)||data.byteLength>0xffffffff)throw Error('ZIP expects Uint8Array files');
    const length=data.byteLength,checksum=crc32(data);
    const header=Uint8Array.from([...u32(0x04034b50),...u16(20),...u16(0),...u16(0),
      ...u16(0),...u16(0),...u32(checksum),...u32(length),...u32(length),
      ...u16(name.length),...u16(0),...name]);
    parts.push(header,data);
    const index=Uint8Array.from([...u32(0x02014b50),...u16(20),...u16(20),...u16(0),...u16(0),
      ...u16(0),...u16(0),...u32(checksum),...u32(length),...u32(length),
      ...u16(name.length),...u16(0),...u16(0),...u16(0),...u16(0),
      ...u32(0),...u32(offset),...name]);
    central.push(index);centralBytes+=index.length;
    offset+=header.length+data.length;
    if(offset>0xffffffff)throw Error('ZIP archive exceeds 4 GiB');
  }
  const end=Uint8Array.from([...u32(0x06054b50),...u16(0),...u16(0),
    ...u16(entries.length),...u16(entries.length),...u32(centralBytes),...u32(offset),...u16(0)]);
  return new Blob([...parts,...central,end],{type:'application/zip'});
}
export function downloadZip(entries,title,suffix='stems'){
  const blob=zipStore(entries),url=URL.createObjectURL(blob),a=document.createElement('a');
  const filename=String(title||'phianosheets').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'phianosheets';
  const tail=String(suffix||'stems').toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-|-$/g,'')||'stems';
  a.href=url;a.download=filename+'-'+tail+'.zip';
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1200);
}
