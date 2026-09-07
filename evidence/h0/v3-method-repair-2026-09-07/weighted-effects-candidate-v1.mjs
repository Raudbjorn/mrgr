import assert from 'node:assert/strict';
import {clusterJackknife,clusterCritical} from '../v3-inference.mjs';

export const CELLS=['side-verbatim/module','side-verbatim/GOPATH','blend/module','blend/GOPATH'];
export const WEIGHTS=Object.freeze(Object.fromEntries(CELLS.map(c=>[c,0.25])));
export function discordance(rows,key){
 const counts={both:0,selected_only:0,comparator_only:0,neither:0};
 for(const r of rows){assert(typeof r.selected==='boolean'&&typeof r[key]==='boolean');counts[r.selected?(r[key]?'both':'selected_only'):(r[key]?'comparator_only':'neither')]++;}
 return counts;
}
export function effects(rows,comparators){
 assert(rows.length&&new Set(rows.map(r=>r.id)).size===rows.length,'nonempty unique cases required');
 assert(rows.every(r=>r.repo&&CELLS.includes(r.cell)),'missing cluster or composition cell');
 const cells=Object.fromEntries(CELLS.map(c=>[c,rows.filter(r=>r.cell===c)]));
 const summarize=rs=>rs.length?Object.fromEntries(Object.entries(clusterJackknife(rs,comparators)).map(([k,v])=>[k,{...v,n:rs.length,discordance:discordance(rs,k)}])):null;
 const strata=Object.fromEntries(Object.entries(cells).map(([c,rs])=>[c,summarize(rs)]));
 const groups=[...Map.groupBy(rows,r=>r.repo).values()],g=groups.length,critical=clusterCritical(g);
 const missing=CELLS.filter(c=>!cells[c].length);
 // Delete an entire lineage, keeping its cases and all paired outcomes together.
 // A cell supported by only one lineage cannot supply a deletion estimate.
 const unsupported=CELLS.filter(c=>new Set(cells[c].map(r=>r.repo)).size<2);
 const standardized=missing.length?null:Object.fromEntries(comparators.map(k=>{
  const delta=CELLS.reduce((s,c)=>s+WEIGHTS[c]*strata[c][k].delta,0);
  if(unsupported.length)return[k,{delta,lower:-1,upper:1,variance:null,clusters:g,method:'insufficient-cell-lineages',unsupported_cells:unsupported}];
  const deleted=groups.map(rs=>CELLS.reduce((s,c)=>{
   const removed=rs.filter(r=>r.cell===c),total=(strata[c][k].discordance.selected_only-strata[c][k].discordance.comparator_only);
   return s+WEIGHTS[c]*(total-removed.reduce((v,r)=>v+Number(r.selected)-Number(r[k]),0))/(cells[c].length-removed.length);
  },0));
  const variance=(g-1)/g*deleted.reduce((s,v)=>s+(v-delta)**2,0);
  const masses=groups.map(rs=>CELLS.reduce((s,c)=>s+WEIGHTS[c]*rs.filter(r=>r.cell===c).length/cells[c].length,0));
  const width=variance>0?critical*Math.sqrt(variance):Math.sqrt(2*Math.log(40)*masses.reduce((s,w)=>s+w*w,0));
  return[k,{delta,lower:Math.max(-1,delta-width),upper:Math.min(1,delta+width),variance,clusters:g,df:Math.min(g-1,30),critical,method:'fixed-four-cell-cluster-delete-t/1',fallback:variance===0?'independent-cluster-Hoeffding95':null}];
 }));
 return{unweighted:summarize(rows),standardized,strata,blend:summarize(rows.filter(r=>r.cell.startsWith('blend/'))),weights:WEIGHTS,counts:Object.fromEntries(CELLS.map(c=>[c,cells[c].length])),missing_cells:missing,uncertainty_available:!unsupported.length};
}
