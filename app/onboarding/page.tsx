const setupSteps = [
  {
    title: "Connect ServiceM8",
    body: "Each business connects with ServiceM8 OAuth, so Auto Route uses their own jobs, staff, schedule and booking rules.",
  },
  {
    title: "Sync live data",
    body: "Pull technicians, waiting jobs, booked jobs, locations, skills and daily capacity into one clean dispatch board.",
  },
  {
    title: "Set dispatch rules",
    body: "Configure urgent services, booking windows, technician tools, service areas and how many jobs each run should hold.",
  },
  {
    title: "Start routing",
    body: "Recommend the closest suitable technician, then write confirmed bookings back to ServiceM8.",
  },
];

const requirements = [
  "ServiceM8 account with permission to install add-ons",
  "Technicians and booking windows set up in ServiceM8",
  "Service areas and urgent job types reviewed",
  "Subscription activated before public use",
];

export default function OnboardingPage() {
  return (
    <main className="commercial-shell">
      <section className="commercial-hero">
        <span className="commercial-eyebrow">Auto Route for ServiceM8</span>
        <h1>Set up intelligent dispatch for your business</h1>
        <p>
          Connect ServiceM8, sync your team, choose your dispatch rules and start
          routing jobs without needing a separate login.
        </p>
        <div className="commercial-actions">
          <a className="primary-action" href="/api/servicem8/connect">
            Connect ServiceM8
          </a>
          <a className="secondary-action" href="/">
            View dispatch board
          </a>
        </div>
      </section>

      <section className="commercial-panel">
        <div>
          <span className="commercial-eyebrow">Setup flow</span>
          <h2>Built for any ServiceM8 business</h2>
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
          <h2>No separate login first</h2>
          <p>
            For a ServiceM8 add-on, the cleanest customer experience is: install
            add-on → approve access → Auto Route recognises the connected
            business. A normal email/password login can come later for owners who
            want to access billing or admin outside ServiceM8.
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
    </main>
  );
}
