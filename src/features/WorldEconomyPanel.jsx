import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { WORLD_COSMETIC_CATEGORIES } from "../../shared/worldCustomization.js";

const fallback = { coins: 0, xp: 0, level: 1, progressPercent: 0, xpIntoLevel: 0, xpForNextLevel: 100, xpRemaining: 100 };
export default function WorldEconomyPanel({ onEquipped }) {
  const [data,setData] = useState(null);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState("");
  const [message,setMessage] = useState("");
  const [category,setCategory] = useState("all");
  const [search,setSearch] = useState("");
  const [collection,setCollection] = useState("all");
  const requestKeys = useRef(new Map());
  const load = useCallback(async () => {
    try { setData(await api("/world/economy?refresh="+Date.now())); }
    catch(error) { setMessage(error.message || "Your GG wallet could not be loaded."); }
    finally { setLoading(false); }
  },[]);
  useEffect(()=>{const refresh=()=>load();window.addEventListener("gg-data-changed",refresh);Promise.resolve().then(load);return()=>window.removeEventListener("gg-data-changed",refresh);},[load]);
  async function equip(item) {
    setBusy("equip:"+item.id);setMessage("");
    try { const result=await api("/world/economy/equip",{method:"POST",body:{itemId:item.id}}); if(result.avatar?.appearance)onEquipped?.(result.avatar.appearance); await load(); setMessage(item.name+" equipped to your character."); }
    catch(error) { setMessage(error.message || "Could not equip this cosmetic."); }
    finally { setBusy(""); }
  }
  async function upgradeHome() {
    setBusy("home");setMessage("");
    try { const key=requestKeys.current.get("home")||crypto.randomUUID();requestKeys.current.set("home",key);const result=await api("/world/economy/residence-upgrade",{method:"POST",body:{idempotencyKey:key}});requestKeys.current.delete("home");await load();setMessage("Your home is now level "+result.residence.level+"."); }
    catch(error) { setMessage(error.message || "Your home could not be upgraded."); }
    finally { setBusy(""); }
  }
  async function purchase(item) {
    setBusy(item.id);setMessage("");
    try {
      const key=requestKeys.current.get(item.id)||crypto.randomUUID();requestKeys.current.set(item.id,key);
      const result=await api("/world/economy/purchase",{method:"POST",body:{itemId:item.id,idempotencyKey:key}});
      requestKeys.current.delete(item.id);
      await load();
      setMessage(result.duplicate ? "Purchase already processed. Your balance is safe." : item.name+" added to your inventory.");
    } catch(error) { setMessage(error.message || "Purchase could not be completed."); }
    finally { setBusy(""); }
  }
  const wallet = data?.economy || fallback;
  const collections=[...new Set((data?.catalog||[]).map((item)=>item.collection).filter(Boolean))];
  const visibleItems=(data?.catalog||[]).filter((item)=>(category==="all"||item.category===category)&&(collection==="all"||item.collection===collection)&&(!search.trim()||(item.name+" "+item.description).toLowerCase().includes(search.trim().toLowerCase()))).sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));
  return <section className="gg-world-panel gg-economy-panel">
    <div className="gg-world-section-title"><span>YOUR ORIGINAL GG PROGRESSION</span><h2>GG Coins & experience</h2><p>Earn XP by completing your welcome tour, logging training and unlocking milestones. Spend earned coins on character cosmetics.</p></div>
    {loading ? <p className="gg-world-loading">Loading your wallet…</p> : <>
      <div className="gg-economy-summary">
        <article><span>GG COINS</span><strong>◈ {wallet.coins.toLocaleString()}</strong><small>Earned in Original GG</small></article>
        <article><span>PLAYER LEVEL</span><strong>{wallet.level}</strong><small>{wallet.xp.toLocaleString()} lifetime XP</small></article>
        <article><span>NEXT LEVEL</span><strong>{wallet.level>=100?"MAX LEVEL":wallet.xpRemaining.toLocaleString()+" XP"}</strong><small>{wallet.level>=100?"You reached the current level cap":wallet.xpIntoLevel+" / "+wallet.xpForNextLevel+" XP this level"}</small></article>
      </div>
      <div className="gg-economy-daily"><span>DAILY REWARD LIMITS · RESETS AT 00:00 UTC</span><div><small>XP remaining today</small><strong>{data?.dailyProgress?.xpRemaining ?? 250} / 250</strong></div><div><small>Coins remaining today</small><strong>{data?.dailyProgress?.coinsRemaining ?? 120} / 120</strong></div></div>
      <div className="gg-economy-progress" role="progressbar" aria-label="Experience progress to next level" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(wallet.progressPercent||0)}><span style={{width:(wallet.progressPercent||0)+"%"}}/></div>
      <div className="gg-economy-section-heading"><div><span>THE MARKET SQUARE</span><h3>Cosmetics catalogue</h3></div><small>Earned currency only · no real-money purchases</small></div>
      <div className="gg-economy-home-upgrade"><div><span>YOUR RESIDENCE</span><strong>Home level {data?.residence?.level||1} / {data?.residence?.maxLevel||10}</strong><small>Next home level requires player level {(data?.residence?.level||1)+1}.</small></div><button type="button" className="gg-world-primary" disabled={Boolean(busy)||!data?.residence?.nextUpgradeCost||wallet.coins<data.residence.nextUpgradeCost||wallet.level<(data?.residence?.level||1)+1} onClick={upgradeHome}>{busy==="home"?"Upgrading…":data?.residence?.nextUpgradeCost?"Upgrade · ◈ "+data.residence.nextUpgradeCost:"Max level"}</button></div>
      <div className="gg-market-tools">
        <label className="gg-market-search">Find an item<input type="search" value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search cosmetics…"/></label>
        <label className="gg-market-collection">Collection<select value={collection} onChange={(event)=>setCollection(event.target.value)}><option value="all">All collections</option>{collections.map((entry)=><option key={entry} value={entry}>{entry.replaceAll("-"," ")}</option>)}</select></label>
      </div>
      <div className="gg-market-categories"><button type="button" className={category==="all"?"is-active":""} onClick={()=>setCategory("all")}>All items</button>{WORLD_COSMETIC_CATEGORIES.map((entry)=><button type="button" key={entry.id} className={category===entry.id?"is-active":""} onClick={()=>setCategory(entry.id)}>{entry.label}</button>)}</div>
      <div className="gg-economy-catalog">{visibleItems.map(item=>{
        const owned=(data?.inventory||[]).find(entry=>entry.itemId===item.id);
        return <article key={item.id}><div><span>{item.rarity.toUpperCase()} · {item.category.toUpperCase()}</span><h4>{item.name}</h4><p>{item.description} {item.minLevel>wallet.level?"Unlocks at player level "+item.minLevel+".":""}</p></div><footer><strong>◈ {item.price}</strong>{owned && <button type="button" className="gg-world-primary" disabled={Boolean(busy)} onClick={()=>equip(item)}>{busy==="equip:"+item.id?"Equipping…":owned.equipped?"Equipped":"Equip"}</button>}<button type="button" className="gg-world-primary" disabled={Boolean(busy)||wallet.coins<item.price||wallet.level<(item.minLevel||1)} onClick={()=>purchase(item)}>{busy===item.id?"Buying…":wallet.level<(item.minLevel||1)?"Level "+item.minLevel+" required":owned?"Buy another":"Purchase"}</button></footer></article>;
      })}</div>
      {!visibleItems.length&&<p className="gg-economy-empty">No items match these filters. Try another category or search.</p>}
      <div className="gg-economy-section-heading"><div><span>YOUR COLLECTION</span><h3>Inventory</h3></div><small>{(data?.inventory||[]).length} item types</small></div>
      {(data?.inventory||[]).length ? <div className="gg-economy-inventory">{data.inventory.map(item=><span key={item.itemId}>{(data.catalog||[]).find(entry=>entry.id===item.itemId)?.name||item.itemId} × {item.quantity}</span>)}</div> : <p className="gg-economy-empty">Your locker is empty for now. Complete training to earn your first GG Coins.</p>}
      <div className="gg-economy-section-heading"><div><span>LONG-TERM GOALS</span><h3>Training achievements</h3></div><small>{(data?.achievements||[]).filter(entry=>entry.unlocked).length} / {(data?.achievements||[]).length} unlocked</small></div>
      <div className="gg-economy-achievements">{(data?.achievements||[]).map(entry=><article key={entry.id} className={entry.unlocked?"is-unlocked":""}><div><strong>{entry.name}</strong><small>{entry.description}</small></div><span>+{entry.xp} XP · +{entry.coins} coins</span></article>)}</div>
      <div className="gg-economy-section-heading"><div><span>YOUR RECENT ACTIVITY</span><h3>Wallet ledger</h3></div></div>
      {(data?.recentTransactions||[]).length ? <div className="gg-economy-ledger">{data.recentTransactions.slice(0,6).map((entry)=><div key={entry._id}><span>{entry.type.replaceAll("-"," ")}{entry.itemId?" · "+entry.itemId:""}</span><strong>{entry.xpDelta>0?"+"+entry.xpDelta+" XP":""}{entry.coinsDelta>0?" · +"+entry.coinsDelta+" coins":""}{entry.coinsDelta<0?" · "+entry.coinsDelta+" coins":""}</strong></div>)}</div> : <p className="gg-economy-empty">Your first reward will appear here.</p>}
    </>}
    {message&&<p className="gg-world-notice" role="status">{message}</p>}
  </section>;
}
