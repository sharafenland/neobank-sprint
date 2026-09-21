#!/usr/bin/env python3
"""Builds the printable Neobank Sprint handout from handout/cards.json.

The card data is exported from src/lib/cards.ts, so the handout cannot drift
from the game. Regenerate with:  npm run handout
"""
import json
import pathlib

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Frame, KeepTogether, PageBreak, PageTemplate,
    Paragraph, Spacer, Table, TableStyle,
)

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = json.loads((ROOT / "handout" / "cards.json").read_text(encoding="utf-8"))
OUT = ROOT / "handout" / "neobank-sprint-handout.pdf"

INK    = colors.HexColor("#16211F")
MUTED  = colors.HexColor("#5E6E6B")
FAINT  = colors.HexColor("#8A9A97")
LINE   = colors.HexColor("#D5DEDB")
ACCENT = colors.HexColor("#0E7C86")
SOFT   = colors.HexColor("#E7F1F1")
AMBER  = colors.HexColor("#B36A2E")
BAD    = colors.HexColor("#AB2E38")
PAPER  = colors.HexColor("#F7F9F8")

ss = getSampleStyleSheet()
def style(name, **kw):
    base = dict(fontName="Helvetica", fontSize=8.5, leading=11, textColor=INK, alignment=TA_LEFT)
    base.update(kw)
    return ParagraphStyle(name, **base)

H1     = style("H1", fontName="Helvetica-Bold", fontSize=21, leading=24, spaceAfter=2)
EYE    = style("EYE", fontName="Courier", fontSize=7, leading=9, textColor=FAINT, spaceAfter=3)
H2     = style("H2", fontName="Helvetica-Bold", fontSize=12.5, leading=15, spaceBefore=13, spaceAfter=4)
BODY   = style("BODY", textColor=MUTED, leading=12)
CELL   = style("CELL", fontSize=7.4, leading=9)
CELLB  = style("CELLB", fontSize=7.4, leading=9, fontName="Helvetica-Bold")
CELLM  = style("CELLM", fontSize=7.2, leading=9, textColor=MUTED)
MONO   = style("MONO", fontName="Courier", fontSize=7.8, leading=11)
MONOB  = style("MONOB", fontName="Courier-Bold", fontSize=7.8, leading=11)

def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Courier", 6.5)
    canvas.setFillColor(FAINT)
    canvas.drawString(18 * mm, 12 * mm, "NEOBANK SPRINT  ·  FINANCIAL SOFTWARE ENGINEERING")
    canvas.drawRightString(A4[0] - 18 * mm, 12 * mm, f"{doc.page}")
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.4)
    canvas.line(18 * mm, 15 * mm, A4[0] - 18 * mm, 15 * mm)
    canvas.restoreState()

doc = BaseDocTemplate(
    str(OUT), pagesize=A4,
    leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=20 * mm,
    title="Neobank Sprint — handout", author="Financial Software Engineering",
)
doc.addPageTemplates([PageTemplate(
    id="main",
    frames=[Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="f")],
    onPage=header_footer,
)])

W = doc.width
story = []

def table(rows, widths, head=True, zebra=True, pad=3.2):
    t = Table(rows, colWidths=widths, repeatRows=1 if head else 0, hAlign="LEFT")
    cmds = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), pad),
        ("BOTTOMPADDING", (0, 0), (-1, -1), pad),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, 0), (-1, -2), 0.3, LINE),
    ]
    if head:
        cmds += [("LINEBELOW", (0, 0), (-1, 0), 0.7, INK), ("BOTTOMPADDING", (0, 0), (-1, 0), 4)]
    if zebra:
        for i in range(2 if head else 1, len(rows), 2):
            cmds.append(("BACKGROUND", (0, i), (-1, i), PAPER))
    t.setStyle(TableStyle(cmds))
    return t

def th(text):
    return Paragraph(f'<font face="Courier" size="6.4" color="#8A9A97">{text.upper()}</font>', CELL)

# ───────────────────────── page 1: the rules ─────────────────────────
story += [
    Paragraph("FINANCIAL SOFTWARE ENGINEERING · IN-CLASS SIMULATION", EYE),
    Paragraph("Neobank Sprint", H1),
    Spacer(1, 3),
    Paragraph(
        "Your group runs a neobank for several sprints. You plan, build, get hit by an incident, release, and "
        "watch the regulator react. Most customers at the end wins &mdash; if you can still ship by then.", BODY),
]

