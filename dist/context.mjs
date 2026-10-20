export const sectors={health:['Salud','Healthcare'],education:['Educación','Education'],energy:['Energía','Energy'],agriculture:['Agricultura','Agriculture'],government:['Administración pública','Government'],finance:['Finanzas y seguros','Finance & insurance'],manufacturing:['Industria','Manufacturing'],technology:['Tecnología y telecomunicaciones','Technology & telecoms'],transport:['Transporte y logística','Transport & logistics'],retail:['Comercio','Retail'],construction:['Construcción e inmobiliario','Construction & real estate'],services:['Servicios profesionales','Professional services'],hospitality:['Turismo y hostelería','Hospitality'],other:['Otro / varios','Other / multiple']};
export const unknown='__unknown__';
export function countryName(code,lang=document.documentElement.lang){if(!code)return lang==='en'?'No data':'Sin datos';try{return new Intl.DisplayNames([lang],{type:'region'}).of(code)+' · '+code;}catch{return code;}}
export function sectorName(value,lang=document.documentElement.lang){return sectors[value]?.[lang==='en'?1:0]||(value||(lang==='en'?'No data':'Sin datos'));}
export function matchesContext(value,filter){return !filter||(filter===unknown?!value:value===filter);}
export function contextOptions(select,values,label,all,current){
 select.replaceChildren(new Option(all,''));
 [...new Set(values.filter(Boolean))].sort((a,b)=>label(a).localeCompare(label(b))).forEach(v=>select.add(new Option(label(v),v)));
 if(values.some(v=>!v))select.add(new Option(document.documentElement.lang==='en'?'No data':'Sin datos',unknown));
 if([...select.options].some(o=>o.value===current))select.value=current;
}
