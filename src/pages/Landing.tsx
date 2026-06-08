import { useEffect, useRef, useState } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Zap, BarChart3, Shield, Smartphone, Truck, TrendingUp,
  ChevronDown, Menu, X, Moon, Sun, Check, ArrowRight, Star
} from 'lucide-react'

// ─── Helpers ───────────────────────────────────────────────────────────────

function FadeUp({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ─── Navbar ────────────────────────────────────────────────────────────────

function Navbar({ dark, setDark }: { dark: boolean; setDark: (v: boolean) => void }) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const links = [
    { label: 'Comment ça marche', href: '#how' },
    { label: 'Fonctionnalités', href: '#features' },
    { label: 'Tarifs', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ]

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? dark
            ? 'bg-gray-950/80 border-b border-white/10 backdrop-blur-xl shadow-lg'
            : 'bg-white/80 border-b border-gray-200/60 backdrop-blur-xl shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2 font-bold text-xl">
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-sm font-black">O</span>
          <span className={dark ? 'text-white' : 'text-gray-900'}>OrderFlow</span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-7">
          {links.map(l => (
            <a
              key={l.label}
              href={l.href}
              className={`text-sm font-medium transition-colors ${
                dark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {l.label}
            </a>
          ))}
        </nav>

        {/* Actions */}
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={() => setDark(!dark)}
            className={`p-2 rounded-lg transition-colors ${dark ? 'text-gray-300 hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <Link
            to="/login"
            className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
              dark ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Connexion
          </Link>
          <Link
            to="/signup"
            className="text-sm font-semibold px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white transition-all hover:scale-105 active:scale-95 shadow-lg shadow-emerald-500/25"
          >
            Essai gratuit
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <div className="flex md:hidden items-center gap-2">
          <button onClick={() => setDark(!dark)} className={`p-2 rounded-lg ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button onClick={() => setMenuOpen(!menuOpen)} className={`p-2 rounded-lg ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`md:hidden border-t ${dark ? 'bg-gray-950 border-white/10' : 'bg-white border-gray-100'}`}
          >
            <div className="px-4 py-4 flex flex-col gap-3">
              {links.map(l => (
                <a
                  key={l.label}
                  href={l.href}
                  onClick={() => setMenuOpen(false)}
                  className={`text-sm font-medium py-2 ${dark ? 'text-gray-300' : 'text-gray-700'}`}
                >
                  {l.label}
                </a>
              ))}
              <Link to="/signup" className="mt-2 text-center text-sm font-semibold px-4 py-3 rounded-xl bg-emerald-500 text-white">
                Commencer gratuitement
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

// ─── Hero Mockup ───────────────────────────────────────────────────────────

function HeroMockup({ dark }: { dark: boolean }) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setStep(s => (s + 1) % 4), 1800)
    return () => clearInterval(id)
  }, [])

  const msgs = [
    { from: 'client', text: 'salam bghit bougie vanille 2 livraison Maarif' },
    { from: 'bot', text: '✅ Commande reçue! Je traite votre demande...' },
  ]

  return (
    <div className="relative w-full max-w-sm mx-auto">
      {/* Glow */}
      <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full scale-75 -z-10" />

      {/* WhatsApp mock */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.8 }}
        className={`rounded-2xl shadow-2xl overflow-hidden border ${
          dark ? 'border-white/10 bg-gray-900' : 'border-gray-200 bg-white'
        }`}
      >
        {/* WA header */}
        <div className="bg-emerald-600 px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-400 flex items-center justify-center text-white text-xs font-bold">Z</div>
          <div>
            <p className="text-white text-sm font-semibold">Zethnika Bougies</p>
            <p className="text-emerald-100 text-xs">en ligne</p>
          </div>
        </div>

        {/* Chat */}
        <div className={`p-4 space-y-3 min-h-[160px] ${dark ? 'bg-gray-900' : 'bg-[#e5ddd5]/30'}`}>
          {msgs.slice(0, step >= 1 ? 1 : 0).map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${m.from === 'bot' ? 'justify-start' : 'justify-end'}`}
            >
              <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                m.from === 'bot'
                  ? dark ? 'bg-gray-700 text-gray-100' : 'bg-white text-gray-800 shadow-sm'
                  : 'bg-emerald-500 text-white'
              }`}>
                {m.text}
              </div>
            </motion.div>
          ))}
          {step >= 2 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
              <div className={`max-w-[85%] px-3 py-2 rounded-xl text-xs ${dark ? 'bg-gray-700 text-gray-100' : 'bg-white text-gray-800 shadow-sm'}`}>
                {msgs[1].text}
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Arrow */}
      <motion.div
        animate={{ x: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 1.5 }}
        className="absolute -right-6 top-1/2 -translate-y-1/2 text-emerald-500 hidden lg:block"
      >
        <ArrowRight size={24} />
      </motion.div>

      {/* Dashboard card */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={step >= 3 ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
        transition={{ duration: 0.5 }}
        className={`mt-3 rounded-xl p-4 border shadow-lg ${
          dark ? 'bg-gray-800 border-white/10' : 'bg-white border-gray-200'
        }`}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className={`text-xs font-semibold ${dark ? 'text-gray-200' : 'text-gray-700'}`}>Nouvelle commande #1042</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[['Produit', 'Bougie Vanille x2'], ['Livraison', 'Maarif'], ['Client', 'Nouveau'], ['Statut', '✅ Confirmée']].map(([k, v]) => (
            <div key={k}>
              <p className={dark ? 'text-gray-500' : 'text-gray-400'}>{k}</p>
              <p className={`font-medium ${dark ? 'text-gray-200' : 'text-gray-800'}`}>{v}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}

// ─── Section 1: Hero ───────────────────────────────────────────────────────

function Hero({ dark }: { dark: boolean }) {
  return (
    <section className="relative min-h-screen flex items-center pt-24 pb-20 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className={`absolute inset-0 ${dark ? 'bg-gray-950' : 'bg-gradient-to-b from-emerald-50/60 via-white to-white'}`} />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-emerald-400/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-emerald-300/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6 border"
              style={dark
                ? { background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)', color: '#6ee7b7' }
                : { background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.25)', color: '#059669' }
              }
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Nouveau: Score anti-annulation COD
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className={`text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.08] tracking-tight mb-6 ${dark ? 'text-white' : 'text-gray-950'}`}
            >
              Vos commandes{' '}
              <span className="relative">
                <span className="relative z-10 bg-gradient-to-r from-emerald-500 to-emerald-400 bg-clip-text text-transparent">
                  WhatsApp
                </span>
              </span>
              ,{' '}
              <br className="hidden sm:block" />
              gérées automatiquement
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className={`text-lg leading-relaxed mb-8 max-w-lg ${dark ? 'text-gray-300' : 'text-gray-600'}`}
            >
              Vos clients envoient un message. OrderFlow crée la commande, extrait les détails, notifie votre livreur.{' '}
              <strong className={dark ? 'text-white' : 'text-gray-900'}>En 3 secondes.</strong>
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-3 mb-8"
            >
              <Link
                to="/signup"
                className="group flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm transition-all hover:scale-[1.03] active:scale-95 shadow-xl shadow-emerald-500/30"
              >
                Commencer gratuitement — 30 jours offerts
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <a
                href="#demo"
                className={`flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm border transition-all hover:scale-[1.03] active:scale-95 ${
                  dark
                    ? 'border-white/20 text-white hover:bg-white/5'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Voir la démo
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex items-center gap-3"
            >
              <div className="flex -space-x-2">
                {['F', 'K', 'S', 'A', 'M'].map((l, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold text-white"
                    style={{
                      borderColor: dark ? '#111827' : '#fff',
                      background: `hsl(${[160, 200, 280, 320, 40][i]}, 60%, 45%)`,
                    }}
                  >
                    {l}
                  </div>
                ))}
              </div>
              <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                Rejoignez <strong className={dark ? 'text-gray-200' : 'text-gray-800'}>500+</strong> commerçants marocains
              </p>
            </motion.div>
          </div>

          {/* Right */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <HeroMockup dark={dark} />
          </motion.div>
        </div>
      </div>
    </section>
  )
}

// ─── Section 2: Social Proof Bar ──────────────────────────────────────────

function SocialProofBar({ dark }: { dark: boolean }) {
  const brands = ['Zethnika', 'Bougies Casa', 'Rose Shop MA', 'Fatima Cosmetics', 'Parfums Maroc', "L'Atelier Casa", 'Zethnika', 'Bougies Casa', 'Rose Shop MA', 'Fatima Cosmetics', 'Parfums Maroc', "L'Atelier Casa"]

  return (
    <section className={`py-12 border-y overflow-hidden ${dark ? 'border-white/10 bg-gray-900/50' : 'border-gray-100 bg-gray-50/80'}`}>
      <p className={`text-center text-xs font-medium uppercase tracking-widest mb-6 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
        Ils gèrent leurs commandes avec OrderFlow
      </p>
      <div className="relative">
        <motion.div
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
          className="flex gap-12 whitespace-nowrap"
        >
          {brands.map((b, i) => (
            <span key={i} className={`text-sm font-semibold shrink-0 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
              {b}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

// ─── Section 3: How It Works ──────────────────────────────────────────────

function HowItWorks({ dark }: { dark: boolean }) {
  const steps = [
    {
      icon: '💬',
      title: 'Le client envoie un message',
      desc: '"salam bghit bougie vanille 2 livraison Maarif"',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: '🤖',
      title: "L'IA extrait tout",
      desc: 'Produit, quantité, adresse, client — parsé en Darija, français ou les deux.',
      color: 'from-violet-500 to-purple-500',
    },
    {
      icon: '✅',
      title: 'Commande créée instantanément',
      desc: 'Visible dans votre dashboard, livreur notifié, client confirmé.',
      color: 'from-emerald-500 to-green-400',
    },
  ]

  return (
    <section id="how" className={`py-28 ${dark ? 'bg-gray-950' : 'bg-white'}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeUp className="text-center mb-20">
          <h2 className={`text-3xl sm:text-4xl font-black tracking-tight mb-4 ${dark ? 'text-white' : 'text-gray-950'}`}>
            De WhatsApp au dashboard{' '}
            <span className="text-emerald-500">en 3 secondes</span>
          </h2>
          <p className={`text-lg max-w-xl mx-auto ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
            Aucune configuration compliquée. Aucune app à installer pour vos clients.
          </p>
        </FadeUp>

        <div className="relative">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-10 left-[calc(16.67%+1.5rem)] right-[calc(16.67%+1.5rem)] h-px bg-gradient-to-r from-blue-500 via-violet-500 to-emerald-500 opacity-30" />

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <FadeUp key={i} delay={i * 0.15}>
                <div className={`relative rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-1 group ${
                  dark ? 'bg-gray-900 border-white/10 hover:border-white/20' : 'bg-white border-gray-100 hover:border-gray-200 shadow-sm hover:shadow-md'
                }`}>
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-2xl mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                    {s.icon}
                  </div>
                  <div className={`text-xs font-bold uppercase tracking-widest mb-2 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                    Étape {i + 1}
                  </div>
                  <h3 className={`font-bold text-base mb-2 ${dark ? 'text-white' : 'text-gray-900'}`}>{s.title}</h3>
                  <p className={`text-sm leading-relaxed ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{s.desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Section 4: Features Grid ─────────────────────────────────────────────

function Features({ dark }: { dark: boolean }) {
  const feats = [
    { icon: <Zap size={20} />, title: 'Parsing IA instantané', desc: 'Claude AI comprend le Darija, français, et les abréviations. Zéro erreur.', color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { icon: <BarChart3 size={20} />, title: 'Dashboard en temps réel', desc: 'Toutes vos commandes centralisées, statuts mis à jour en un clic.', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { icon: <Shield size={20} />, title: 'Score anti-annulation', desc: 'Détectez les clients à risque avant la livraison. Réduisez le COD raté.', color: 'text-red-500', bg: 'bg-red-500/10' },
    { icon: <Smartphone size={20} />, title: 'WhatsApp natif', desc: 'Vos clients commandent là où ils sont déjà. Sans app à télécharger.', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { icon: <Truck size={20} />, title: 'Gestion livreurs', desc: 'Assignez et tracez vos livraisons. Notifications automatiques.', color: 'text-violet-500', bg: 'bg-violet-500/10' },
    { icon: <TrendingUp size={20} />, title: 'Analytics business', desc: "CA, produits stars, heures de pointe. Pilotez votre croissance.", color: 'text-pink-500', bg: 'bg-pink-500/10' },
  ]

  return (
    <section id="features" className={`py-28 ${dark ? 'bg-gray-900' : 'bg-gray-50/80'}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeUp className="text-center mb-16">
          <h2 className={`text-3xl sm:text-4xl font-black tracking-tight mb-4 ${dark ? 'text-white' : 'text-gray-950'}`}>
            Tout ce dont vous avez besoin,{' '}
            <span className="text-emerald-500">rien de superflu</span>
          </h2>
          <p className={`text-lg max-w-xl mx-auto ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
            Conçu pour les commerçants marocains qui veulent vendre plus, pas gérer plus.
          </p>
        </FadeUp>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {feats.map((f, i) => (
            <FadeUp key={i} delay={i * 0.08}>
              <div className={`rounded-2xl p-6 border h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-lg group cursor-default ${
                dark ? 'bg-gray-800 border-white/10 hover:border-white/20 hover:shadow-black/30' : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-gray-100'
              }`}>
                <div className={`w-10 h-10 rounded-xl ${f.bg} ${f.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  {f.icon}
                </div>
                <h3 className={`font-bold mb-2 ${dark ? 'text-white' : 'text-gray-900'}`}>{f.title}</h3>
                <p className={`text-sm leading-relaxed ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{f.desc}</p>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Section 5: Live Demo ─────────────────────────────────────────────────

function LiveDemo({ dark }: { dark: boolean }) {
  const messages = [
    { from: 'client', text: 'salam 3ndk bougie vanille?' },
    { from: 'bot', text: 'Bien sûr! Combien en voulez-vous?' },
    { from: 'client', text: '2 stp livraison hay riad' },
    { from: 'bot', text: '✅ Commande enregistrée! On vous confirme dans 5min' },
  ]

  const [visible, setVisible] = useState(0)
  const [showCard, setShowCard] = useState(false)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-100px' })

  useEffect(() => {
    if (!inView) return
    let i = 0
    const id = setInterval(() => {
      i++
      setVisible(i)
      if (i >= messages.length) {
        clearInterval(id)
        setTimeout(() => setShowCard(true), 400)
      }
    }, 900)
    return () => clearInterval(id)
  }, [inView])

  return (
    <section id="demo" className={`py-28 ${dark ? 'bg-gray-950' : 'bg-white'}`} ref={ref}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeUp className="text-center mb-16">
          <h2 className={`text-3xl sm:text-4xl font-black tracking-tight mb-4 ${dark ? 'text-white' : 'text-gray-950'}`}>
            Voyez-le en action
          </h2>
          <p className={`text-lg max-w-xl mx-auto ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
            De WhatsApp à votre dashboard en quelques secondes.
          </p>
        </FadeUp>

        <div className="grid lg:grid-cols-2 gap-10 items-center max-w-4xl mx-auto">
          {/* WhatsApp */}
          <div className={`rounded-2xl overflow-hidden shadow-2xl border ${dark ? 'border-white/10' : 'border-gray-200'}`}>
            <div className="bg-emerald-600 px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-400 flex items-center justify-center text-white text-xs font-bold">C</div>
              <div>
                <p className="text-white text-sm font-semibold">Client WhatsApp</p>
                <p className="text-emerald-100 text-xs">en ligne</p>
              </div>
            </div>
            <div className={`p-4 space-y-3 min-h-[220px] ${dark ? 'bg-[#0a1929]' : 'bg-[#e5ddd5]/40'}`}>
              {messages.slice(0, visible).map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${m.from === 'client' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                    m.from === 'client'
                      ? 'bg-emerald-500 text-white'
                      : dark ? 'bg-gray-700 text-gray-100' : 'bg-white text-gray-800 shadow-sm'
                  }`}>
                    {m.text}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Arrow + Card */}
          <div className="flex flex-col items-center gap-6">
            <motion.div
              animate={showCard ? { x: [0, 10, 0], opacity: 1 } : { opacity: 0.3 }}
              transition={{ duration: 0.5 }}
              className={`text-emerald-500`}
            >
              <ArrowRight size={36} />
            </motion.div>

            <AnimatePresence>
              {showCard && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.5, type: 'spring' }}
                  className={`w-full rounded-2xl p-5 border shadow-xl ${
                    dark ? 'bg-gray-800 border-white/10' : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className={`text-xs font-semibold uppercase tracking-wide ${dark ? 'text-gray-400' : 'text-gray-400'}`}>
                      Nouvelle commande
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500">#1043</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ['Produit', 'Bougie Vanille'],
                      ['Quantité', '2 unités'],
                      ['Livraison', 'Hay Riad'],
                      ['Statut', '✅ Confirmée'],
                    ].map(([k, v]) => (
                      <div key={k} className={`rounded-lg p-2.5 ${dark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                        <p className={`text-xs mb-0.5 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{k}</p>
                        <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-800'}`}>{v}</p>
                      </div>
                    ))}
                  </div>
                  <div className={`mt-3 pt-3 border-t flex items-center gap-2 ${dark ? 'border-white/10' : 'border-gray-100'}`}>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>Livreur notifié automatiquement</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Section 6: Pricing ───────────────────────────────────────────────────

function Pricing({ dark }: { dark: boolean }) {
  const plans = [
    {
      name: 'Starter',
      price: '149',
      desc: 'Pour commencer',
      features: ['Jusqu\'à 200 commandes/mois', 'Dashboard complet', 'Parsing IA', 'Support WhatsApp'],
      cta: 'Commencer',
      popular: false,
    },
    {
      name: 'Growth',
      price: '349',
      desc: 'Le plus populaire',
      features: ['Commandes illimitées', 'Analytics avancés', 'Score anti-annulation', 'Intégration livreurs', 'Support prioritaire'],
      cta: 'Commencer — 30 jours gratuits',
      popular: true,
    },
    {
      name: 'Pro',
      price: '699',
      desc: 'Pour les grandes équipes',
      features: ['Tout Growth inclus', 'Multi-boutiques', 'API access', 'Account manager dédié', 'Données marché Maroc'],
      cta: 'Contacter',
      popular: false,
    },
  ]

  return (
    <section id="pricing" className={`py-28 ${dark ? 'bg-gray-900' : 'bg-gray-50/80'}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeUp className="text-center mb-16">
          <h2 className={`text-3xl sm:text-4xl font-black tracking-tight mb-4 ${dark ? 'text-white' : 'text-gray-950'}`}>
            Simple et transparent
          </h2>
          <p className={`text-lg max-w-xl mx-auto ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
            Aucun frais caché. Annulez à tout moment.
          </p>
        </FadeUp>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((p, i) => (
            <FadeUp key={i} delay={i * 0.1}>
              <div className={`relative rounded-2xl p-7 border h-full flex flex-col transition-all duration-300 hover:-translate-y-1 ${
                p.popular
                  ? dark
                    ? 'bg-emerald-950/60 border-emerald-500/50 shadow-2xl shadow-emerald-500/10'
                    : 'bg-white border-emerald-500/50 shadow-2xl shadow-emerald-500/10'
                  : dark
                  ? 'bg-gray-800 border-white/10'
                  : 'bg-white border-gray-200 shadow-sm'
              }`}>
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
                      ⭐ Populaire
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className={`font-bold text-lg mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>{p.name}</h3>
                  <p className={`text-sm ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{p.desc}</p>
                  <div className="mt-4 flex items-end gap-1">
                    <span className={`text-4xl font-black ${dark ? 'text-white' : 'text-gray-900'}`}>{p.price}</span>
                    <span className={`text-sm font-medium mb-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}> DH/mois</span>
                  </div>
                </div>

                <ul className="flex-1 space-y-3 mb-7">
                  {p.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2.5">
                      <Check size={15} className="text-emerald-500 mt-0.5 shrink-0" />
                      <span className={`text-sm ${dark ? 'text-gray-300' : 'text-gray-600'}`}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to="/signup"
                  className={`block text-center py-3 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] active:scale-95 ${
                    p.popular
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/30'
                      : dark
                      ? 'bg-gray-700 hover:bg-gray-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                  }`}
                >
                  {p.cta}
                </Link>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Section 7: Testimonials ──────────────────────────────────────────────

function Testimonials({ dark }: { dark: boolean }) {
  const reviews = [
    {
      quote: 'Avant je perdais 2h par jour à noter les commandes WhatsApp. Maintenant c\'est automatique.',
      name: 'Fatima',
      company: 'Zethnika Bougies',
      initial: 'F',
      color: 'bg-pink-500',
    },
    {
      quote: "J'ai réduit mes annulations COD de 40% grâce au score client. Incroyable.",
      name: 'Karim',
      company: 'Rose Shop Casa',
      initial: 'K',
      color: 'bg-blue-500',
    },
    {
      quote: 'Setup en 5 minutes, ma première commande parsée en automatique le même jour.',
      name: 'Sara',
      company: "L'Atelier Cosmétiques",
      initial: 'S',
      color: 'bg-violet-500',
    },
  ]

  return (
    <section className={`py-28 ${dark ? 'bg-gray-950' : 'bg-white'}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeUp className="text-center mb-16">
          <h2 className={`text-3xl sm:text-4xl font-black tracking-tight mb-4 ${dark ? 'text-white' : 'text-gray-950'}`}>
            Ils en parlent mieux que nous
          </h2>
        </FadeUp>

        <div className="grid md:grid-cols-3 gap-6">
          {reviews.map((r, i) => (
            <FadeUp key={i} delay={i * 0.1}>
              <div className={`rounded-2xl p-6 border h-full transition-all duration-300 hover:-translate-y-1 ${
                dark ? 'bg-gray-900 border-white/10 hover:border-white/20' : 'bg-white border-gray-100 hover:border-gray-200 shadow-sm hover:shadow-md'
              }`}>
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} size={14} className="fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className={`text-sm leading-relaxed mb-6 ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
                  "{r.quote}"
                </p>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full ${r.color} flex items-center justify-center text-white text-sm font-bold`}>
                    {r.initial}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-gray-900'}`}>{r.name}</p>
                    <p className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{r.company}</p>
                  </div>
                </div>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Section 8: FAQ ───────────────────────────────────────────────────────

function FAQItem({ q, a, dark }: { q: string; a: string; dark: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`border-b ${dark ? 'border-white/10' : 'border-gray-100'}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between py-5 text-left gap-4 ${dark ? 'text-white hover:text-emerald-400' : 'text-gray-900 hover:text-emerald-600'} transition-colors`}
      >
        <span className="font-semibold text-sm">{q}</span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={18} className="shrink-0 text-emerald-500" />
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <p className={`pb-5 text-sm leading-relaxed ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function FAQ({ dark }: { dark: boolean }) {
  const items = [
    {
      q: 'Est-ce que ça marche avec WhatsApp normal ou Business?',
      a: 'OrderFlow fonctionne avec WhatsApp Business (recommandé) et WhatsApp standard. Nous vous guidons pour connecter votre numéro en moins de 5 minutes.',
    },
    {
      q: 'Mes clients doivent-ils télécharger une app?',
      a: 'Non. Vos clients commandent directement via WhatsApp comme d\'habitude. Aucune app, aucun compte à créer de leur côté.',
    },
    {
      q: "Comment l'IA comprend le Darija?",
      a: 'Notre IA est entraînée spécifiquement sur le Darija marocain et le français mélangé. Elle comprend les abréviations, les fautes de frappe et les expressions locales comme "bghit", "3ndk", "safi".',
    },
    {
      q: 'Est-ce que mes données sont sécurisées?',
      a: 'Oui. Vos données sont chiffrées, hébergées en Europe (RGPD), et ne sont jamais partagées avec des tiers. Vous pouvez exporter ou supprimer vos données à tout moment.',
    },
    {
      q: 'Puis-je annuler à tout moment?',
      a: 'Absolument. Aucun engagement, aucune pénalité. Annulez en un clic depuis votre dashboard. Vos données restent disponibles 30 jours après annulation.',
    },
  ]

  return (
    <section id="faq" className={`py-28 ${dark ? 'bg-gray-900' : 'bg-gray-50/80'}`}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeUp className="text-center mb-12">
          <h2 className={`text-3xl sm:text-4xl font-black tracking-tight mb-4 ${dark ? 'text-white' : 'text-gray-950'}`}>
            Questions fréquentes
          </h2>
        </FadeUp>
        <FadeUp>
          {items.map((item, i) => (
            <FAQItem key={i} q={item.q} a={item.a} dark={dark} />
          ))}
        </FadeUp>
      </div>
    </section>
  )
}

// ─── Section 9: Final CTA ─────────────────────────────────────────────────

function FinalCTA({ dark }: { dark: boolean }) {
  return (
    <section className={`py-32 relative overflow-hidden ${dark ? 'bg-gray-950' : 'bg-white'}`}>
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-emerald-400/10 rounded-full blur-3xl" />
      </div>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <FadeUp>
          <h2 className={`text-4xl sm:text-5xl font-black tracking-tight mb-5 ${dark ? 'text-white' : 'text-gray-950'}`}>
            Prêt à automatiser{' '}
            <br className="hidden sm:block" />
            vos commandes?
          </h2>
          <p className={`text-lg mb-10 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
            Commencez gratuitement aujourd'hui — aucune carte bancaire requise
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-lg transition-all hover:scale-[1.04] active:scale-95 shadow-2xl shadow-emerald-500/30"
          >
            Créer mon compte gratuit
            <ArrowRight size={20} />
          </Link>
          <div className={`flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 mt-8 text-sm ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
            {['30 jours gratuits', 'Setup en 5 min', 'Support en Darija'].map(t => (
              <span key={t} className="flex items-center gap-2">
                <Check size={14} className="text-emerald-500" />
                {t}
              </span>
            ))}
          </div>
        </FadeUp>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────

function Footer({ dark }: { dark: boolean }) {
  return (
    <footer className={`py-12 border-t ${dark ? 'bg-gray-950 border-white/10' : 'bg-gray-50 border-gray-100'}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 font-bold text-xl mb-1">
              <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-xs font-black">O</span>
              <span className={dark ? 'text-white' : 'text-gray-900'}>OrderFlow</span>
            </div>
            <p className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>Le CRM WhatsApp des commerçants marocains</p>
          </div>

          <div className="flex flex-wrap justify-center gap-6">
            {[['Tarifs', '#pricing'], ['Blog', '#'], ['Contact', '#'], ['Conditions', '#']].map(([l, h]) => (
              <a key={l} href={h} className={`text-sm transition-colors ${dark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}>{l}</a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {['IG', 'LI'].map(s => (
              <a key={s} href="#" className={`w-9 h-9 rounded-lg border flex items-center justify-center text-xs font-bold transition-colors ${
                dark ? 'border-white/10 text-gray-400 hover:border-white/30 hover:text-white' : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-800'
              }`}>{s}</a>
            ))}
          </div>
        </div>

        <div className={`mt-8 pt-6 border-t text-center text-xs ${dark ? 'border-white/10 text-gray-600' : 'border-gray-100 text-gray-400'}`}>
          © 2026 OrderFlow. Fait avec ❤️ à Casablanca
        </div>
      </div>
    </footer>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────

export default function Landing() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    setDark(prefersDark)
  }, [])

  return (
    <div className={dark ? 'dark' : ''}>
      <div className={`min-h-screen ${dark ? 'bg-gray-950' : 'bg-white'} transition-colors duration-300`}>
        <Navbar dark={dark} setDark={setDark} />
        <Hero dark={dark} />
        <SocialProofBar dark={dark} />
        <HowItWorks dark={dark} />
        <Features dark={dark} />
        <LiveDemo dark={dark} />
        <Pricing dark={dark} />
        <Testimonials dark={dark} />
        <FAQ dark={dark} />
        <FinalCTA dark={dark} />
        <Footer dark={dark} />
      </div>
    </div>
  )
}
