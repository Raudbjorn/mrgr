// Parse the generated final channel only; never search reasoning for a usable answer.
export function finalContent(text){
 if(typeof text!=='string')return null;
 const header=/(?:^|<\|end\|>)(?:<\|start\|>assistant)?<\|channel\|>final(?:[ \t]*<\|constrain\|>json)?<\|message\|>/g;
 const matches=[...text.matchAll(header)];
 if(matches.length!==1)return null;
 const m=matches[0];
 const content=text.slice(m.index+m[0].length).replace(/(?:<\|fim_suffix\|>|<\|return\|>|<\|end\|>)\s*$/,'');
 // JSON validation preserves marker-like text inside quoted source strings.
 try{JSON.parse(content);}catch{return null;}
 return content;
}
export function normalized(body){
 const c=body?.choices?.[0];
 if(!c||c.finish_reason!=='stop')return body;
 return {...body,choices:[{...c,message:{...c.message,content:finalContent(c.message?.content)}}]};
}
