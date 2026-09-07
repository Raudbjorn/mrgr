import assert from 'node:assert/strict';
// ceil(1e6 * scipy.stats.t.ppf(.975, df)) / 1e6, df=1..30.
const T975=[12.706205,4.302653,3.182447,2.776446,2.570582,2.446912,2.364625,2.306005,2.262158,2.228139,2.200986,2.178813,2.160369,2.144787,2.13145,2.119906,2.109816,2.100923,2.093025,2.085964,2.079614,2.073874,2.068658,2.063899,2.059539,2.05553,2.051831,2.048408,2.04523,2.042273];
export function clusterJackknife(rows,comparators){
  assert(rows.length);const groups=[...Map.groupBy(rows,r=>r.repo).values()],g=groups.length,n=rows.length;
  // ponytail: cap degrees of freedom at 30 for conservative table lookup;
  // replace the table only if extra large-cluster precision is material.
  const df=Math.min(g-1,30),critical=g>1?T975[df-1]:null;
  return Object.fromEntries(comparators.map(k=>{
    assert(rows.every(r=>typeof r.selected==='boolean'&&typeof r[k]==='boolean'),'paired outcomes must be booleans');
    const totals=groups.map(rs=>rs.reduce((s,r)=>s+Number(r.selected)-Number(r[k]),0)),sum=totals.reduce((a,b)=>a+b,0),delta=sum/n;
    if(g<2)return[k,{delta,lower:-1,upper:1,clusters:g,method:'insufficient-independent-clusters',variance:null,df,critical}];
    // CV3, MacKinnon/Nielsen/Webb (2023), equation 18, intercept-only OLS.
    const variance=(g-1)/g*groups.reduce((s,rs,i)=>s+((sum-totals[i])/(n-rs.length)-delta)**2,0),width=critical*Math.sqrt(variance);
    return[k,{delta,lower:Math.max(-1,delta-width),upper:Math.min(1,delta+width),clusters:g,method:'cluster-jackknife-CV3-t/1',variance,df,critical}];
  }));
}
