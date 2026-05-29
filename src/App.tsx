import { useState, useEffect, useRef } from "react";

const STORAGE_KEYS = { recipes: "rb_recipes", plan: "rb_plan", extras: "rb_extras", skipped: "rb_skipped" };
function loadData(key) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; } }
function saveData(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }

const CATEGORIES = [
  { id:"spice-blends", label:"Spice blends",  emoji:"🌶️", color:"#B85C2A", bg:"#FBF0EB" },
  { id:"meat-times",   label:"Meat times",    emoji:"🥩", color:"#8B3A3A", bg:"#F8EDED" },
  { id:"breakfast",    label:"Breakfast",     emoji:"🍳", color:"#C2852A", bg:"#FDF3E3" },
  { id:"mains",        label:"Mains",         emoji:"🍽️", color:"#4A8C5C", bg:"#EBF4EF" },
  { id:"baking",       label:"Baking",        emoji:"🍞", color:"#7A6A3E", bg:"#F5F0E3" },
  { id:"sweet-treats", label:"Sweet treats",  emoji:"🍬", color:"#9B5B8A", bg:"#F5EBF3" },
];

const EMOJI_GROUPS = [
  { label:"Meat & fish",    emojis:["🥩","🍗","🍖","🥓","🌭","🐟","🦐","🦑","🦞","🦀","🍣","🥚","🍳"] },
  { label:"Veg & fruit",    emojis:["🥦","🥕","🧅","🧄","🥔","🌽","🫑","🥑","🍅","🥒","🥬","🍎","🍋","🍌","🍇"] },
  { label:"Grains & bowls", emojis:["🍝","🍜","🍛","🍚","🥘","🫕","🌮","🌯","🥙","🥗","🍲","🫔","🧆"] },
  { label:"Baking & sweets",emojis:["🎂","🍰","🧁","🍩","🍪","🥐","🍞","🥖","🧇","🥞","🍫","🍮","🍯"] },
  { label:"Drinks",         emojis:["☕","🍵","🧃","🥤","🍹","🍷","🥂","🍺","🫖","🧋","🥛"] },
  { label:"Spices",         emojis:["🧂","🫙","🫚","🌶️","🌿","🍃","🌱","⭐","✨","🔥","💫"] },
];

const SHOP_CATS = [
  { id:"meat",    label:"Meat & Fish",        emoji:"🥩", keywords:["chicken","beef","pork","lamb","mince","steak","bacon","sausage","fish","prawn","shrimp","squid","salmon","tuna","fillet","thigh","breast","brisket","ribs","turkey","duck","anchovy","seafood"] },
  { id:"produce", label:"Fruit & Veg",         emoji:"🥦", keywords:["onion","garlic","ginger","tomato","capsicum","carrot","celery","zucchini","broccoli","spinach","kale","potato","pumpkin","eggplant","mushroom","cabbage","leek","beetroot","corn","pea","bean","avocado","lemon","lime","orange","apple","banana","mango","pineapple","parsley","coriander","basil","rosemary","thyme","mint","dill","chilli","spring onion","shallot","bok choy","cauliflower","sweet potato"] },
  { id:"tins",    label:"Tins & Jars",         emoji:"🥫", keywords:["tin","canned","crushed tomato","diced tomato","whole tomato","coconut milk","coconut cream","kidney bean","butter bean","chickpea","lentil","passata","tomato paste","curry paste","gochujang","miso","oyster sauce","fish sauce","soy","hoisin","tahini","peanut butter","stock cube","chutney","capers","olive"] },
  { id:"dry",     label:"Dry Goods",           emoji:"🌾", keywords:["pasta","spaghetti","rice","flour","couscous","noodle","risoni","risotto","lentil","oat","bread","crumb","panko","cornstarch","baking powder","baking soda","sugar","salt","pepper","yeast","almond meal","cornmeal"] },
  { id:"dairy",   label:"Dairy & Eggs",        emoji:"🧀", keywords:["butter","cream","milk","cheese","parmesan","ricotta","yoghurt","yogurt","egg","feta","haloumi","halloumi","ghee","cream cheese","sour cream","buttermilk"] },
  { id:"sauces",  label:"Sauces & Condiments", emoji:"🫙", keywords:["oil","vinegar","sauce","stock","broth","wine","honey","molasse","worcestershire","tabasco","mustard","mayo","ketchup","sriracha","mango chutney","relish"] },
  { id:"spices",  label:"Spices",              emoji:"🌿", keywords:["paprika","cumin","coriander","turmeric","garam masala","cinnamon","nutmeg","cardamom","clove","fennel","allspice","cayenne","chilli powder","oregano","bay leaf","star anise","sumac","spice","seasoning","powder","flake"] },
  { id:"other",   label:"Other",               emoji:"🛒", keywords:[] },
];

function getCat(id) { return CATEGORIES.find(c => c.id === id) || CATEGORIES[3]; }
function uid() { return Math.random().toString(36).slice(2, 10); }

function getShopCat(itemName) {
  const name = itemName.toLowerCase();
  for (const cat of SHOP_CATS) {
    if (cat.id === "other") continue;
    if (cat.keywords.some(k => name.includes(k))) return cat.id;
  }
  return "other";
}

async function importFromUrl(url) {
  let pageText = "";
  const proxies = [
    { url: `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, type: "allorigins" },
    { url: `https://corsproxy.io/?${encodeURIComponent(url)}`, type: "text" },
  ];
  for (const proxy of proxies) {
    try {
      const proxyRes = await fetch(proxy.url);
      if (!proxyRes.ok) continue;
      let raw = "";
      if (proxy.type === "allorigins") {
        const json = await proxyRes.json();
        raw = json.contents || "";
      } else {
        raw = await proxyRes.text();
      }
      if (raw.length > 500) {
        pageText = raw
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 6000);
        break;
      }
    } catch { continue; }
  }
  if (!pageText) throw new Error("Could not fetch page");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1500, messages:[{ role:"user",
      content:`Extract the recipe from the following webpage text and return ONLY a JSON object (no markdown, no extra text) with these fields: name (string), emoji (single relevant emoji), time (string like "30 min"), serves (number), category (one of: spice-blends, meat-times, breakfast, mains, baking, sweet-treats), ingredients (array of {amount, item}), steps (array of strings), notes (string). Webpage text:\n\n${pageText}` }] })
  });
  const data = await res.json();
  const text = data.content?.map(b => b.text||"").join("") || "";
  return JSON.parse(text.replace(/```json|```/g,"").trim());
}

