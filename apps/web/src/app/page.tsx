import Image from "next/image";
import {
  BadgeCheck,
  Bell,
  BriefcaseMedical,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  DollarSign,
  Footprints,
  HandHeart,
  Heart,
  Home,
  IdCard,
  MessageCircle,
  Search,
  ShieldCheck,
  ShoppingBag,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

const services = [
  {
    title: "Companionship",
    copy: "Friendly conversation and meaningful connection.",
    icon: MessageCircle,
    tone: "gold",
  },
  {
    title: "Errands",
    copy: "Grocery shopping, pharmacy runs, and other errands.",
    icon: ShoppingBag,
    tone: "sage",
  },
  {
    title: "Walks",
    copy: "Outdoor walks and gentle activity support.",
    icon: Footprints,
    tone: "gold",
  },
  {
    title: "Medication reminders",
    copy: "Reminders to help keep routines on track.",
    icon: BriefcaseMedical,
    tone: "sage",
  },
];

const trustItems = [
  {
    title: "Background checks",
    copy: "All providers complete thorough background checks for your peace of mind.",
    icon: ShieldCheck,
    tone: "deep",
  },
  {
    title: "Identity verification",
    copy: "We verify IDs and contact information to ensure trusted connections.",
    icon: IdCard,
    tone: "gold",
  },
  {
    title: "Visit updates for families",
    copy: "Receive updates after every visit so you always know how things went.",
    icon: Bell,
    tone: "sage",
  },
];

export default function HomePage() {
  return (
    <main className="site-shell">
      <header className="nav">
        <a className="brand" href="#" aria-label="Golden Home Care home">
          <span className="brand-mark">
            <Home size={34} strokeWidth={1.6} />
            <HandHeart size={28} strokeWidth={1.5} />
          </span>
          <span>Golden Home Care</span>
        </a>
        <nav className="nav-links" aria-label="Primary navigation">
          <a href="#how">How It Works</a>
          <a href="#services">Services</a>
          <a href="#safety">Safety</a>
          <a href="#providers">For Providers</a>
          <a href="#faq">FAQ</a>
          <a href="#signin">Sign In</a>
        </nav>
        <a className="nav-cta" href="#start">
          Find care near me
        </a>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <h1>Trusted support for aging parents at home.</h1>
          <p>
            Golden Home Care helps families book trusted local companions for aging
            parents who want to stay independent, with recurring visits,
            provider-set rates, and updates after every visit.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#start">
              Find care near me
            </a>
            <a className="button button-secondary" href="#providers">
              Become a provider
            </a>
          </div>
          <div className="trust-row" aria-label="Golden Home Care trust highlights">
            <span>
              <ShieldCheck size={25} /> Background-checked companions
            </span>
            <span>
              <DollarSign size={25} /> Provider-set rates
            </span>
            <span>
              <HandHeart size={25} /> Non-medical support only
            </span>
          </div>
        </div>

        <div className="hero-visual">
          <Image
            src="/hero-care.png"
            alt="A companion smiling with an older adult at home"
            fill
            priority
            sizes="(min-width: 900px) 55vw, 100vw"
          />
          <aside className="visit-card" aria-label="Upcoming visit details">
            <h2>
              <CalendarDays size={22} /> Upcoming visit
            </h2>
            <p>
              <CalendarCheck2 size={16} /> May 22, 2025
            </p>
            <p>
              <ClockIcon /> 10:00 AM - 12:00 PM
            </p>
            <p>
              <UserRound size={16} /> Sarah J.
            </p>
            <strong>
              <CheckCircle2 size={16} /> Confirmed
            </strong>
          </aside>
          <aside className="rate-card" aria-label="Starting provider rate">
            <span>Starting at</span>
            <strong>$34/hr</strong>
            <p>Provider-set rate</p>
          </aside>
        </div>
      </section>

      <section className="start-section" id="start">
        <div className="section-title">
          <span />
          <h2>Get started with Golden Home Care</h2>
          <span />
        </div>
        <div className="forms-grid">
          <CareForm />
          <ProviderForm />
        </div>
      </section>

      <section className="how-section" id="how">
        <h2>How Golden Home Care works</h2>
        <div className="steps">
          <StepCard
            number="1"
            icon={ClipboardCheck}
            title="Tell us what your loved one needs"
            copy="Share location, needs, and preferences."
          />
          <StepArrow />
          <StepCard
            number="2"
            icon={Search}
            title="Browse trusted providers and rates"
            copy="Compare profiles, reviews, and provider-set rates."
          />
          <StepArrow />
          <StepCard
            number="3"
            icon={CalendarCheck2}
            title="Book recurring visits and receive updates"
            copy="Confirm visits and get updates after every visit."
          />
        </div>
      </section>

      <section className="support-section" id="services">
        <h2>Simple support for independent living</h2>
        <div className="service-grid">
          {services.map((service) => (
            <FeatureCard key={service.title} {...service} />
          ))}
        </div>
        <p className="support-note">
          <Heart size={18} /> Golden Home Care providers offer non-medical support
          only.
        </p>
      </section>

      <section className="safety-section" id="safety">
        <h2>Built on trust and safety</h2>
        <div className="safety-grid">
          {trustItems.map((item) => (
            <FeatureCard key={item.title} {...item} wide />
          ))}
        </div>
      </section>

      <section className="cta-band">
        <div className="vine vine-left" />
        <h2>Help your parent stay independent with trusted support nearby.</h2>
        <a className="button button-primary" href="#start">
          Get started
        </a>
        <div className="vine vine-right" />
      </section>

      <footer className="footer">
        <div className="footer-brand">
          <a className="brand" href="#" aria-label="Golden Home Care home">
            <span className="brand-mark">
              <Home size={31} strokeWidth={1.6} />
              <HandHeart size={25} strokeWidth={1.5} />
            </span>
            <span>Golden Home Care</span>
          </a>
          <p>Non-medical support for older adults and their families.</p>
        </div>
        <div className="footer-links">
          <a href="#how">How It Works</a>
          <a href="#services">Services</a>
          <a href="#safety">Safety</a>
        </div>
        <div className="footer-links">
          <a href="#providers">For Providers</a>
          <a href="#faq">FAQ</a>
          <a href="#blog">Blog</a>
        </div>
        <div className="footer-links">
          <a href="#about">About Us</a>
          <a href="#careers">Careers</a>
          <a href="#contact">Contact Us</a>
        </div>
        <div className="socials" aria-label="Social links">
          <span>f</span>
          <span>ig</span>
          <span>in</span>
          <p>© 2025 Golden Home Care, Inc. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}

function CareForm() {
  return (
    <form className="form-card" aria-label="Find care near me">
      <div className="form-heading">
        <span className="icon-bubble gold">
          <UsersRound size={34} />
        </span>
        <div>
          <h2>Find care near me</h2>
          <p>For families looking for support for an aging loved one.</p>
        </div>
      </div>
      <label>
        ZIP code
        <input type="text" placeholder="Enter ZIP code" inputMode="numeric" />
      </label>
      <SelectLabel label="What help is needed?" placeholder="Select help needed" />
      <SelectLabel label="How often?" placeholder="Select frequency" />
      <SelectLabel label="Budget range" placeholder="Select budget range" />
      <label>
        Your email
        <input type="email" placeholder="you@example.com" />
      </label>
      <button className="button button-primary form-button" type="button">
        See available companions
      </button>
      <p className="form-note">
        <Heart size={18} /> Companionship, errands, walks, and medication
        reminders.
      </p>
    </form>
  );
}

function ProviderForm() {
  return (
    <form className="form-card provider-card" aria-label="Become a provider">
      <div className="form-heading">
        <span className="icon-bubble deep">
          <UserRound size={34} />
        </span>
        <div>
          <h2>Become a provider</h2>
          <p>For companions who want to support older adults in their community.</p>
        </div>
      </div>
      <label className="full">
        Your location
        <input type="text" placeholder="City, State or ZIP code" />
      </label>
      <label className="full input-with-prefix">
        Hourly rate
        <span>$</span>
        <input type="text" placeholder="Enter your hourly rate" inputMode="decimal" />
      </label>
      <SelectLabel label="Senior-care experience" placeholder="Select experience level" />
      <SelectLabel label="Services offered" placeholder="Select services" />
      <SelectLabel label="Availability" placeholder="Select availability" />
      <label>
        Your email
        <input type="email" placeholder="you@example.com" />
      </label>
      <button className="button button-outline form-button full" type="button">
        Apply to join
      </button>
      <p className="form-note full">
        <BadgeCheck size={18} /> Set your own rates and choose the services you
        offer.
      </p>
    </form>
  );
}

function SelectLabel({
  label,
  placeholder,
}: {
  label: string;
  placeholder: string;
}) {
  return (
    <label className="select-label">
      {label}
      <span>
        {placeholder}
        <ChevronDown size={16} />
      </span>
    </label>
  );
}

function StepCard({
  number,
  icon: Icon,
  title,
  copy,
}: {
  number: string;
  icon: LucideIcon;
  title: string;
  copy: string;
}) {
  return (
    <article className="step-card">
      <span className="step-icon">
        <Icon size={44} strokeWidth={1.7} />
      </span>
      <span className="step-number">{number}</span>
      <div>
        <h3>{title}</h3>
        <p>{copy}</p>
      </div>
    </article>
  );
}

function StepArrow() {
  return (
    <span className="step-arrow" aria-hidden="true">
      ›
    </span>
  );
}

function FeatureCard({
  title,
  copy,
  icon: Icon,
  tone,
  wide,
}: {
  title: string;
  copy: string;
  icon: LucideIcon;
  tone: string;
  wide?: boolean;
}) {
  return (
    <article className={`feature-card ${wide ? "wide" : ""}`}>
      <span className={`icon-bubble ${tone}`}>
        <Icon size={34} strokeWidth={1.7} />
      </span>
      <div>
        <h3>{title}</h3>
        <p>{copy}</p>
      </div>
    </article>
  );
}

function ClockIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