story.append(Paragraph("The three rolls", H2))
formulas = [
    ["DEVELOP",  "d20 + Dev  ≥  sum of the targets you picked (+ legacy drag)", "all or nothing"],
    ["MITIGATE", "d20 + Mit  ≥  the incident's target", "what you built earlier moves this"],
    ["RELEASE",  "d20 + Rel − bugs − 2 per buggy feature  ≥  sum of release targets", "miss it → 25% of the reward"],
]
story.append(table(
    [[th("roll"), th("formula"), th("note")]] +
    [[Paragraph(f'<font face="Courier-Bold" size="7">{a}</font>', CELL),
      Paragraph(b, MONO), Paragraph(c, CELLM)] for a, b, c in formulas],
    [20 * mm, W - 62 * mm, 42 * mm]))

story.append(Paragraph("The six phases of a sprint", H2))
story.append(table(
    [[th("#"), th("phase"), th("what happens")]] +
    [[Paragraph(f'<font face="Courier" size="7" color="#0E7C86">{i+1:02d}</font>', CELL),
      Paragraph(p["n"], CELLB), Paragraph(p["lead"], CELLM)]
     for i, p in enumerate(DATA["PHASES"])],
    [9 * mm, 38 * mm, W - 47 * mm]))

story.append(Paragraph("Two kinds of debt", H2))
debt = [
    ["", "Bugs", "Audit findings"],
    ["Earned by", "Pushing unfinished work through", "Failed incidents and regulatory cards"],
    ["Taxes", "Every Release roll", "Every Mitigation roll"],
    ["Hard wall", "5 bugs → nothing ships at all", "3 findings → one slot less capacity"],
    ["Paid down by", "Automated Testing, or a slot (\u22122)", "Compliance by Design, or a slot (\u22121)"],
]
rows = [[th(c) if i == 0 else (Paragraph(c, CELLM) if j == 0 else Paragraph(c, CELL))
         for j, c in enumerate(r)] for i, r in enumerate(debt)]
t = table(rows, [24 * mm, (W - 24 * mm) / 2, (W - 24 * mm) / 2])
t.setStyle(TableStyle([("TEXTCOLOR", (1, 3), (1, 3), BAD), ("TEXTCOLOR", (2, 3), (2, 3), BAD)]))
story.append(t)

story.append(Paragraph("Legacy drag", H2))
story.append(Paragraph(
    "<b>One platform card carries two product features.</b> Every product feature past that adds +1 to your "
    "combined Development target, up to +6. Platform cards earn few customers and pay a permanent modifier "
    "instead &mdash; capped at +4 in each of Dev, Rel and Mit. The bug counter models unfinished work; legacy "
    "drag models the architecture you never built.", BODY))

story.append(Paragraph("Investment points", H2))
story.append(Paragraph(
    "Every retro pays <b>two</b>. From sprint 3 it pays a <b>third</b> if the sprint handled its incident &mdash; "
    "rolled against it and won, or built the card that removes it &mdash; or ended with no bugs. Only one extra "
    "point, however well both went. <b>Points do not carry over:</b> whatever is not spent at the retro is gone "
    "when the next sprint starts, so the three-point practices are only within reach in a sprint that earned "
    "the bonus.", BODY))

story.append(Paragraph("Paying down debt", H2))
story.append(Paragraph(
    "A slot does not have to go on a feature. In planning you may spend one on remediation instead: "
    "<b>one slot clears two bugs, or one audit finding</b>. It takes effect at the start of Development, before "
    "the release roll &mdash; so at five bugs, one slot gets you shipping again in the same sprint. It costs you "
    "whatever that slot would have earned.", BODY))

story.append(Paragraph("The table", H2))
story.append(Paragraph(
    "Six cards each sprint: three product, three platform. One of each rotates off the table at the end of the "
    "sprint, whether or not anyone took it &mdash; a card is therefore available for exactly three sprints. "
    "Capacity is 2 slots, 3 with Cross-Functional Team, 1 fewer while you hold three open findings. The two "
    "migration cards cost three slots on their own and stay off the table until the third slot can be bought. "
    "Taking no new work is a legal move.", BODY))

