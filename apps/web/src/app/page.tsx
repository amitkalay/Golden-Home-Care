import Image from "next/image";
import {
  BadgeCheck,
  Bell,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
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
  Utensils,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { submitFamilyLead, submitServiceProviderLead } from "./actions";
import {
  frequencyOptions,
  helpNeededOptions,
  neededTimelineOptions,
  relationshipOptions,
} from "./family-leads/validation.js";
import {
  availabilityOptions,
  providerServiceOptions,
  seniorCareExperienceOptions,
} from "./provider-leads/validation.js";

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
    title: "Meal Prep",
    copy: "Simple meal prep support to keep daily routines easier.",
    icon: Utensils,
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

const SURVEY_ACKNOWLEDGEMENT =
  "We appreciate your help! Your survey responses will directly guide how we build this platform to ensure it meets your needs. We’ll be in touch with next steps as we develop this service.";

type HomePageProps = {
  searchParams?: Promise<{
    lead?: string | string[];
    providerLead?: string | string[];
  }>;
};

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = searchParams ? await searchParams : {};
  const leadStatus = Array.isArray(params.lead) ? params.lead[0] : params.lead;
  const providerLeadStatus = Array.isArray(params.providerLead)
    ? params.providerLead[0]
    : params.providerLead;

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
      </header>

      <section className="hero">
        <div className="hero-copy">
          <h1>Concierge senior center platform bringing premium services and entertainment to you.</h1>
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
        </div>

        <div className="hero-visual">
          <div className="hero-media">
            <Image
              src="/hero-concierge-services.png"
              alt="Older adults enjoying piano instruction and supportive help at home"
              fill
              priority
              sizes="(min-width: 900px) 52vw, 100vw"
            />
          </div>
          <div className="hero-info-row">
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
      </section>

      <section className="start-section" id="start">
        <div className="section-title">
          <span />
          <h2>Get started with Golden Home Care</h2>
          <span />
        </div>
        <div className="forms-grid">
          <CareForm status={leadStatus} />
          <ProviderForm status={providerLeadStatus} />
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

function CareForm({ status }: { status?: string }) {
  return (
    <form className="form-card care-card" aria-label="Find care near me" action={submitFamilyLead}>
      <div className="form-heading">
        <span className="icon-bubble gold">
          <UsersRound size={34} />
        </span>
        <div>
          <h2>Find care near me</h2>
          <p>Share a few details so we can understand what kind of support would help.</p>
        </div>
      </div>
      <label className="honeypot" aria-hidden="true">
        Company website
        <input name="companyWebsite" type="text" tabIndex={-1} autoComplete="off" />
      </label>
      <label>
        Name
        <input name="name" type="text" placeholder="Your name" autoComplete="name" required />
      </label>
      <label>
        Email
        <input name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
      </label>
      <label>
        Phone <span className="optional-text">Optional</span>
        <input name="phone" type="tel" placeholder="(555) 123-4567" autoComplete="tel" />
      </label>
      <label>
        ZIP code <span className="optional-text">Optional</span>
        <input name="zipCode" type="text" placeholder="Enter ZIP code" inputMode="numeric" autoComplete="postal-code" />
      </label>
      <label>
        Relationship to older adult
        <select name="relationship" defaultValue="" required>
          <option value="" disabled>
            Select relationship
          </option>
          {relationshipOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="checkbox-group full">
        <legend>Help needed</legend>
        {helpNeededOptions.map((option) => (
          <label key={option.value}>
            <input name="helpNeeded" type="checkbox" value={option.value} />
            <span>{option.label}</span>
          </label>
        ))}
        <label className="help-freeform">
          <span className="sr-only">Other help needed</span>
          <input name="helpNeededOtherSelected" type="checkbox" value="true" aria-label="Other help needed" />
          <input
            name="helpNeededOther"
            type="text"
            aria-label="Other help needed"
            placeholder="Something else"
            maxLength={160}
          />
        </label>
      </fieldset>
      <label>
        How often?
        <select name="frequency" defaultValue="" required>
          <option value="" disabled>
            Select frequency
          </option>
          {frequencyOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label>
        When do you need help?
        <select name="neededTimeline" defaultValue="" required>
          <option value="" disabled>
            Select timeline
          </option>
          {neededTimelineOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <label className="full">
        Additional notes or feedback <span className="optional-text">Optional</span>
        <textarea name="notes" placeholder="Share anything helpful for us to better support your needs." rows={4} />
      </label>
      <button className="button button-primary form-button full" type="submit">
        Find care near me
      </button>
      <LeadStatusMessage status={status} />
      <p className="form-note">
        <Heart size={18} /> Companionship, errands, walks, and meal prep.
      </p>
    </form>
  );
}

function LeadStatusMessage({ status }: { status?: string }) {
  if (status === "success") {
    return (
      <p className="form-alert success full" role="status">
        {SURVEY_ACKNOWLEDGEMENT}
      </p>
    );
  }

  if (status === "invalid") {
    return (
      <p className="form-alert error full" role="alert">
        Please complete the required fields and select at least one type of help.
      </p>
    );
  }

  if (status === "error") {
    return (
      <p className="form-alert error full" role="alert">
        We could not save your request. Please try again in a moment.
      </p>
    );
  }

  return null;
}

function ProviderLeadStatusMessage({ status }: { status?: string }) {
  if (status === "success") {
    return (
      <p className="form-alert success full" role="status">
        {SURVEY_ACKNOWLEDGEMENT}
      </p>
    );
  }

  if (status === "invalid") {
    return (
      <p className="form-alert error full" role="alert">
        Please complete the required fields and select at least one service.
      </p>
    );
  }

  if (status === "error") {
    return (
      <p className="form-alert error full" role="alert">
        We could not save your application. Please try again in a moment.
      </p>
    );
  }

  return null;
}

function ProviderForm({ status }: { status?: string }) {
  return (
    <form className="form-card provider-card" aria-label="Become a provider" action={submitServiceProviderLead}>
      <div className="form-heading">
        <span className="icon-bubble deep">
          <UserRound size={34} />
        </span>
        <div>
          <h2>Become a provider</h2>
          <p>For companions who want to support older adults in their community.</p>
        </div>
      </div>
      <label className="honeypot" aria-hidden="true">
        Company website
        <input name="providerCompanyWebsite" type="text" tabIndex={-1} autoComplete="off" />
      </label>
      <label>
        Name
        <input name="name" type="text" placeholder="Your name" autoComplete="name" required />
      </label>
      <label>
        Email
        <input name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
      </label>
      <label>
        Phone <span className="optional-text">Optional</span>
        <input name="phone" type="tel" placeholder="(555) 123-4567" autoComplete="tel" />
      </label>
      <label>
        ZIP code / service area
        <input name="serviceArea" type="text" placeholder="City, State or ZIP code" autoComplete="postal-code" required />
      </label>
      <label className="input-with-prefix">
        Hourly rate ($/hour)
        <input
          name="hourlyRate"
          type="number"
          placeholder="Enter your hourly rate"
          inputMode="numeric"
          min="0"
          step="1"
          required
        />
      </label>
      <label>
        Senior-care experience
        <select name="seniorCareExperience" defaultValue="" required>
          <option value="" disabled>
            Select experience level
          </option>
          {seniorCareExperienceOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="checkbox-group full">
        <legend>Services you can offer</legend>
        {providerServiceOptions.map((option) => (
          <label key={option.value}>
            <input name="servicesOffered" type="checkbox" value={option.value} />
            <span>{option.label}</span>
          </label>
        ))}
        <label className="help-freeform">
          <span className="sr-only">Other services you can offer</span>
          <input name="servicesOfferedOtherSelected" type="checkbox" value="true" aria-label="Other services you can offer" />
          <input
            name="servicesOfferedOther"
            type="text"
            aria-label="Other services you can offer"
            placeholder="Something else"
            maxLength={160}
          />
        </label>
      </fieldset>
      <label>
        Availability
        <select name="availability" defaultValue="" required>
          <option value="" disabled>
            Select availability
          </option>
          {availabilityOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="radio-group">
        <legend>Willing to complete background check?</legend>
        <label>
          <input name="backgroundCheckWilling" type="radio" value="yes" required />
          <span>Yes</span>
        </label>
        <label>
          <input name="backgroundCheckWilling" type="radio" value="no" required />
          <span>No</span>
        </label>
      </fieldset>
      <label className="full">
        Notes <span className="optional-text">Optional</span>
        <textarea name="notes" placeholder="Share anything helpful about your experience or availability." rows={4} />
      </label>
      <button className="button button-outline form-button full" type="submit">
        Apply to join
      </button>
      <ProviderLeadStatusMessage status={status} />
      <p className="form-note full">
        <BadgeCheck size={18} /> Set your own rates and choose the services you
        offer.
      </p>
    </form>
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