function cleanIngredient(item) {
  return item
    .replace(/\(.*?\)/g, "")
    .replace(/,.*$/, "")
    .replace(/\b(diced|chopped|sliced|minced|grated|crushed|beaten|melted|softened|peeled|halved|cubed|shredded|finely|roughly|thinly|lightly|bruised|deboned|boneless|divided|fried|roasted|blended|optional|separated|sifted|rinsed|drained|thawed|trimmed|washed)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function addAmounts(a, b) {
  if (!a || a === b) return a;
  if (!b) return a;
  const UNITS = ["g","kg","ml","l","cup","cups","tsp","tbsp","tbs","oz","lb"];
  function parse(str) {
    const fracs = {"½":0.5,"¼":0.25,"¾":0.75,"⅓":0.333,"⅔":0.667,"⅛":0.125};
    let clean = str.trim().toLowerCase();
    for (const [f, v] of Object.entries(fracs)) clean = clean.replace(f, ` ${v} `);
    const parts = clean.trim().split(/\s+/);
    const nums = []; const units = [];
    for (const p of parts) {
      if (!isNaN(p) && p !== "") nums.push(parseFloat(p));
      else if (UNITS.includes(p)) units.push(p);
    }
    const num = nums.reduce((a,b) => a+b, 0);
    const unit = units[0] || "";
    return num > 0 ? { num, unit } : null;
  }
  const pa = parse(a); const pb = parse(b);
  if (pa && pb && pa.unit === pb.unit) {
    const total = pa.num + pb.num;
    const fmtNum = (n) => {
      if (n === Math.floor(n)) return String(n);
      const fracs = [[0.5,"½"],[0.25,"¼"],[0.75,"¾"],[0.333,"⅓"],[0.667,"⅔"]];
      const whole = Math.floor(n); const frac = n - whole;
      for (const [v, sym] of fracs) if (Math.abs(frac - v) < 0.05) return whole > 0 ? `${whole}${sym}` : sym;
      return n.toFixed(1);
    };
    return pa.unit ? `${fmtNum(total)} ${pa.unit}` : fmtNum(total);
  }
  if (a === b) return a;
  return `${a} + ${b}`;
}

export default function App() {
  const [recipes, setRecipes]           = useState(null);
  const [plan, setPlan]                 = useState(null);
  const [extraItems, setExtraItems]     = useState(null);
  const [skipped, setSkipped]           = useState(null);
  const [tab, setTab]                   = useState("cookbook");
  const [activeCat, setActiveCat]       = useState("mains");
  const [view, setView]                 = useState(null);
  const [checkedItems, setCheckedItems] = useState({});
  const [newExtra, setNewExtra]         = useState({name:"",amount:""});
  const [confirmReset, setConfirmReset] = useState(false);
  const [importing, setImporting]       = useState(false);
  const [importUrl, setImportUrl]       = useState("");
  const [importError, setImportError]   = useState("");
  const [copied, setCopied]             = useState(false);
  const extraRef = useRef(null);
  const importRef = useRef(null);

  function exportJSON() {
    const data = { recipes, plan, extras: extraItems, skipped, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "recipe-binder.json"; a.click();
    URL.revokeObjectURL(url);
  }

  function exportGoogleDoc() {
    const lines = ["MY RECIPE BINDER", `Exported ${new Date().toLocaleDateString("en-AU",{day:"numeric",month:"long",year:"numeric"})}`, ""];
    CATEGORIES.forEach(cat => {
      const recs = recipes.filter(r => r.category === cat.id);
      if (!recs.length) return;
      lines.push("════════════════════════════════", cat.label.toUpperCase(), "════════════════════════════════");
      recs.forEach(rec => {
        lines.push("", `${rec.emoji}  ${rec.name}`);
        if (rec.category === "meat-times" && rec.rows?.length) {
          lines.push("", "Cut / Doneness          Temp        Time              Oven       Rest");
          lines.push("─────────────────────────────────────────────────────────────────────");
          rec.rows.forEach(row => lines.push(`${row.doneness.padEnd(24)}${row.temp.padEnd(12)}${row.time.padEnd(18)}${row.oven.padEnd(11)}${row.rest}`));
        } else if (rec.ingredients?.length) {
          lines.push("", "Ingredients:");
          rec.ingredients.forEach(ing => lines.push(`  • ${ing.amount}  ${ing.item}`));
        }
        if (rec.steps?.length) { lines.push("", "Method:"); rec.steps.forEach((s,i) => lines.push(`  ${i+1}. ${s}`)); }
        if (rec.notes) lines.push("", `Notes: ${rec.notes}`);
        lines.push("");
      });
    });
    const blob = new Blob([lines.join("\n")], { type:"text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "recipe-binder.txt"; a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportJSON(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (data.recipes) { setRecipes(data.recipes); saveData(STORAGE_KEYS.recipes, data.recipes); }
        if (data.plan)    { setPlan(data.plan); saveData(STORAGE_KEYS.plan, data.plan); }
        if (data.extras)  { setExtraItems(data.extras); saveData(STORAGE_KEYS.extras, data.extras); }
        if (data.skipped) { setSkipped(data.skipped); saveData(STORAGE_KEYS.skipped, data.skipped); }
        setView({ type:"importSuccess" });
      } catch { alert("Couldn't read that file."); }
    };
    reader.readAsText(file); e.target.value = "";
  }

  useEffect(() => {
    const r = loadData(STORAGE_KEYS.recipes);
    setRecipes(r || []);
    const p = loadData(STORAGE_KEYS.plan);
    if (p && !Array.isArray(p)) setPlan([...new Set(Object.values(p).filter(Boolean))]);
    else setPlan(p || []);
    setExtraItems(loadData(STORAGE_KEYS.extras) || []);
    setSkipped(loadData(STORAGE_KEYS.skipped) || []);
  }, []);

  useEffect(() => { if (recipes !== null) saveData(STORAGE_KEYS.recipes, recipes); }, [recipes]);
  useEffect(() => { if (plan !== null)    saveData(STORAGE_KEYS.plan, plan); }, [plan]);
  useEffect(() => { if (extraItems !== null) saveData(STORAGE_KEYS.extras, extraItems); }, [extraItems]);
  useEffect(() => { if (skipped !== null) saveData(STORAGE_KEYS.skipped, skipped); }, [skipped]);

  if (!recipes || !plan || !extraItems || !skipped) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",fontFamily:"'Lora',serif",color:"#8a7a6a",fontSize:16,background:"#faf7f3"}}>
      Opening your binder…
    </div>
  );

  const catRecipes = recipes.filter(r => r.category === activeCat);
  const viewedRecipe = view?.type === "recipe" ? recipes.find(r => r.id === view.id) : null;
  const plannedIds = [...new Set(plan||[])];

  const shopIngredients = plannedIds.flatMap(id => {
    const rec = recipes.find(r => r.id === id);
    return rec ? rec.ingredients.map((ing,idx) => ({
      ...ing,
      displayItem: cleanIngredient(ing.item),
      recipeId: id,
      skipKey: `${id}-${idx}`
    })).filter(ing => !(skipped||[]).includes(ing.skipKey)) : [];
  });

  const STOP_WORDS = new Set(["diced","chopped","sliced","minced","grated","crushed",
    "fresh","dried","frozen","cooked","raw","whole","large","small","medium","finely",
    "roughly","thinly","bite","sized","cut","halved","cubed","shredded","peeled",
    "optional","to","serve","taste","topped","sprigs","bunch","handful","pinch","can",
    "tin","packet","jar","bottle","bag","head","clove","cloves","stalk","stalks",
    "stick","sticks","ripe","lightly","bruised","deboned","boneless","stripped","mixed"]);

  function normWord(w) {
    if (w.length > 4 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
    return w;
  }

  const grouped = {};
  shopIngredients.forEach(ing => {
    const base = (ing.displayItem || ing.item).toLowerCase()
      .replace(/[^a-z\s]/g, "")
      .split(/[\s,]+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w))
      .map(w => normWord(w))
      .sort()
      .join("");
    if (!grouped[base]) {
      grouped[base] = {...ing, item: ing.displayItem || ing.item, sources:[ing.recipeId]};
    } else {
      if (!grouped[base].sources.includes(ing.recipeId)) grouped[base].sources.push(ing.recipeId);
      grouped[base].amount = addAmounts(grouped[base].amount, ing.amount);
    }
  });
  const shopItems = Object.values(grouped);

  const shopByCategory = SHOP_CATS.map(cat => ({
    ...cat,
    items: shopItems.filter(item => getShopCat(item.item) === cat.id)
  })).filter(cat => cat.items.length > 0);

  function saveRecipe(rec) {
    if (rec.id) setRecipes(p => p.map(r => r.id === rec.id ? rec : r));
    else setRecipes(p => [...p, {...rec, id:uid()}]);
    setView(null);
  }
  function deleteRecipe(id) { setRecipes(p => p.filter(r => r.id !== id)); setView(null); }

  async function handleImport() {
    if (!importUrl.trim()) return;
    setImporting(true); setImportError("");
    try {
      const rec = await importFromUrl(importUrl.trim());
      setImportUrl("");
      setView({type:"editor", recipe:{...rec, id:null, source:importUrl.trim()}});
    } catch { setImportError("Couldn't import — try adding manually."); }
    setImporting(false);
  }

  if (view?.type === "importSuccess") return (
    <Screen>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flex:1,padding:32,textAlign:"center"}}>
        <div style={{fontSize:56,marginBottom:16}}>✅</div>
        <div style={{fontFamily:"'Lora',serif",fontSize:20,color:"#2a1f14",marginBottom:8}}>Restored!</div>
        <div style={{fontSize:14,color:"#8a7a6a",marginBottom:24}}>Your recipes have been loaded.</div>
        <button style={{...S.pill,background:"#2a1f14",color:"#fff",border:"none",padding:"10px 28px"}} onClick={() => setView(null)}>Back to cookbook</button>
      </div>
    </Screen>
  );

  if (view?.type === "editor") return <RecipeEditor recipe={view.recipe} onSave={saveRecipe} onCancel={() => setView(null)} />;

  if (view?.type === "recipe" && viewedRecipe) {
    const cat = getCat(viewedRecipe.category);
    const isMeat = viewedRecipe.category === "meat-times";
    const isSpice = viewedRecipe.category === "spice-blends";
    const inPlan = (plan||[]).includes(viewedRecipe.id);
    return (
      <Screen>
        <div style={{background:"#fff",borderBottom:"1px solid #f0ebe3",position:"sticky",top:0,zIndex:10}}>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 16px"}}>
            <button style={S.iconBtn} onClick={() => setView(null)}>←</button>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontFamily:"'Lora',serif",fontSize:17,color:"#2a1f14",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{viewedRecipe.emoji} {viewedRecipe.name}</div>
              <div style={{fontSize:11,color:"#8a7a6a",marginTop:1}}>
                {!isMeat && !isSpice && <>{viewedRecipe.time} · </>}
                <span style={{color:cat.color}}>{cat.label}</span>
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:8,padding:"0 16px 12px",overflowX:"auto"}}>
            {!isMeat && !isSpice && (
              <button style={{...S.pill,background:inPlan?"#e8f7f1":"#f0ebe5",color:inPlan?"#2aaa8a":"#3a7fcf",border:`1px solid ${inPlan?"#2aaa8a44":"#3a7fcf44"}`}}
                onClick={() => inPlan ? setPlan(p=>p.filter(id=>id!==viewedRecipe.id)) : setPlan(p=>[...(p||[]),viewedRecipe.id])}>
                {inPlan ? "✓ In plan" : "+ Add to plan"}
              </button>
            )}
            <button style={{...S.pill,color:cat.color,border:`1px solid ${cat.color}44`}} onClick={() => setView({type:"editor",recipe:viewedRecipe})}>Edit</button>
            <button style={{...S.pill,color:"#c0392b",border:"1px solid #c0392b33"}} onClick={() => deleteRecipe(viewedRecipe.id)}>Delete</button>
          </div>
        </div>
        <div style={{padding:"16px"}}>
          {isMeat ? (
            <>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}>
                <div style={S.secLabel}>Times & temps</div>
                <div style={{fontSize:11,color:"#8a7a6a"}}>Tick to add to shopping</div>
              </div>
              {(viewedRecipe.rows||[]).map((row,i) => {
                const meatKey = `meat-${viewedRecipe.id}-${i}`;
                const inList = (extraItems||[]).some(e => e.id === meatKey);
                return (
                  <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 12px",marginBottom:6,background:inList?"#f0fbf7":"#fff",borderRadius:10,border:`1px solid ${inList?"#2aaa8a33":"#f0ebe3"}`,cursor:"pointer"}}
                    onClick={() => inList ? setExtraItems(p=>p.filter(e=>e.id!==meatKey)) : setExtraItems(p=>[...p,{id:meatKey,name:`${viewedRecipe.emoji} ${row.doneness}`,amount:""}])}>
                    <input type="checkbox" checked={inList} onChange={()=>{}} style={{accentColor:"#2aaa8a",flexShrink:0,width:18,height:18}} />
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:500,color:inList?"#2aaa8a":"#2a1f14"}}>{row.doneness}</div>
                      <div style={{fontSize:11,color:"#8a7a6a",marginTop:2}}>{row.time} · {row.oven} · rest {row.rest}</div>
                    </div>
                    <span style={{fontSize:12,fontWeight:500,color:cat.color,background:cat.bg,padding:"2px 8px",borderRadius:4}}>{row.temp}</span>
                  </div>
                );
              })}
            </>
          ) : (
            <>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}>
                <div style={S.secLabel}>Ingredients</div>
                <div style={{fontSize:11,color:"#8a7a6a"}}>{isSpice ? "Tick to add to shopping" : "Untick if you have it"}</div>
              </div>
              {viewedRecipe.ingredients.map((ing,i) => {
                const extraKey = `spice-${viewedRecipe.id}-${i}`;
                const skipKey = `${viewedRecipe.id}-${i}`;
                const spiceAdded = isSpice && (extraItems||[]).some(e=>e.id===extraKey);
                const isSkipped = !isSpice && (skipped||[]).includes(skipKey);
                return (
                  <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",marginBottom:4,background:spiceAdded?"#f0fbf7":isSkipped?"#faf7f3":"#fff",borderRadius:8,border:"1px solid #f0ebe3",opacity:isSkipped?0.5:1,cursor:"pointer"}}
                    onClick={() => {
                      if (isSpice) { if (spiceAdded) setExtraItems(p=>p.filter(e=>e.id!==extraKey)); else setExtraItems(p=>[...p,{id:extraKey,name:ing.item,amount:ing.amount}]); }
                      else { if (isSkipped) setSkipped(p=>p.filter(k=>k!==skipKey)); else setSkipped(p=>[...p,skipKey]); }
                    }}>
                    <input type="checkbox" checked={isSpice ? spiceAdded : !isSkipped} onChange={()=>{}} style={{accentColor:isSpice?"#2aaa8a":cat.color,flexShrink:0,width:18,height:18}} />
                    <div style={{flex:1}}><span style={{fontSize:13,color:spiceAdded?"#2aaa8a":isSkipped?"#aaa":"#2a1f14",textDecoration:isSkipped?"line-through":"none"}}>{ing.item}</span></div>
                    <span style={{fontSize:12,color:"#8a7a6a"}}>{ing.amount}</span>
                  </div>
                );
              })}
              {!isSpice && viewedRecipe.steps?.length > 0 && (
                <>
                  <div style={{...S.secLabel,marginTop:20,marginBottom:10}}>Method</div>
                  {viewedRecipe.steps.map((step,i) => (
                    <div key={i} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:"1px solid #f5f0ea"}}>
                      <div style={{width:22,height:22,borderRadius:"50%",background:cat.bg,color:cat.color,fontSize:11,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</div>
                      <span style={{fontSize:13,color:"#3a2e24",lineHeight:1.7}}>{step}</span>
                    </div>
                  ))}
                </>
              )}
              {viewedRecipe.notes && <div style={{marginTop:16,borderLeft:`3px solid ${cat.color}`,paddingLeft:12}}><div style={{fontSize:10,fontWeight:700,color:cat.color,textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:4}}>Notes</div><div style={{fontSize:13,color:"#5a4a3a",lineHeight:1.6}}>{viewedRecipe.notes}</div></div>}
            </>
          )}
          {isMeat && viewedRecipe.notes && <div style={{marginTop:16,borderLeft:`3px solid ${cat.color}`,paddingLeft:12}}><div style={{fontSize:10,fontWeight:700,color:cat.color,textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:4}}>Notes</div><div style={{fontSize:13,color:"#5a4a3a",lineHeight:1.6}}>{viewedRecipe.notes}</div></div>}
        </div>
      </Screen>
    );
  }

  if (view?.type === "addimport") return (
    <Screen>
      <div style={{background:"#fff",borderBottom:"1px solid #f0ebe3",display:"flex",alignItems:"center",gap:10,padding:"14px 16px",position:"sticky",top:0}}>
        <button style={S.iconBtn} onClick={() => setView(null)}>←</button>
        <div style={{fontFamily:"'Lora',serif",fontSize:17,color:"#2a1f14"}}>Add a recipe</div>
      </div>
      <div style={{padding:"20px 16px",display:"flex",flexDirection:"column",gap:12}}>
        <div style={{fontSize:13,color:"#8a7a6a"}}>Paste a URL to import, or add one from scratch.</div>
        <input style={S.input} placeholder="https://website.com/recipe…" value={importUrl} onChange={e=>setImportUrl(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleImport()} />
        {importError && <div style={{fontSize:12,color:"#c0392b"}}>{importError}</div>}
        <button style={{...S.bigBtn,background:importing?"#e8e0d8":"#2a1f14",color:importing?"#8a7a6a":"#fff"}} onClick={handleImport} disabled={importing}>{importing ? "Importing…" : "Import from URL"}</button>
        <div style={{display:"flex",alignItems:"center",gap:10,margin:"4px 0"}}><div style={{flex:1,height:1,background:"#e8e0d4"}}/><span style={{fontSize:12,color:"#aaa"}}>or</span><div style={{flex:1,height:1,background:"#e8e0d4"}}/></div>
        <button style={{...S.bigBtn,background:"#f5f0ea",color:"#3a2e24"}} onClick={() => setView({type:"editor",recipe:{id:null,name:"",emoji:"🍽️",category:activeCat,time:"",serves:2,ingredients:[],steps:[],rows:[],notes:"",source:""}})}>Add manually</button>
      </div>
    </Screen>
  );

  return (
    <Screen>
      <div style={{flex:1,overflowY:"auto",paddingBottom:72}}>
        {tab === "cookbook" && (
          <>
            <div style={{padding:"16px 16px 8px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontFamily:"'Lora',serif",fontSize:20,color:"#2a1f14"}}>Cookbook</div>
              <button style={S.addCircle} onClick={() => setView({type:"addimport"})}>+</button>
            </div>
            <div style={{display:"flex",gap:8,padding:"0 16px 12px",overflowX:"auto"}}>
              {CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => setActiveCat(cat.id)}
                  style={{...S.catPill,background:activeCat===cat.id?cat.color:"#f0ebe5",color:activeCat===cat.id?"#fff":"#5a4a3a",border:`1.5px solid ${activeCat===cat.id?cat.color:"transparent"}`}}>
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>
            <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:8}}>
              {catRecipes.length === 0 && <div style={{textAlign:"center",padding:"48px 0",color:"#8a7a6a",fontSize:14}}><div style={{fontSize:36,marginBottom:8}}>📂</div>No {getCat(activeCat).label.toLowerCase()} yet</div>}
              {catRecipes.map(rec => {
                const cat = getCat(rec.category);
                const inPlan = (plan||[]).includes(rec.id);
                return (
                  <div key={rec.id} style={{display:"flex",alignItems:"center",gap:12,padding:"14px",background:"#fff",borderRadius:14,border:`1px solid ${inPlan?cat.color+"44":"#f0ebe3"}`,borderLeft:`4px solid ${cat.color}`,cursor:"pointer"}}
                    onClick={() => setView({type:"recipe",id:rec.id})}>
                    <span style={{fontSize:26,flexShrink:0}}>{rec.emoji}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontFamily:"'Lora',serif",fontSize:14,color:"#2a1f14",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{rec.name}</div>
                      <div style={{fontSize:11,color:"#8a7a6a",marginTop:2}}>{rec.category!=="spice-blends"&&rec.category!=="meat-times"?rec.time:""}</div>
                    </div>
                    {inPlan && <span style={{fontSize:11,color:cat.color,fontWeight:600,background:cat.bg,padding:"2px 8px",borderRadius:20,flexShrink:0}}>In plan</span>}
                    <span style={{color:"#ccc",fontSize:18}}>›</span>
                  </div>
                );
              })}
            </div>
            <div style={{margin:"24px 16px 0",background:"#fff",borderRadius:14,border:"1px solid #f0ebe3",overflow:"hidden"}}>
              <div style={{padding:"12px 16px",borderBottom:"1px solid #f0ebe3"}}><div style={{fontSize:12,fontWeight:700,letterSpacing:"0.6px",textTransform:"uppercase",color:"#8a7a6a"}}>Backup & restore</div></div>
              <div style={{display:"flex",flexDirection:"column"}}>
                <button style={S.settingsRow} onClick={exportJSON}><span style={{fontSize:20}}>📥</span><div style={{flex:1}}><div style={{fontSize:14,color:"#2a1f14"}}>Download JSON backup</div><div style={{fontSize:11,color:"#8a7a6a"}}>Full backup of all your recipes & data</div></div><span style={{color:"#ccc"}}>›</span></button>
                <button style={{...S.settingsRow,borderTop:"1px solid #f5f0ea"}} onClick={exportGoogleDoc}><span style={{fontSize:20}}>📄</span><div style={{flex:1}}><div style={{fontSize:14,color:"#2a1f14"}}>Export as text file</div><div style={{fontSize:11,color:"#8a7a6a"}}>Readable format, upload to Google Docs</div></div><span style={{color:"#ccc"}}>›</span></button>
                <button style={{...S.settingsRow,borderTop:"1px solid #f5f0ea"}} onClick={() => importRef.current?.click()}><span style={{fontSize:20}}>📤</span><div style={{flex:1}}><div style={{fontSize:14,color:"#2a1f14"}}>Restore from backup</div><div style={{fontSize:11,color:"#8a7a6a"}}>Import a recipe-binder.json file</div></div><span style={{color:"#ccc"}}>›</span></button>
                <input ref={importRef} type="file" accept=".json" style={{display:"none"}} onChange={handleImportJSON} />
              </div>
            </div>
            <div style={{padding:"16px 16px 8px",display:"flex",justifyContent:"center"}}>
              {!confirmReset
                ? <button style={{fontSize:11,color:"#ccc",background:"none",border:"none",cursor:"pointer"}} onClick={()=>setConfirmReset(true)}>↺ Reset to defaults</button>
                : <div style={{display:"flex",gap:8,alignItems:"center"}}><span style={{fontSize:12,color:"#8a7a6a"}}>Wipe & reload?</span><button style={{...S.pill,background:"#c0392b",color:"#fff",border:"none"}} onClick={()=>{saveData(STORAGE_KEYS.recipes,[]);setRecipes([]);setConfirmReset(false);}}>Yes</button><button style={{...S.pill,background:"#f0ebe5",color:"#5a4a3a",border:"none"}} onClick={()=>setConfirmReset(false)}>No</button></div>
              }
            </div>
          </>
        )}
        {tab === "plan" && (
          <>
            <div style={{padding:"16px 16px 12px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontFamily:"'Lora',serif",fontSize:20,color:"#2a1f14"}}>This week</div>
              <div style={{display:"flex",gap:8}}>
                {(plan||[]).length>0 && <button style={{...S.pill,color:"#8a7a6a",border:"1px solid #e0d8ce"}} onClick={()=>setPlan([])}>Clear</button>}
                <button style={{...S.pill,background:"#3a7fcf",color:"#fff",border:"none"}} onClick={()=>setView({type:"planpicker"})}>+ Add</button>
              </div>
            </div>
            <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:8}}>
              {(plan||[]).length===0 && <div style={{textAlign:"center",padding:"48px 0",color:"#8a7a6a",fontSize:14}}><div style={{fontSize:36,marginBottom:8}}>📅</div>No meals planned yet</div>}
              {(plan||[]).map((recId,i) => {
                const rec = recipes.find(r=>r.id===recId);
                if (!rec) return null;
                const cat = getCat(rec.category);
                return (
                  <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"14px",background:"#fff",borderRadius:14,border:"1px solid #f0ebe3",borderLeft:`4px solid ${cat.color}`}}>
                    <span style={{fontSize:24}}>{rec.emoji}</span>
                    <div style={{flex:1,minWidth:0}}><div style={{fontFamily:"'Lora',serif",fontSize:14,color:"#2a1f14"}}>{rec.name}</div><div style={{fontSize:11,color:"#8a7a6a",marginTop:2}}>{cat.label}{rec.time&&rec.category!=="meat-times"?` · ${rec.time}`:""}</div></div>
                    <button style={{background:"none",border:"none",cursor:"pointer",color:"#ccc",fontSize:22,padding:"0 4px",lineHeight:1}} onClick={()=>setPlan(p=>p.filter((_,j)=>j!==i))}>×</button>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {tab === "plan" && view?.type === "planpicker" && (
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:50,display:"flex",alignItems:"flex-end"}} onClick={()=>setView(null)}>
            <div style={{background:"#faf7f3",borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"80vh",overflow:"auto",padding:"16px"}} onClick={e=>e.stopPropagation()}>
              <div style={{width:36,height:4,background:"#d4c9bc",borderRadius:2,margin:"0 auto 16px"}}/>
              <div style={{fontFamily:"'Lora',serif",fontSize:17,color:"#2a1f14",marginBottom:14}}>Pick a meal</div>
              {CATEGORIES.filter(c=>c.id!=="meat-times").map(cat => {
                const recs = recipes.filter(r=>r.category===cat.id);
                if (!recs.length) return null;
                return (
                  <div key={cat.id} style={{marginBottom:16}}>
                    <div style={{fontSize:11,fontWeight:700,color:cat.color,textTransform:"uppercase",letterSpacing:"0.8px",marginBottom:8}}>{cat.label}</div>
                    {recs.map(rec => (
                      <div key={rec.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px",background:"#fff",borderRadius:10,border:"1px solid #f0ebe3",marginBottom:6,cursor:"pointer"}}
                        onClick={()=>{setPlan(p=>[...(p||[]),rec.id]);setView(null);}}>
                        <span style={{fontSize:20}}>{rec.emoji}</span>
                        <span style={{flex:1,fontSize:13,color:"#2a1f14"}}>{rec.name}</span>
                        <span style={{fontSize:11,color:"#8a7a6a"}}>{rec.time}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {tab === "shopping" && (
          <>
            <div style={{padding:"16px 16px 12px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{fontFamily:"'Lora',serif",fontSize:20,color:"#2a1f14"}}>Shopping</div>
              {(shopItems.length>0||(extraItems||[]).length>0) && (
                <div style={{display:"flex",gap:8}}>
                  <button style={{...S.pill,color:"#8a7a6a",border:"1px solid #e0d8ce"}} onClick={()=>{
                    const lines = [];
                    shopByCategory.forEach(cat => {
                      if (!cat.items.length) return;
                      lines.push(`${cat.emoji} ${cat.label}`);
                      cat.items.forEach(item => {
                        let amountStr = "";
                        if (item.sources.length > 1) {
                          const srcAmounts = item.sources.map(srcId => {
                            const rec = recipes.find(r => r.id === srcId);
                            if (!rec) return item.amount;
                            const ing = rec.ingredients.find(i => cleanIngredient(i.item).toLowerCase() === item.item.toLowerCase());
                            return ing ? ing.amount : item.amount;
                          });
                          const allSame = srcAmounts.every(a => a === srcAmounts[0]);
                          const hasMeasure = srcAmounts[0] && /\d/.test(srcAmounts[0]) && /g|kg|ml|l|cup|tsp|tbs|tbsp|oz|lb/.test(srcAmounts[0]);
                          if (allSame && srcAmounts[0] && hasMeasure) {
                            amountStr = `  ${item.sources.length} x ${srcAmounts[0]}`;
                          } else {
                            amountStr = item.amount ? `  ${item.amount}` : "";
                          }
                        } else if (item.amount) {
                          amountStr = `  ${item.amount}`;
                        }
                        lines.push(`  • ${item.item}${amountStr}`);
                      });
                      lines.push("");
                    });
                    if ((extraItems||[]).length) {
                      lines.push("✏️ Other");
                      extraItems.forEach(item => lines.push(`  • ${item.name}${item.amount ? "  " + item.amount : ""}`));
                    }
                    navigator.clipboard.writeText(lines.join("\n")).then(()=>setCopied(true)).then(()=>setTimeout(()=>setCopied(false),2000));
                  }}>{copied ? "✓ Copied!" : "📋 Copy"}</button>
                  <button style={{...S.pill,color:"#8a7a6a",border:"1px solid #e0d8ce"}} onClick={()=>setCheckedItems({})}>Clear ticks</button>
                </div>
              )}
            </div>
            <div style={{padding:"0 16px",display:"flex",flexDirection:"column",gap:0}}>
              {shopItems.length===0 && (extraItems||[]).length===0 && (
                <div style={{textAlign:"center",padding:"48px 0",color:"#8a7a6a",fontSize:14}}>
                  <div style={{fontSize:36,marginBottom:8}}>🛒</div>Add meals to your plan first
                </div>
              )}
              {shopByCategory.map(cat => (
                <div key={cat.id} style={{marginBottom:16}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#8a7a6a",textTransform:"uppercase",letterSpacing:"0.8px",padding:"4px 0 8px",display:"flex",alignItems:"center",gap:6}}>
                    <span>{cat.emoji}</span>{cat.label}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {cat.items.map((item,i) => {
                      const k = `r${cat.id}${i}`;
                      return (
                        <div key={k} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 14px",background:"#fff",borderRadius:12,border:"1px solid #f0ebe3",cursor:"pointer",opacity:checkedItems[k]?0.4:1}}
                          onClick={()=>setCheckedItems(p=>({...p,[k]:!p[k]}))}>
                          <input type="checkbox" checked={!!checkedItems[k]} onChange={()=>{}} style={{accentColor:"#2aaa8a",width:18,height:18,flexShrink:0}} />
                          <span style={{flex:1,fontSize:14,color:"#2a1f14",textDecoration:checkedItems[k]?"line-through":"none"}}>{item.item}</span>
                          <span style={{fontSize:12,color:"#8a7a6a",marginRight:6}}>{item.amount}</span>
                          <div style={{display:"flex",gap:3}}>
                            {item.sources.map((srcId,j) => {
                              const srcRec = recipes.find(r=>r.id===srcId);
                              const c = srcRec ? getCat(srcRec.category) : {color:"#aaa"};
                              return <div key={j} style={{width:7,height:7,borderRadius:"50%",background:c.color}} title={srcRec?.name||""} />;
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {(extraItems||[]).length > 0 && (
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:11,fontWeight:700,color:"#8a7a6a",textTransform:"uppercase",letterSpacing:"0.8px",padding:"4px 0 8px",display:"flex",alignItems:"center",gap:6}}>
                    <span>✏️</span>Added manually
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {(extraItems||[]).map(item => {
                      const k = "e"+item.id;
                      return (
                        <div key={k} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 14px",background:"#fff",borderRadius:12,border:"1px solid #f0ebe3",opacity:checkedItems[k]?0.4:1}}>
                          <input type="checkbox" checked={!!checkedItems[k]} onChange={()=>setCheckedItems(p=>({...p,[k]:!p[k]}))} style={{accentColor:"#2aaa8a",width:18,height:18,flexShrink:0}} onClick={e=>e.stopPropagation()} />
                          <span style={{flex:1,fontSize:14,color:"#2a1f14",textDecoration:checkedItems[k]?"line-through":"none",cursor:"pointer"}} onClick={()=>setCheckedItems(p=>({...p,[k]:!p[k]}))}>{item.name}</span>
                          <span style={{fontSize:12,color:"#8a7a6a",marginRight:4}}>{item.amount}</span>
                          <button style={{background:"none",border:"none",cursor:"pointer",color:"#ccc",fontSize:20,padding:0,lineHeight:1}} onClick={()=>setExtraItems(p=>p.filter(e=>e.id!==item.id))}>×</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div style={{display:"flex",gap:8,marginTop:4,paddingTop:14,borderTop:"1px dashed #e0d8ce"}}>
                <input ref={extraRef} value={newExtra.name} onChange={e=>setNewExtra(p=>({...p,name:e.target.value}))}
                  onKeyDown={e=>{if(e.key==="Enter"&&newExtra.name.trim()){setExtraItems(p=>[...p,{id:uid(),name:newExtra.name.trim(),amount:newExtra.amount.trim()}]);setNewExtra({name:"",amount:""});extraRef.current?.focus();}}}
                  placeholder="Add item…" style={{...S.input,flex:1}} />
                <input value={newExtra.amount} onChange={e=>setNewExtra(p=>({...p,amount:e.target.value}))}
                  onKeyDown={e=>{if(e.key==="Enter"&&newExtra.name.trim()){setExtraItems(p=>[...p,{id:uid(),name:newExtra.name.trim(),amount:newExtra.amount.trim()}]);setNewExtra({name:"",amount:""});extraRef.current?.focus();}}}
                  placeholder="Qty" style={{...S.input,width:64}} />
                <button style={{...S.pill,background:newExtra.name.trim()?"#2aaa8a":"#e8e0d8",color:newExtra.name.trim()?"#fff":"#bbb",border:"none",padding:"0 16px",flexShrink:0}}
                  disabled={!newExtra.name.trim()}
                  onClick={()=>{if(!newExtra.name.trim())return;setExtraItems(p=>[...p,{id:uid(),name:newExtra.name.trim(),amount:newExtra.amount.trim()}]);setNewExtra({name:"",amount:""});}}>Add</button>
              </div>
            </div>
          </>
        )}
      </div>
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#fff",borderTop:"1px solid #f0ebe3",display:"flex",zIndex:20,paddingBottom:"env(safe-area-inset-bottom)"}}>
        {[{id:"cookbook",label:"Cookbook",icon:"📖"},{id:"plan",label:"Plan",icon:"📅"},{id:"shopping",label:"Shopping",icon:"🛒"}].map(t => (
          <button key={t.id} style={{flex:1,padding:"10px 0 8px",background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}
            onClick={()=>{setTab(t.id);if(view?.type==="planpicker")setView(null);}}>
            <span style={{fontSize:20}}>{t.icon}</span>
            <span style={{fontSize:10,fontWeight:tab===t.id?700:400,color:tab===t.id?"#2a1f14":"#aaa",letterSpacing:"0.3px"}}>{t.label}</span>
            {tab===t.id && <div style={{width:16,height:2,background:"#C2714F",borderRadius:1,marginTop:1}}/>}
          </button>
        ))}
      </div>
    </Screen>
  );
}

function Screen({children}) {
  return <div style={{minHeight:"100vh",background:"#faf7f3",fontFamily:"'Crimson Pro',serif",display:"flex",flexDirection:"column",maxWidth:480,margin:"0 auto",position:"relative"}}>{children}</div>;
}

function RecipeEditor({recipe, onSave, onCancel}) {
  const [form, setForm] = useState({
    id:recipe.id||null, name:recipe.name||"", emoji:recipe.emoji||"🍽️",
    category:recipe.category||"mains", time:recipe.time||"", serves:recipe.serves||2,
    ingredients:recipe.ingredients?.length?recipe.ingredients:[{amount:"",item:""}],
    steps:recipe.steps?.length?recipe.steps:[""],
    rows:recipe.rows?.length?recipe.rows:[{doneness:"",temp:"",time:"",oven:"",rest:""}],
    notes:recipe.notes||"", source:recipe.source||"",
  });
  const [showPicker, setShowPicker] = useState(false);

  function f(k,v){setForm(p=>({...p,[k]:v}));}
  function setIng(i,k,v){setForm(p=>{const a=[...p.ingredients];a[i]={...a[i],[k]:v};return{...p,ingredients:a};});}
  function addIng(){setForm(p=>({...p,ingredients:[...p.ingredients,{amount:"",item:""}]}));}
  function removeIng(i){setForm(p=>({...p,ingredients:p.ingredients.filter((_,j)=>j!==i)}));}
  function setStep(i,v){setForm(p=>{const a=[...p.steps];a[i]=v;return{...p,steps:a};});}
  function addStep(){setForm(p=>({...p,steps:[...p.steps,""]}));}
  function removeStep(i){setForm(p=>({...p,steps:p.steps.filter((_,j)=>j!==i)}));}
  function setRow(i,k,v){setForm(p=>{const a=[...p.rows];a[i]={...a[i],[k]:v};return{...p,rows:a};});}
  function addRow(){setForm(p=>({...p,rows:[...p.rows,{doneness:"",temp:"",time:"",oven:"",rest:""}]}));}
  function removeRow(i){setForm(p=>({...p,rows:p.rows.filter((_,j)=>j!==i)}));}

  const cat = getCat(form.category);
  const isMeat = form.category==="meat-times";
  const isSpice = form.category==="spice-blends";

  return (
    <div style={{minHeight:"100vh",background:"#faf7f3",fontFamily:"'Crimson Pro',serif",maxWidth:480,margin:"0 auto"}}>
      <div style={{background:"#fff",borderBottom:"1px solid #f0ebe3",display:"flex",alignItems:"center",gap:10,padding:"14px 16px",position:"sticky",top:0,zIndex:10}}>
        <button style={S.iconBtn} onClick={onCancel}>←</button>
        <div style={{flex:1,fontFamily:"'Lora',serif",fontSize:17,color:"#2a1f14"}}>{form.id?"Edit":"New recipe"}</div>
        <button style={{...S.pill,background:cat.color,color:"#fff",border:"none"}} onClick={()=>onSave(form)}>Save</button>
      </div>
      <div style={{padding:"16px",display:"flex",flexDirection:"column",gap:16,paddingBottom:40}}>
        <div style={{display:"flex",gap:10,alignItems:"center",position:"relative"}}>
          <button onClick={()=>setShowPicker(p=>!p)} style={{width:52,height:52,fontSize:26,background:"#fff",border:"1px solid #e0d8ce",borderRadius:12,cursor:"pointer",flexShrink:0}}>{form.emoji}</button>
          {showPicker && (
            <div style={{position:"absolute",top:58,left:0,zIndex:100,background:"#fff",border:"1px solid #e0d8ce",borderRadius:16,boxShadow:"0 8px 32px rgba(0,0,0,0.12)",width:280,maxHeight:300,overflowY:"auto",padding:12}}>
              {EMOJI_GROUPS.map(g=>(
                <div key={g.label} style={{marginBottom:10}}>
                  <div style={{fontSize:10,fontWeight:700,color:"#8a7a6a",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:6}}>{g.label}</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                    {g.emojis.map(e=><button key={e} onClick={()=>{f("emoji",e);setShowPicker(false);}} style={{width:34,height:34,fontSize:20,background:form.emoji===e?"#f0ebe5":"transparent",border:form.emoji===e?"1px solid #c8b89a":"1px solid transparent",borderRadius:8,cursor:"pointer"}}>{e}</button>)}
                  </div>
                </div>
              ))}
              <div style={{borderTop:"1px solid #f0ebe3",paddingTop:8}}>
                <input value={form.emoji} onChange={e=>f("emoji",e.target.value)} maxLength={2} style={{...S.input,textAlign:"center",fontSize:20}} placeholder="✏️"/>
              </div>
            </div>
          )}
          <input value={form.name} onChange={e=>f("name",e.target.value)} placeholder="Recipe name" style={{...S.input,flex:1,fontFamily:"'Lora',serif",fontSize:16}}/>
        </div>
        <div style={{display:"flex",gap:8}}>
          <div style={{flex:1.5}}><div style={S.fieldLabel}>Category</div><select value={form.category} onChange={e=>f("category",e.target.value)} style={S.input}>{CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
          {!isMeat&&!isSpice&&<div style={{flex:1}}><div style={S.fieldLabel}>Time</div><input value={form.time} onChange={e=>f("time",e.target.value)} placeholder="30 min" style={S.input}/></div>}
          {!isMeat&&!isSpice&&<div style={{width:64}}><div style={S.fieldLabel}>Serves</div><input type="number" min={1} value={form.serves} onChange={e=>f("serves",+e.target.value)} style={S.input}/></div>}
        </div>
        {isMeat ? (
          <div>
            <div style={S.secLabel}>Time & temp rows</div>
            {form.rows.map((row,i)=>(
              <div key={i} style={{display:"flex",gap:6,marginBottom:8,alignItems:"center"}}>
                <div style={{flex:1,display:"flex",flexDirection:"column",gap:4}}>
                  <input value={row.doneness} onChange={e=>setRow(i,"doneness",e.target.value)} placeholder="Cut / doneness" style={S.input}/>
                  <div style={{display:"flex",gap:4}}>
                    <input value={row.temp} onChange={e=>setRow(i,"temp",e.target.value)} placeholder="Temp" style={{...S.input,flex:1}}/>
                    <input value={row.time} onChange={e=>setRow(i,"time",e.target.value)} placeholder="Time" style={{...S.input,flex:1}}/>
                    <input value={row.oven} onChange={e=>setRow(i,"oven",e.target.value)} placeholder="Oven" style={{...S.input,flex:1}}/>
                    <input value={row.rest} onChange={e=>setRow(i,"rest",e.target.value)} placeholder="Rest" style={{...S.input,flex:1}}/>
                  </div>
                </div>
                <button style={S.removeBtn} onClick={()=>removeRow(i)}>×</button>
              </div>
            ))}
            <button style={S.ghostBtn} onClick={addRow}>+ Add row</button>
          </div>
        ) : (
          <div>
            <div style={S.secLabel}>Ingredients</div>
            {form.ingredients.map((ing,i)=>(
              <div key={i} style={{display:"flex",gap:8,marginBottom:8}}>
                <input value={ing.amount} onChange={e=>setIng(i,"amount",e.target.value)} placeholder="Amount" style={{...S.input,width:80}}/>
                <input value={ing.item} onChange={e=>setIng(i,"item",e.target.value)} placeholder="Ingredient" style={{...S.input,flex:1}}/>
                <button style={S.removeBtn} onClick={()=>removeIng(i)}>×</button>
              </div>
            ))}
            <button style={S.ghostBtn} onClick={addIng}>+ Add ingredient</button>
          </div>
        )}
        {!isSpice&&!isMeat&&(
          <div>
            <div style={S.secLabel}>Method</div>
            {form.steps.map((step,i)=>(
              <div key={i} style={{display:"flex",gap:8,marginBottom:8,alignItems:"flex-start"}}>
                <div style={{width:22,height:22,borderRadius:"50%",background:cat.bg,color:cat.color,fontSize:11,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:8}}>{i+1}</div>
                <textarea value={step} onChange={e=>setStep(i,e.target.value)} placeholder={`Step ${i+1}`} style={{...S.input,flex:1,minHeight:52,resize:"vertical"}}/>
                <button style={{...S.removeBtn,marginTop:8}} onClick={()=>removeStep(i)}>×</button>
              </div>
            ))}
            <button style={S.ghostBtn} onClick={addStep}>+ Add step</button>
          </div>
        )}
        <div><div style={S.fieldLabel}>Notes</div><textarea value={form.notes} onChange={e=>f("notes",e.target.value)} placeholder="Tips or variations…" style={{...S.input,width:"100%",minHeight:70,resize:"vertical"}}/></div>
      </div>
    </div>
  );
}

const S: any = {
  iconBtn:     {background:"none",border:"none",cursor:"pointer",fontSize:20,color:"#8a7a6a",padding:"4px 8px",lineHeight:1},
  pill:        {padding:"6px 14px",borderRadius:20,fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"},
  catPill:     {padding:"7px 14px",borderRadius:20,fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",flexShrink:0},
  addCircle:   {width:34,height:34,borderRadius:"50%",background:"#2a1f14",color:"#fff",border:"none",fontSize:22,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1},
  bigBtn:      {padding:"14px",borderRadius:12,fontSize:14,fontWeight:500,cursor:"pointer",border:"none",fontFamily:"inherit",width:"100%"},
  input:       {padding:"10px 12px",borderRadius:10,border:"1px solid #e0d8ce",fontSize:13,fontFamily:"inherit",background:"#faf7f3",color:"#3a2e24",width:"100%",outline:"none",boxSizing:"border-box"},
  secLabel:    {fontSize:11,fontWeight:700,letterSpacing:"0.8px",textTransform:"uppercase",color:"#8a7a6a",marginBottom:8},
  fieldLabel:  {fontSize:11,color:"#8a7a6a",marginBottom:4,fontWeight:500},
  removeBtn:   {background:"none",border:"none",cursor:"pointer",color:"#ccc",fontSize:20,padding:"0 4px",lineHeight:1,flexShrink:0},
  settingsRow: {display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",width:"100%",textAlign:"left"},
  ghostBtn:    {fontSize:13,color:"#8a7a6a",background:"none",border:"none",cursor:"pointer",padding:"4px 0",fontFamily:"inherit"},
};