# ───────────────────────── page 2: product + practices ─────────────────────────
story.append(PageBreak())
prod = [f for f in DATA["FEATURES"] if f["c"] != "platform"]
story.append(Paragraph(f"Product cards ({len(prod)})", H2))
story.append(Paragraph("Customers now. Nothing permanent.", BODY))
story.append(Spacer(1, 4))
story.append(table(
    [[th("card"), th("kind"), th("dev"), th("rel"), th("users"), th("cost"), th("what it is")]] +
    [[Paragraph(f["n"], CELLB), Paragraph(f["c"], CELLM),
      Paragraph(str(f["t"]), MONO), Paragraph(str(f["r"]), MONO),
      Paragraph(f'{f["k"]}k', MONOB), Paragraph(str(f["s"]), MONO),
      Paragraph(f["b"], CELLM)]
     for f in sorted(prod, key=lambda x: -x["k"])],
    [34 * mm, 17 * mm, 9 * mm, 9 * mm, 11 * mm, 10 * mm, W - 90 * mm]))

story.append(Paragraph(f"Agile practices ({len(DATA['PRACTICES'])})", H2))
story.append(Paragraph("Bought with Investment Points at the retro. Permanent, and they compound.", BODY))
story.append(Spacer(1, 4))
story.append(table(
    [[th("practice"), th("cost"), th("session"), th("effect")]] +
    [[Paragraph(p["n"], CELLB), Paragraph(f'{p["ip"]} IP', MONOB),
      Paragraph(p["src"].replace("Session ", ""), CELLM), Paragraph(p["e"], CELL)]
     for p in DATA["PRACTICES"]],
    [38 * mm, 12 * mm, 15 * mm, W - 65 * mm]))

# ───────────────────────── page 3: platform ─────────────────────────
story.append(PageBreak())
plat = [f for f in DATA["FEATURES"] if f["c"] == "platform"]
story.append(Paragraph(f"Platform cards ({len(plat)})", H2))
story.append(Paragraph(
    "Few customers, permanent leverage. The session number is the lecture the card comes from.", BODY))
story.append(Spacer(1, 4))

def bonus_text(f):
    b = f.get("bonus")
    if not b:
        return "—"
    return "  ".join(f'{k.capitalize()} +{v}' for k, v in (("dev", b.get("dev")), ("rel", b.get("rel")), ("mit", b.get("mit"))) if v)

story.append(table(
    [[th("card"), th("s"), th("dev"), th("rel"), th("users"), th("cost"), th("permanent"), th("what it is")]] +
    [[Paragraph(f["n"], CELLB), Paragraph(f.get("src", "").replace("Session ", ""), CELLM),
      Paragraph(str(f["t"]), MONO), Paragraph(str(f["r"]), MONO),
      Paragraph(f'{f["k"]}k', MONO), Paragraph(str(f["s"]), MONO),
      Paragraph(f'<font color="#0E7C86">{bonus_text(f)}</font>', MONOB),
      Paragraph(f["b"], CELLM)]
     for f in sorted(plat, key=lambda x: (x.get("src", "zz"), -x["t"]))],
    [32 * mm, 7 * mm, 9 * mm, 9 * mm, 10 * mm, 9 * mm, 24 * mm, W - 100 * mm], pad=2.6))

# ───────────────────────── page 4: incidents and events ─────────────────────────
story.append(PageBreak())
INC_HELP = {
    "outage":    ("Observability avoids −3; Caching or Sharding +3", "−10% customers, +1 bug"),
    "breach":    ("Privacy & GDPR +2; Security Audit Log +2", "−26% (−14% with Privacy), +2 findings"),
    "resign":    ("Pair Programming or Documentation Wiki removes it", "−3 on this sprint's Dev roll"),
    "audit":     ("AML Monitoring +3; Security Audit Log +2", "+2 audit findings"),
    "scheme":    ("CI/CD Pipeline +3", "releases blocked this sprint"),
    "fraudring": ("Fraud Detection removes it; Rate Limiting +3", "−13%, +1 finding"),
    "region":    ("Disaster Recovery removes it; Backup +3, Load Balancer +1", "−16% customers"),
    "cve":       ("Automated Testing or Test Suite +3; Gates +1; Containers +1", "+2 bugs"),
    "sla":       ("only hits you if you shipped SEPA Instant", "−12%, +1 finding"),
    "warroom":   ("Blameless Postmortems removes it", "−1 Investment Point"),
    "reporting": ("Data Warehouse removes it; Data Pipeline +3", "+1 finding, −5%"),
    "phish":     ("Strong Customer Auth +4; Rate Limiting +2", "−9% customers"),
}
story.append(Paragraph(f"Incidents ({len(DATA['INCIDENTS'])})", H2))
story.append(Paragraph("One card per sprint. It hits every group, but not equally.", BODY))
story.append(Spacer(1, 4))
story.append(table(
    [[th("incident"), th("target"), th("what moves the roll"), th("if you fail")]] +
    [[Paragraph(c["n"], CELLB),
      Paragraph("—" if c["mit"] is None else str(c["mit"]), MONOB),
      Paragraph(INC_HELP[c["id"]][0], CELLM),
      Paragraph(f'<font color="#AB2E38">{INC_HELP[c["id"]][1]}</font>', CELL)]
     for c in DATA["INCIDENTS"]],
    [36 * mm, 13 * mm, (W - 49 * mm) * 0.53, (W - 49 * mm) * 0.47]))

