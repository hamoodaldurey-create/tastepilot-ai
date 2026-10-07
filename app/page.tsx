"use client";
import { useState } from "react";
import { Compass, Sparkles, MapPin, Utensils, Globe2, Clapperboard, Plus, X, Heart, Check, LoaderCircle, Code2, CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import type { Brief, Category, Favorite, PlanResult, Recommendation, TasteType } from "@/lib/tastepilot-types";
const labels: Record<Category, string> = { dining: "Dining", travel: "Travel", entertainment: "Entertainment" };
const icons = { dining: Utensils, travel: Globe2, entertainment: Clapperboard };
const presets: { name: string; favorites: Favorite[]; city: string }[] = [
  { name: "The film lover", favorites: [{ name: "Interstellar", type: "movie" }, { name: "Radiohead", type: "artist" }], city: "London" },
  { name: "The curious traveler", favorites: [{ name: "Spirited Away", type: "movie" }, { name: "Coldplay", type: "artist" }, { name: "Patagonia", type: "brand" }], city: "Muscat" },
  { name: "The city explorer", favorites: [{ name: "The Grand Budapest Hotel", type: "movie" }, { name: "Nike", type: "brand" }], city: "New York" },
];
export default function Home() {
  const [favorites, setFavorites] = useState<Favorite[]>([{ name: "Interstellar", type: "movie" }, { name: "Coldplay", type: "artist" }]);
  const [city, setCity] = useState("Muscat"), [priceLevel, setPriceLevel] = useState("3");
  const [categories, setCategories] = useState<Category[]>(["dining", "travel", "entertainment"]);
  const [result, setResult] = useState<PlanResult | null>(null);
  const [likedIds, setLikedIds] = useState<string[]>([]), [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false), [error, setError] = useState("");
  const [tab, setTab] = useState("all"), [submitted, setSubmitted] = useState("");
  const brief: Brief = { favorites, city, priceLevel: Number(priceLevel), categories, likedIds, excludedIds };
  const changed = !!result && JSON.stringify(brief) !== submitted;
  async function discover(event?: React.FormEvent) {
    event?.preventDefault(); if (loading) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(brief), signal: AbortSignal.timeout(65_000) });
      const data = await response.json() as PlanResult & { error?: string };
      if (!response.ok) throw new Error(data.error || "Recommendations could not be loaded.");
      setResult(data); setSubmitted(JSON.stringify(brief)); setTab("all");
    } catch (e) { setError(e instanceof Error && e.name !== "TimeoutError" ? e.message : "The search took too long. Please try again."); }
    finally { setLoading(false); }
  }
  function like(id: string) { setLikedIds(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id].slice(-20)); setExcludedIds(ids => ids.filter(i => i !== id)); }
  function hide(id: string) { setExcludedIds(ids => [...new Set([...ids, id])].slice(-20)); setLikedIds(ids => ids.filter(i => i !== id)); }
  const visible = result?.recommendations.filter(r => !excludedIds.includes(r.id)) ?? [];
  const liked = result?.recommendations.filter(r => likedIds.includes(r.id)) ?? [];
  return <div className="app-shell">
    <header className="topbar"><a href="/" className="brand"><span className="brand-icon"><Compass size={24}/></span><span>TastePilot<span className="brand-ai">AI</span></span></a><div className="topbar-right"><span className="qloo-label">Powered by <strong>Qloo</strong></span><a href="https://github.com/hamoodaldurey-create/tastepilot-ai" target="_blank" rel="noopener noreferrer" aria-label="TastePilot AI on GitHub"><Code2 size={20}/></a></div></header>
    <main className="workspace">
      <aside className="brief-panel"><div className="eyebrow"><Sparkles size={15}/> YOUR TASTE, YOUR COMPASS</div><h1>Where taste<br/>takes you.</h1><p className="intro">Turn the things you love into places to eat, destinations to explore, and films to discover.</p>
        <form onSubmit={discover}><fieldset disabled={loading}><legend className="form-label">Start with what you love</legend><p className="field-hint">A film, artist, brand, book, or favorite place. Add up to three.</p>
          <div className="favorites-list">{favorites.map((favorite, index) => <div className="favorite-row" key={index}><div className="favorite-number">0{index + 1}</div><div className="favorite-fields"><Input aria-label={`Favorite ${index + 1} name`} value={favorite.name} maxLength={100} required placeholder="e.g. Interstellar" onChange={e => setFavorites(fs => fs.map((f, i) => i === index ? { ...f, name: e.target.value } : f))}/><Select value={favorite.type} onValueChange={type => setFavorites(fs => fs.map((f, i) => i === index ? { ...f, type: type as TasteType } : f))}><SelectTrigger aria-label={`Favorite ${index + 1} category`} className="type-select"><SelectValue/></SelectTrigger><SelectContent>{["movie", "artist", "brand", "book", "place"].map(t => <SelectItem key={t} value={t}>{t === "movie" ? "Film" : t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent></Select></div>{favorites.length > 1 && <button type="button" className="icon-button" aria-label={`Remove favorite ${index + 1}`} onClick={() => setFavorites(fs => fs.filter((_, i) => i !== index))}><X size={16}/></button>}</div>)}</div>
          {favorites.length < 3 && <button className="add-taste" type="button" onClick={() => setFavorites(fs => [...fs, { name: "", type: "brand" }])}><Plus size={16}/> Add another taste</button>}
          <div className="location-section"><label htmlFor="city">Dining in</label><div className="location-input"><MapPin size={18}/><Input id="city" value={city} required maxLength={100} onChange={e => setCity(e.target.value)} placeholder="e.g. Muscat"/></div></div>
          <div className="price-section"><label id="price-label">Dining price level</label><Select value={priceLevel} onValueChange={setPriceLevel}><SelectTrigger aria-labelledby="price-label" className="price-select"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="1">$ · Budget</SelectItem><SelectItem value="2">$$ · Moderate</SelectItem><SelectItem value="3">$$$ · Upscale</SelectItem><SelectItem value="4">$$$$ · Any price level</SelectItem></SelectContent></Select><p className="field-hint">Relative price tiers, not a quoted cost.</p></div>
          <div className="discover-categories"><span className="form-label">Discover</span>{(Object.keys(labels) as Category[]).map(category => <label key={category}><Checkbox checked={categories.includes(category)} onCheckedChange={checked => setCategories(cs => checked ? [...cs, category] : cs.filter(c => c !== category))}/><span>{labels[category]}</span></label>)}</div>
        </fieldset><Button className="discover-button" type="submit" disabled={loading || !categories.length || favorites.some(f => !f.name.trim())}>{loading ? <><LoaderCircle className="spin" size={18}/> Connecting your tastes…</> : <><Sparkles size={18}/>{result ? changed ? "Update my discoveries" : "Discover again" : "Find my discoveries"}</>}</Button></form>
        <div className="presets"><span className="form-label">Need inspiration?</span>{presets.map(p => <button disabled={loading} type="button" key={p.name} onClick={() => { setFavorites(p.favorites.map(f => ({...f}))); setCity(p.city); setLikedIds([]); setExcludedIds([]); setError(""); }}>{p.name}</button>)}</div><p className="privacy-note">Your favorites are sent to Qloo for this search. This app does not save a taste profile.</p>
      </aside>
      <section className="discoveries" aria-labelledby="discoveries-title"><div className="results-heading"><div><div className="eyebrow">YOUR DISCOVERY BOARD</div><h2 id="discoveries-title">A little more you.</h2></div><span className="live-label"><Compass size={15}/> Taste Graph insights</span></div>
        {error && <div role="alert" className="error-message"><CircleHelp size={20}/><div><strong>Let’s try that again</strong><p>{error}</p></div></div>}
        {changed && !loading && <p className="update-note">Your tastes or feedback have changed. Update your discoveries to use them.</p>}
        <div aria-live="polite" aria-busy={loading}>{loading ? <div className="loading-area"><div className="loading-summary"><LoaderCircle size={22} className="spin"/><div><strong>Connecting the dots</strong><p>Matching your favorites and searching Qloo’s Taste Graph.</p></div></div><div className="result-grid">{[1,2,3].map(i => <div className="loading-card" key={i}><Skeleton className="h-44 w-full rounded-lg"/><Skeleton className="mt-5 h-6 w-3/4"/><Skeleton className="mt-3 h-4 w-full"/></div>)}</div></div> : result ? <>
          <div className="taste-summary"><span className="summary-label">Tastes matched</span>{result.resolved.map(t => <span className="taste-chip" key={t.id} title={`Input: ${t.input}`}><Check size={13}/>{t.name}</span>)}</div>
          {result.warnings.length > 0 && <details className="warnings" open={!visible.length}><summary>{result.warnings.length} search {result.warnings.length === 1 ? "note" : "notes"}</summary><ul>{result.warnings.map(w => <li key={w}>{w}</li>)}</ul></details>}
          <Tabs value={tab} onValueChange={setTab} className="results-tabs"><TabsList className="category-tabs"><TabsTrigger value="all">All <span>{visible.length}</span></TabsTrigger>{(Object.keys(labels) as Category[]).filter(c => result.steps.some(s => s.tool.startsWith(`${c} ·`))).map(c => <TabsTrigger value={c} key={c}>{c === "entertainment" ? "Films" : labels[c]}</TabsTrigger>)}</TabsList>{["all", "dining", "travel", "entertainment"].map(filter => <TabsContent value={filter} key={filter}>{visible.filter(r => filter === "all" || r.category === filter).length ? <div className="result-grid">{visible.filter(r => filter === "all" || r.category === filter).map((r, i) => <DiscoveryCard key={r.id} recommendation={r} number={i + 1} liked={likedIds.includes(r.id)} onLike={() => like(r.id)} onHide={() => hide(r.id)}/>)}</div> : <Empty className="empty-results"><EmptyHeader><EmptyTitle>No discoveries here yet</EmptyTitle><EmptyDescription>Try another city, raise the dining price level, or choose different favorites.</EmptyDescription></EmptyHeader></Empty>}</TabsContent>)}</Tabs>
          {liked.length > 0 && <div className="shortlist"><Heart size={18}/><div><strong>Your shortlist</strong><p>{liked.map(r => r.name).join(" · ")}</p><span>Update your discoveries to use these as additional taste signals.</span></div></div>}
          {excludedIds.length > 0 && <button className="text-button restore-button" onClick={() => setExcludedIds([])}>Restore {excludedIds.length} hidden {excludedIds.length === 1 ? "result" : "results"}</button>}
          <details className="agent-trace"><summary><Sparkles size={17}/> How your discoveries came together <span>{result.steps.length} steps</span></summary><ol>{result.steps.map((step, i) => <li key={`${i}-${step.tool}`}><span className={step.status === "warning" ? "trace-number warning-number" : "trace-number"}>{i + 1}</span><div><strong>{step.tool}</strong><p>{step.detail}</p></div></li>)}</ol><p className="trace-footnote">Qloo supplies the recommendations. TastePilot coordinates tools and feedback with a deterministic agent; it does not use a language model. Affinity values are model scores, not satisfaction probabilities.</p></details><p className="result-footnote">Dining is local to {result.city}. Travel ideas are worldwide; film availability varies. Verify opening hours, prices, and availability directly.</p>
        </> : <div className="welcome-board"><div className="welcome-mark"><Compass size={40}/></div><h3>Your next favorite is out there.</h3><p>Start with a few things you already love.<br/>We’ll find the unexpected connections.</p><div className="domain-cards">{(Object.keys(labels) as Category[]).map((c, i) => { const Icon = icons[c]; return <div className={`domain-card domain-${c}`} key={c}><span className="domain-index">0{i + 1}</span><Icon size={27}/><strong>{labels[c]}</strong><p>{c === "dining" ? "A table that fits your taste." : c === "travel" ? "Somewhere you’d love to go." : "Your next favorite film."}</p></div>; })}</div><div className="connection-note"><Sparkles size={18}/><span>Your favorite film can lead you to your next favorite restaurant.</span></div></div>}</div>
      </section>
    </main><footer><span>TastePilot AI · Built by Hamood Al Durey</span><span>Qloo Agentic Hackathon</span></footer>
  </div>;
}
function DiscoveryCard({ recommendation: r, number, liked, onLike, onHide }: { recommendation: Recommendation; number: number; liked: boolean; onLike: () => void; onHide: () => void }) {
  const [imageFailed, setImageFailed] = useState(false); const Icon = icons[r.category];
  const link = r.url ?? (r.category === "dining" ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${r.name} ${r.address ?? ""}`)}` : `https://www.google.com/search?q=${encodeURIComponent(r.name)}`);
  return <article className={`discovery-card card-${r.category}`}><div className="card-visual">{r.image && !imageFailed ? <img src={r.image} alt={r.name} loading="lazy" referrerPolicy="no-referrer" onError={() => setImageFailed(true)}/> : <Icon size={38}/>}<span className="card-category"><Icon size={12}/>{labels[r.category]}</span><span className="card-number">{String(number).padStart(2,"0")}</span></div><div className="card-body"><h3>{r.name}</h3>{r.address && <p className="card-address"><MapPin size={13}/>{r.address}</p>}{r.description && <p className="card-description">{r.description}</p>}{r.tags.length > 0 && <div className="card-tags">{r.tags.slice(0,2).map(t => <span key={t}>{t}</span>)}</div>}<p className="card-reason">{r.reason}</p>{r.affinity !== undefined && <p className="affinity">Qloo affinity · {r.affinity.toFixed(3)}</p>}<div className="card-actions"><a href={link} target="_blank" rel="noopener noreferrer">{r.category === "dining" ? "View place" : "Explore"}</a><div><button className={`icon-button ${liked ? "liked" : ""}`} aria-pressed={liked} aria-label={`${liked ? "Unlike" : "Like"} ${r.name}`} onClick={onLike}><Heart size={18} fill={liked ? "currentColor" : "none"}/></button><button className="icon-button" aria-label={`Hide ${r.name}`} onClick={onHide}><X size={18}/></button></div></div></div></article>;
}
