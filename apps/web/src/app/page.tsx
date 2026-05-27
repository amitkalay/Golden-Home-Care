import Image from "next/image";
import Link from "next/link";
import {
  Bell,
  CalendarCheck2,
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
  type LucideIcon,
} from "lucide-react";
import { getCurrentUserSession } from "./lib/auth";
import { getMessageInboxThreadBundlesForUser } from "./messages/db";
import { InboxPopover } from "./messages/inbox-popover";
import { getNextUpcomingVisitForUser } from "./requests/db";
import { GoogleSignInButton } from "./sign-in/google-sign-in-button";
import { SignOutButton } from "./sign-out-button";
import { UpcomingVisitCard } from "./upcoming-visit-card";

export const dynamic = "force-dynamic";

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

export default async function HomePage() {
  const session = await getCurrentUserSession();
  const userName = session?.user?.name || session?.user?.email?.split("@")[0] || "there";
  const providerHref = session?.user?.id ? "/provider/onboarding" : "/sign-in?callbackUrl=/provider/onboarding";
  let inboxThreads: Awaited<ReturnType<typeof getMessageInboxThreadBundlesForUser>> = [];
  let upcomingVisit: Awaited<ReturnType<typeof getNextUpcomingVisitForUser>> = null;

  if (session?.user?.id) {
    [inboxThreads, upcomingVisit] = await Promise.all([
      getMessageInboxThreadBundlesForUser(session.user.id),
      getNextUpcomingVisitForUser(session.user.id),
    ]);
  }

  return (
    <main className="site-shell">
      <header className="nav">
        <Link className="brand" href="/" aria-label="Golden Home Care home">
          <span className="brand-mark">
            <Home size={34} strokeWidth={1.6} />
            <HandHeart size={28} strokeWidth={1.5} />
          </span>
          <span>Golden Home Care</span>
        </Link>
        <nav className="nav-links" aria-label="Primary navigation">
          <a href="#services">Services</a>
          <a href="#safety">Safety</a>
          <a href={providerHref}>For Providers</a>
        </nav>
        <div className="nav-account" aria-label="Account">
          {session?.user?.id ? (
            <>
              <Link className="nav-user" href="/account">
                <span className="nav-avatar">
                  {session.user.image ? (
                    <Image src={session.user.image} alt="" fill sizes="36px" />
                  ) : (
                    userName.slice(0, 1)
                  )}
                </span>
                <span>Hello, {userName}</span>
              </Link>
              <InboxPopover currentUserId={session.user.id} initialThreads={inboxThreads} />
              <SignOutButton className="nav-link-button" />
            </>
          ) : (
            <GoogleSignInButton
              callbackUrl="/"
              className="button button-primary nav-auth-button"
              label="Sign In"
            />
          )}
        </div>
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
            <a className="button button-primary" href="/providers">
              Find care near me
            </a>
            <a className="button button-secondary" href={providerHref}>
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
            <UpcomingVisitCard visit={upcomingVisit} />
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
        <a className="button button-primary" href="/providers">
          Get started
        </a>
        <div className="vine vine-right" />
      </section>

      <footer className="footer">
        <div className="footer-brand">
          <Link className="brand" href="/" aria-label="Golden Home Care home">
            <span className="brand-mark">
              <Home size={31} strokeWidth={1.6} />
              <HandHeart size={25} strokeWidth={1.5} />
            </span>
            <span>Golden Home Care</span>
          </Link>
        </div>
        <div className="footer-links">
          <a href="#services">Services</a>
        </div>
        <div className="footer-links">
          <a href={providerHref}>For Providers</a>
        </div>
        <div className="footer-links">
          <a href="#about">About Us</a>
          <Link href="/feedback">Got Feedback</Link>
        </div>
        <div className="socials" aria-label="Social links">
          <p>© 2026 Golden Home Care, Inc. All rights reserved.</p>
        </div>
      </footer>
    </main>
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
