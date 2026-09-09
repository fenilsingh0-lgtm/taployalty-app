import React, { useState, useEffect, useCallback } from 'react';
import { Star, Bell, Users, Gift, ExternalLink, Share2, RotateCcw, CheckCircle2, QrCode, LayoutDashboard, ArrowLeft, AlertCircle } from 'lucide-react';
import { supabase } from './supabaseClient';

export default function TapLoyaltyApp() {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [view, setView] = useState('landing'); // landing | customer | dashboard
  const [business, setBusiness] = useState(null);
  const [feedbackLog, setFeedbackLog] = useState([]);
  const [customers, setCustomers] = useState([]);

  const [step, setStep] = useState('name');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pointsJustEarned, setPointsJustEarned] = useState(0);

  const loadData = useCallback(async () => {
    setLoadError(null);
    try {
      const { data: businesses, error: bizErr } = await supabase
        .from('businesses')
        .select('*')
        .limit(1);
      if (bizErr) throw bizErr;
      const biz = businesses && businesses[0];
      setBusiness(biz || null);

      if (biz) {
        const { data: feedback, error: fbErr } = await supabase
          .from('feedback')
          .select('*')
          .eq('business_id', biz.id)
          .order('created_at', { ascending: false });
        if (fbErr) throw fbErr;
        setFeedbackLog(feedback || []);

        const { data: custs, error: custErr } = await supabase
          .from('customers')
          .select('*')
          .eq('business_id', biz.id)
          .order('last_visit', { ascending: false });
        if (custErr) throw custErr;
        setCustomers(custs || []);
      }
    } catch (e) {
      setLoadError(e.message || 'Could not load data from Supabase.');
    }
    setReady(true);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function resetFlow() {
    setStep('name'); setName(''); setPhone(''); setRating(0); setHoverRating(0);
    setComment(''); setPointsJustEarned(0);
  }

  async function submitRating() {
    if (!business) return;
    setSubmitting(true);
    const isLow = rating <= 3;
    const pointsAwarded = isLow ? 5 : 15;

    try {
      // Find existing customer by phone (or name if no phone) for this business
      let customer = null;
      if (phone.trim()) {
        const { data } = await supabase
          .from('customers')
          .select('*')
          .eq('business_id', business.id)
          .eq('phone', phone.trim())
          .maybeSingle();
        customer = data;
      }

      if (customer) {
        const { data: updated, error: updErr } = await supabase
          .from('customers')
          .update({
            name: name.trim() || customer.name,
            visits: customer.visits + 1,
            points: customer.points + pointsAwarded,
            last_visit: new Date().toISOString(),
          })
          .eq('id', customer.id)
          .select()
          .single();
        if (updErr) throw updErr;
        customer = updated;
      } else {
        const { data: created, error: createErr } = await supabase
          .from('customers')
          .insert({
            business_id: business.id,
            name: name.trim() || 'Guest',
            phone: phone.trim(),
            visits: 1,
            points: pointsAwarded,
            last_visit: new Date().toISOString(),
          })
          .select()
          .single();
        if (createErr) throw createErr;
        customer = created;
      }

      const { data: fbEntry, error: fbErr } = await supabase
        .from('feedback')
        .insert({
          business_id: business.id,
          customer_id: customer.id,
          name: name.trim() || 'Guest',
          phone: phone.trim(),
          rating,
          comment: comment.trim(),
          resolved: false,
        })
        .select()
        .single();
      if (fbErr) throw fbErr;

      setFeedbackLog(prev => [fbEntry, ...prev]);
      setCustomers(prev => {
        const others = prev.filter(c => c.id !== customer.id);
        return [customer, ...others];
      });
      setPointsJustEarned(pointsAwarded);
      setStep(isLow ? 'lowResult' : 'highResult');
    } catch (e) {
      alert('Something went wrong saving your rating: ' + (e.message || e));
    }
    setSubmitting(false);
  }

  async function resolveAlert(id) {
    try {
      const { error } = await supabase.from('feedback').update({ resolved: true }).eq('id', id);
      if (error) throw error;
      setFeedbackLog(prev => prev.map(f => f.id === id ? { ...f, resolved: true } : f));
    } catch (e) {
      alert('Could not resolve: ' + (e.message || e));
    }
  }

  const pendingAlerts = feedbackLog.filter(f => f.rating <= 3 && !f.resolved);
  const avgRating = feedbackLog.length
    ? (feedbackLog.reduce((s, f) => s + f.rating, 0) / feedbackLog.length).toFixed(1)
    : '—';
  const totalPoints = customers.reduce((s, c) => s + (c.points || 0), 0);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100">
        <div className="text-emerald-950 text-sm">Loading TapLoyalty…</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100 px-6">
        <div className="max-w-sm text-center">
          <AlertCircle className="mx-auto mb-3 text-rose-600" size={28} />
          <p className="text-sm text-rose-700 mb-2 font-medium">Could not connect to the database</p>
          <p className="text-xs text-emerald-800/60">{loadError}</p>
          <p className="text-xs text-emerald-800/60 mt-2">Check that VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set correctly.</p>
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-100 px-6 text-center">
        <p className="text-sm text-emerald-800/60">No business found. Make sure the "businesses" table has at least one row.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 text-emerald-950 font-sans">
      <div className="bg-emerald-950 text-stone-100 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block"></span>
          TapLoyalty
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setView('customer'); resetFlow(); }}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition ${view === 'customer' ? 'bg-amber-400 text-emerald-950' : 'bg-emerald-900 text-stone-200'}`}
          >
            Customer view
          </button>
          <button
            onClick={() => setView('dashboard')}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition ${view === 'dashboard' ? 'bg-amber-400 text-emerald-950' : 'bg-emerald-900 text-stone-200'}`}
          >
            Owner dashboard
          </button>
        </div>
      </div>

      {view === 'landing' && (
        <div className="max-w-md mx-auto px-6 py-16 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-950 text-amber-400 mb-6">
            <QrCode size={28} />
          </div>
          <h1 className="text-2xl font-semibold mb-2">Scan to rate your visit</h1>
          <p className="text-sm text-emerald-800/70 mb-8 leading-relaxed">
            {business.name} uses TapLoyalty. Tap below to simulate a table QR scan — this is a real, live database.
          </p>
          <button
            onClick={() => { setView('customer'); resetFlow(); }}
            className="w-full bg-emerald-950 text-stone-100 py-3.5 rounded-full font-semibold text-sm mb-3"
          >
            Simulate QR scan → rate your visit
          </button>
          <button
            onClick={() => setView('dashboard')}
            className="w-full border border-emerald-950 py-3.5 rounded-full font-semibold text-sm flex items-center justify-center gap-2"
          >
            <LayoutDashboard size={16} /> Open owner dashboard
          </button>
        </div>
      )}

      {view === 'customer' && (
        <div className="max-w-md mx-auto px-6 py-10">
          <button onClick={() => setView('landing')} className="flex items-center gap-1 text-xs text-emerald-800/60 mb-6">
            <ArrowLeft size={14} /> Back
          </button>

          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="text-xs text-emerald-800/50 mb-1">{business.name}</div>

            {step === 'name' && (
              <div>
                <h2 className="text-lg font-semibold mb-4">How was your visit?</h2>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm mb-3 outline-none focus:border-emerald-700"
                />
                <input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="Phone number (for your points)"
                  className="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm mb-4 outline-none focus:border-emerald-700"
                />
                <button
                  onClick={() => setStep('rate')}
                  disabled={!name.trim()}
                  className="w-full bg-emerald-950 text-stone-100 py-3 rounded-full font-semibold text-sm disabled:opacity-40"
                >
                  Continue
                </button>
              </div>
            )}

            {step === 'rate' && (
              <div>
                <h2 className="text-lg font-semibold mb-1">Hey {name.split(' ')[0]}, rate your visit</h2>
                <p className="text-xs text-emerald-800/50 mb-5">Tap a star to continue</p>
                <div className="flex gap-2 mb-6 justify-center">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onMouseEnter={() => setHoverRating(n)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setRating(n)}
                      className="p-1"
                    >
                      <Star
                        size={34}
                        className={(hoverRating || rating) >= n ? 'fill-amber-400 text-amber-400' : 'text-stone-300'}
                      />
                    </button>
                  ))}
                </div>
                {rating > 0 && rating <= 3 && (
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="What went wrong? This goes straight to the manager."
                    rows={3}
                    className="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm mb-4 outline-none focus:border-emerald-700"
                  />
                )}
                <button
                  onClick={submitRating}
                  disabled={rating === 0 || submitting}
                  className="w-full bg-emerald-950 text-stone-100 py-3 rounded-full font-semibold text-sm disabled:opacity-40"
                >
                  {submitting ? 'Sending…' : 'Submit rating'}
                </button>
              </div>
            )}

            {step === 'lowResult' && (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
                  <Bell size={20} />
                </div>
                <h2 className="text-lg font-semibold mb-2">Thanks — we heard you</h2>
                <p className="text-sm text-emerald-800/70 mb-5 leading-relaxed">
                  Your feedback just went straight to the {business.name} manager's dashboard, marked urgent.
                  You still earned {pointsJustEarned} points for telling us.
                </p>
                <button onClick={() => { setView('landing'); resetFlow(); }} className="text-sm font-semibold text-emerald-800 underline">
                  Done
                </button>
              </div>
            )}

            {step === 'highResult' && (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-500 flex items-center justify-center mx-auto mb-4">
                  <Gift size={20} />
                </div>
                <h2 className="text-lg font-semibold mb-1">+{pointsJustEarned} points earned!</h2>
                <p className="text-sm text-emerald-800/70 mb-5">Glad you had a great visit. One more tap helps a lot:</p>
                <a
                  href={business.google_review_link || '#'}
                  target="_blank" rel="noopener noreferrer"
                  className="w-full bg-emerald-950 text-stone-100 py-3 rounded-full font-semibold text-sm flex items-center justify-center gap-2 mb-2.5"
                >
                  Leave a Google review <ExternalLink size={14} />
                </a>
                <button className="w-full border border-emerald-950 py-3 rounded-full font-semibold text-sm flex items-center justify-center gap-2 mb-4">
                  Refer a friend <Share2 size={14} />
                </button>
                <button onClick={() => { setView('landing'); resetFlow(); }} className="text-sm font-semibold text-emerald-800 underline">
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'dashboard' && (
        <div className="max-w-3xl mx-auto px-5 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-semibold">{business.name} · Dashboard</h1>
              <p className="text-xs text-emerald-800/50">Live data from your Supabase database</p>
            </div>
            <button onClick={loadData} className="text-xs flex items-center gap-1 text-emerald-800/60 border border-stone-300 rounded-full px-3 py-1.5">
              <RotateCcw size={12} /> Refresh
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <div className="bg-white rounded-xl p-4">
              <div className="text-2xl font-semibold">{avgRating}</div>
              <div className="text-xs text-emerald-800/50 mt-1">Avg rating</div>
            </div>
            <div className="bg-white rounded-xl p-4">
              <div className="text-2xl font-semibold">{feedbackLog.length}</div>
              <div className="text-xs text-emerald-800/50 mt-1">Total ratings</div>
            </div>
            <div className="bg-white rounded-xl p-4">
              <div className="text-2xl font-semibold">{customers.length}</div>
              <div className="text-xs text-emerald-800/50 mt-1">Customers in CRM</div>
            </div>
            <div className="bg-white rounded-xl p-4">
              <div className="text-2xl font-semibold">{totalPoints}</div>
              <div className="text-xs text-emerald-800/50 mt-1">Points issued</div>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Bell size={15} className="text-rose-600" /> Needs attention {pendingAlerts.length > 0 && `(${pendingAlerts.length})`}
            </h2>
            {pendingAlerts.length === 0 ? (
              <div className="bg-white rounded-xl p-4 text-sm text-emerald-800/50">No open alerts right now.</div>
            ) : (
              <div className="space-y-2">
                {pendingAlerts.map(f => (
                  <div key={f.id} className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">{f.name}</span>
                        <span className="flex">{Array.from({ length: f.rating }).map((_, i) => <Star key={i} size={12} className="fill-rose-500 text-rose-500" />)}</span>
                      </div>
                      {f.comment && <p className="text-sm text-emerald-900/80">{f.comment}</p>}
                      <p className="text-xs text-emerald-800/40 mt-1">{new Date(f.created_at).toLocaleString()}</p>
                    </div>
                    <button onClick={() => resolveAlert(f.id)} className="text-xs bg-emerald-950 text-stone-100 px-3 py-1.5 rounded-full flex items-center gap-1 whitespace-nowrap">
                      <CheckCircle2 size={12} /> Resolve
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Users size={15} /> Customers
            </h2>
            {customers.length === 0 ? (
              <div className="bg-white rounded-xl p-4 text-sm text-emerald-800/50">No customers yet — simulate a scan to add one.</div>
            ) : (
              <div className="bg-white rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-emerald-800/50 border-b border-stone-200">
                      <th className="px-4 py-2.5 font-medium">Name</th>
                      <th className="px-4 py-2.5 font-medium">Visits</th>
                      <th className="px-4 py-2.5 font-medium">Points</th>
                      <th className="px-4 py-2.5 font-medium">Last visit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map(c => (
                      <tr key={c.id} className="border-b border-stone-100 last:border-0">
                        <td className="px-4 py-2.5">{c.name}</td>
                        <td className="px-4 py-2.5">{c.visits}</td>
                        <td className="px-4 py-2.5 text-amber-600 font-medium">{c.points}</td>
                        <td className="px-4 py-2.5 text-emerald-800/50 text-xs">{c.last_visit ? new Date(c.last_visit).toLocaleDateString() : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
