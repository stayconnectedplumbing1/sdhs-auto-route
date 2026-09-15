const setupSteps = [
  {
    title: "Connect ServiceM8",
    body: "The owner approves access once. Auto Route then uses that business’ own jobs, staff and schedule.",
  },
  {
    title: "Sync live data",
    body: "Bring in technicians, waiting jobs, booked jobs and ServiceM8 locations.",
  },
  {
    title: "Set dispatch rules",
    body: "Choose urgent job types, booking windows, tech skills, tools and daily capacity.",
  },
  {
    title: "Start routing",
    body: "Recommend the closest suitable technician and push confirmed bookings back.",
  },
];

const requirements = [
  "ServiceM8 admin access",
  "Staff and schedules already in ServiceM8",
  "Urgent services and service areas checked",
  "Subscription activated before launch",
];

const benefits = [
  { value: "1", label: "ServiceM8 connection per business" },
  { value: "4", label: "guided setup steps" },
  { value: "0", label: "separate passwords at install" },
];

export default function OnboardingPage() {
  return (
    <main className="commercial-shell">
      <nav className="commercial-topbar" aria-label="Auto Route onboarding">
        <a className="commercial-brand" href="/">
          <span>AR</span>
          <div>
            <b>Auto Route</b>
            <small>ServiceM8 dispatch add-on</small>
          </div>
        </a>
        <a className="commercial-top-link" href="/">
          Board
        </a>
      </nav>

      <section className="commercial-hero">
        <div className="commercial-hero-copy">
          <span className="commercial-eyebrow">Commercial preview</span>
          <h1>Dispatch jobs faster from ServiceM8</h1>
          <p>
            A mobile-friendly setup flow for businesses to connect ServiceM8,
            sync their data, set rules and start routing without a messy login
            process.
          </p>
          <div className="commercial-actions">
            <a className="primary-action" href="/api/servicem8/connect">
              Connect ServiceM8
            </a>
            <a className="secondary-action" href="/">
              Preview board
            </a>
          </div>
        </div>

        <aside className="commercial-phone-card" aria-label="Setup summary">
          <div className="phone-card-header">
            <span />
            <b>Ready for setup</b>
          </div>
          {benefits.map((item) => (
            <div className="phone-stat" key={item.label}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
          <a href="/api/servicem8/connect">Start connection →</a>
        </aside>
      </section>

      <section className="commercial-mobile-status" aria-label="What happens next">
        <div>
          <span>01</span>
          <b>Connect</b>
          <small>Approve ServiceM8 access</small>
        </div>
        <div>
          <span>02</span>
          <b>Sync</b>
          <small>Load jobs and staff</small>
        </div>
        <div>
          <span>03</span>
          <b>Route</b>
          <small>Book the best tech</small>
        </div>
      </section>

      <section className="commercial-panel">
        <div>
          <span className="commercial-eyebrow">Setup flow</span>
          <h2>Simple enough for a business owner on their phone</h2>
        </div>
        <div className="commercial-steps">
          {setupSteps.map((step, index) => (
            <article key={step.title}>
              <span>{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="commercial-grid">
        <article className="commercial-card">
          <h2>How login should work</h2>
          <p>
            For a ServiceM8 add-on, the clean path is: install add-on, approve
            access, then Auto Route recognises the connected business. A normal
            email/password login can be added later for billing or owner admin
            outside ServiceM8.
          </p>
        </article>
        <article className="commercial-card">
          <h2>Before launch checklist</h2>
          <ul>
            {requirements.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>

      <div className="commercial-sticky-action">
        <a className="primary-action" href="/api/servicem8/connect">
          Connect ServiceM8
        </a>
        <a className="secondary-action" href="/">
          Board
        </a>
      </div>
    </main>
  );
}
