import Link from "next/link";
import { JoinForm } from "@/components/JoinForm";

export default function Landing() {
  return (
    <div className="setup">
      <div className="hero">
        <p className="eyebrow">Financial Software Engineering &middot; in-class simulation</p>
        <h1>Neobank Sprint</h1>
        <div className="rule" />
        <p className="lede">
          Each group runs a neobank for a handful of sprints on its own device. They plan, build, get hit by an
          incident, release, and watch the regulator react. Most customers at the end wins &mdash; if they can still
          ship by then.
        </p>
      </div>

      <div className="choose">
        <div className="mode">
          <span className="k">Teaching</span>
          <span className="t">Facilitate a session</span>
          <span className="d">
            Creates the access code, paces the six phases on the projector, reveals the incident and market cards,
            and shows every group&rsquo;s standing live.
          </span>
          <Link className="btn" href="/host">Create a session</Link>
        </div>

        <div className="mode">
          <span className="k">Groups</span>
          <span className="t">Join with a code</span>
          <span className="d">One device per group. Your own backlog, dice, bug count and practice shop.</span>
          <JoinForm />
        </div>
      </div>

      <p style={{ marginTop: 22, fontSize: 13.5, color: "var(--muted)" }}>
        New to it? <Link href="/rules">The rules on one page</Link> &mdash; the three formulas, the six phases and
        every card.
      </p>
    </div>
  );
}