EV = {
    "dora":     ("Disaster Recovery → +12k", "otherwise −10%, +1 finding"),
    "gdprwave": ("Privacy & GDPR → +8k", "otherwise −16%"),
    "ipr":      ("SEPA Instant → +15k", "otherwise −9%"),
    "mica":     ("Crypto Custody → +18k", "—"),
    "openbank": ("PSD2 API → +11k", "—"),
    "rates":    ("Savings Pots → +14k", "otherwise −5%"),
    "pricewar": ("Mobile App → only −2%", "otherwise −12%"),
    "trust":    ("no findings → +9k", "1–2 → −5%, three or more → −15%"),
    "latency":  ("two of CDN / Caching / Profiling → +12k, one → +3k", "none → −10%"),
    "hiring":   ("two of Wiki / Gates / Test Suite → +2k and +1 IP", "—"),
    "feature":  ("the leader → +13k", "—"),
    "winter":   ("—", "leader −14%, everyone else −7%"),
    "viral":    ("fewest bugs → +12k", "otherwise −4% per bug"),
}
story.append(Paragraph(f"Market events ({len(DATA['EVENTS'])})", H2))
story.append(Paragraph(
    "One card per sprint, resolved against what each group has actually built. Gains are fixed amounts; "
    "losses are a share of the customers you already have, so they grow with you.", BODY))
story.append(Spacer(1, 4))
story.append(table(
    [[th("event"), th("pays"), th("costs")]] +
    [[Paragraph(c["n"], CELLB),
      Paragraph(f'<font color="#38724A">{EV[c["id"]][0]}</font>', CELL),
      Paragraph(f'<font color="#AB2E38">{EV[c["id"]][1]}</font>', CELL)]
     for c in DATA["EVENTS"]],
    [44 * mm, (W - 44 * mm) * 0.5, (W - 44 * mm) * 0.5]))

# ───────────────────────── page 5: tracker ─────────────────────────
story.append(PageBreak())
story.append(Paragraph("Sprint tracker", H2))
story.append(Paragraph(
    "Fill this in as you go. Your console keeps the real numbers &mdash; this is for the debrief, "
    "so you can point at the sprint where it turned.", BODY))
story.append(Spacer(1, 6))
cols = ["Sprint", "Picked", "Dev roll", "Incident", "Released", "Customers", "Bugs", "Findings", "Bought"]
widths = [13 * mm, 32 * mm, 16 * mm, 24 * mm, 24 * mm, 20 * mm, 12 * mm, 14 * mm, 0]
widths[-1] = W - sum(widths[:-1])
rows = [[th(c) for c in cols]] + [[Paragraph(f'<font face="Courier" size="7.5">{i}</font>', CELL)] + [""] * 8
                                  for i in range(1, 9)]
t = Table(rows, colWidths=widths, rowHeights=[8 * mm] + [13 * mm] * 8, hAlign="LEFT")
t.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("GRID", (0, 0), (-1, -1), 0.3, LINE),
    ("LINEBELOW", (0, 0), (-1, 0), 0.7, INK),
    ("TOPPADDING", (0, 0), (-1, -1), 3),
    ("LEFTPADDING", (0, 0), (-1, -1), 4),
]))
story.append(t)
story.append(Spacer(1, 10))
story.append(Paragraph(
    'Adapted from the CatTube sprint game, itself inspired by the &ldquo;Agile 101&rdquo; board game by '
    'Emma Hopkinson-Spark (101 Ways).', style("cr", fontSize=7, textColor=FAINT)))

doc.build(story)
print(f"wrote {OUT.relative_to(ROOT)}")
