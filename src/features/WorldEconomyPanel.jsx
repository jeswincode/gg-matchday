import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";

const fallback = { coins: 0, xp: 0, level: 1, progressPercent: 0, xpIntoLevel: 0, xpForNextLevel: 100, xpRemaining: 100 };
export default function WorldEconomyPanel() {
  const [data,setData] = useState(null);
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState("");
  const [message,setMessage] = useState("");
  const load = useCallback(async () => {
    try { setData(await api("/world/economy?refresh="+Date.now())); }
    catch(error) { setMessage(error.message || "Your GG wallet could not be loaded."); }
    finally { setLoading(false); }
  },[]);
  useEffect(()=>{load();},[load]);
  async function equip(item) {
    setBusy("equip:"+item.id);setMessage("");
    try { await api("/world/economy/equip",{method:"POST",body:{itemId:item.id}}); await load(); setMessage(item.name+" equipped to your character."); }
    catch(error) { setMessage(error.message || "Could not equip this cosmetic."); }
    finally { setBusy(""); }
  }
  async function purchase(item) {
    setBusy(item.id);setMessage("");
    try {
      const result=await api("/world/economy/purchase",{method:"POST",body:{itemId:item.id,idempotencyKey:crypto.randomUUID()}});
      await load();
      setMessage(result.duplicate ? "Purchase already processed. Your balance is safe." : item.name+" added to your inventory.");
    } catch(error) { setMessage(error.message || "Purchase could not be completed."); }
    finally { setBusy(""); }
  }
  const wallet = data?.economy || fallback;
  return <section className="gg-world-panel gg-economy-panel">
    <div className="gg-world-section-title"><span>YOUR ORIGINAL GG PROGRESSION</span><h2>GG Coins & experience</h2><p>Earn XP by completing your welcome tour, logging training and unlocking milestones. Spend earned coins on character cosmetics.</p></div>
    {loading ? <p className="gg-world-loading">Loading your wallet…</p> : <>
      <div className="gg-economy-summary">
        <article><span>GG COINS</span><strong>◈ {wallet.coins.toLocaleString()}</strong><small>Earned in Original GG</small></article>
        <article><span>PLAYER LEVEL</span><strong>{wallet.level}</strong><small>{wallet.xp.toLocaleString()} lifetime XP</small></article>
        <article><span>NEXT LEVEL</span><strong>{wallet.level>=100?"MAX LEVEL":wallet.xpRemaining.toLocaleString()+" XP"}</strong><small>{wallet.level>=100?"You reached the current level cap":wallet.xpIntoLevel+" / "+wallet.xpForNextLevel+" XP this level"}</small></article>
      </div>
      <div className="gg-economy-progress" role="progressbar" aria-label="Experience progress to next level" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(wallet.progressPercent||0)}><span style={{width:(wallet.progressPercent||0)+"%"}}/></div>
      <div className="gg-economy-section-heading"><div><span>THE MARKET SQUARE</span><h3>Cosmetics catalogue</h3></div><small>Earned currency only · no real-money purchases</small></div>
      <div className="gg-economy-catalog">{(data?.catalog||[]).map(item=>{
        const owned=(data?.inventory||[]).find(entry=>entry.itemId===item.id);
        return <article key={item.id}><div><span>{item.rarity.toUpperCase()} · {item.category.toUpperCase()}</span><h4>{item.name}</h4><p>{item.description}</p></div><footer><strong>◈ {item.price}</strong>{owned && <button type="button" className="gg-world-primary" disabled={Boolean(busy)} onClick={()=>equip(item)}>{busy==="equip:"+item.id?"Equipping…":owned.equipped?"Equipped":"Equip"}</button>}<button type="button" className="gg-world-primary" disabled={Boolean(busy)||wallet.coins<item.price} onClick={()=>purchase(item)}>{busy===item.id?"Buying…":owned?"Buy another":"Purchase"}</button></footer></article>;
      })}</div>
      <div className="gg-economy-section-heading"><div><span>YOUR COLLECTION</span><h3>Inventory</h3></div><small>{(data?.inventory||[]).length} item types</small></div>
      {(data?.inventory||[]).length ? <div className="gg-economy-inventory">{data.inventory.map(item=><span key={item.itemId}>{(data.catalog||[]).find(entry=>entry.id===item.itemId)?.name||item.itemId} × {item.quantity}</span>)}</div> : <p className="gg-economy-empty">Your locker is empty for now. Complete training to earn your first GG Coins.</p>}
      <div className="gg-economy-section-heading"><div><span>YOUR RECENT ACTIVITY</span><h3>Wallet ledger</h3></div></div>
      {(data?.recentTransactions||[]).length ? <div className="gg-economy-ledger">{data.recentTransactions.slice(0,6).map((entry)=><div key={entry._id}><span>{entry.type.replaceAll("-"," ")}{entry.itemId?" · "+entry.itemId:""}</span><strong>{entry.xpDelta>0?"+"+entry.xpDelta+" XP":""}{entry.coinsDelta>0?" · +"+entry.coinsDelta+" coins":""}{entry.coinsDelta<0?" · "+entry.coinsDelta+" coins":""}</strong></div>)}</div> : <p className="gg-economy-empty">Your first reward will appear here.</p>}
    </>}
    {message&&<p className="gg-world-notice" role="status">{message}</p>}
  </section>;
}
