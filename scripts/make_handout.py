#!/usr/bin/env python3
"""Builds the printable Neobank Sprint handout from handout/cards.json.

Laid out to match the Session 5 lab instructions: the same Frankfurt School
header band, margins, palette and type, so the two sit together in a folder.
Card data is exported from src/lib/cards.ts, so the handout cannot drift from
the game. Regenerate with:  npm run handout
"""
import copy
import json
import pathlib

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageBreak, PageTemplate, Paragraph, Spacer, Table, TableStyle,
)

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = json.loads((ROOT / "handout" / "cards.json").read_text(encoding="utf-8"))
LOGO = ROOT / "handout" / "fs-logo.png"
OUT = ROOT / "handout" / "neobank-sprint-handout.pdf"

# Sampled from FSE_Session_5_Agentic_Lab.pdf so the two documents match exactly.
NAVY    = colors.HexColor("#003E5B")   # header band, and the heading colour
HEADING = colors.HexColor("#004763")
INK     = colors.HexColor("#173042")   # body text
MUTED   = colors.HexColor("#627186")   # subtitles, captions, footer
FAINT   = colors.HexColor("#919DA6")
RULE    = colors.HexColor("#E5EAEF")
CALLOUT = colors.HexColor("#DCE5EA")
CODE    = colors.HexColor("#4B5F6C")
GOOD    = colors.HexColor("#2E6B4F")
BAD     = colors.HexColor("#9E2F38")
ZEBRA   = colors.HexColor("#F5F8FA")

MARGIN = 63          # pt, as measured in the lab handout
BAND_H = 57
FOOT_RULE_Y = 37

def style(name, **kw):
    base = dict(fontName="Helvetica", fontSize=9.6, leading=13.2, textColor=INK, alignment=TA_LEFT)
    base.update(kw)
    return ParagraphStyle(name, **base)

H1     = style("H1", fontSize=26, leading=30, textColor=HEADING, spaceAfter=0)
SUB    = style("SUB", fontSize=10.5, leading=14, textColor=MUTED, spaceBefore=9, spaceAfter=14)
H2     = style("H2", fontSize=15.5, leading=19, textColor=HEADING, spaceBefore=13, spaceAfter=5)
H3     = style("H3", fontSize=10.5, leading=14, fontName="Helvetica-Bold", spaceBefore=12, spaceAfter=3)
BODY   = style("BODY", spaceAfter=6)
LEAD   = style("LEAD", fontSize=10.5, leading=15, spaceAfter=8)
NOTE   = style("NOTE", fontSize=10, leading=14.5)
CELL   = style("CELL", fontSize=7.6, leading=9.6)
CELLB  = style("CELLB", fontSize=7.6, leading=9.6, fontName="Helvetica-Bold")
CELLM  = style("CELLM", fontSize=7.4, leading=9.6, textColor=MUTED)
MONO   = style("MONO", fontName="Courier", fontSize=8.4, leading=12, textColor=CODE)
MONOB  = style("MONOB", fontName="Courier-Bold", fontSize=8.4, leading=12, textColor=INK)
FOOT   = style("FOOT", fontSize=7, leading=9, textColor=MUTED)


def chrome(canvas, doc):
    """The Frankfurt School band, and the footer, on every page."""
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, A4[1] - BAND_H, A4[0], BAND_H, stroke=0, fill=1)
    # Mark and wordmark measured off the lab handout, to the tenth of a point.
    if LOGO.exists():
        canvas.drawImage(str(LOGO), 41.6, A4[1] - 44.5, width=27.7, height=32.5,
                         mask="auto", preserveAspectRatio=True)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 9.1)
    canvas.drawString(86.2, A4[1] - 25.2, "FRANKFURT SCHOOL")
    canvas.setFont("Helvetica", 7.4)
    canvas.drawString(86.2, A4[1] - 37.2, "Financial Software Engineering")

    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.7)
    canvas.line(MARGIN, FOOT_RULE_Y + 11, A4[0] - MARGIN, FOOT_RULE_Y + 11)
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(MUTED)
    canvas.drawString(MARGIN, FOOT_RULE_Y, "H A N D O U T   /   N E O B A N K   S P R I N T")
    canvas.setFillColor(HEADING)
    canvas.drawRightString(A4[0] - MARGIN, FOOT_RULE_Y, f"{doc.page} / {getattr(doc, 'total_pages', doc.page)}")
    canvas.restoreState()


def make_doc(total_pages):
    d = BaseDocTemplate(
        str(OUT), pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=BAND_H + 28, bottomMargin=FOOT_RULE_Y + 24,
        title="Neobank Sprint handout", author="Financial Software Engineering")
    # No frame padding: the 63pt page margin is the whole margin, as in the lab.
    frame = Frame(d.leftMargin, d.bottomMargin, d.width, d.height, id="f",
                  leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
    d.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=chrome)])
    d.total_pages = total_pages
    return d


W = A4[0] - 2 * MARGIN
story = []


def table(rows, widths, zebra=True, pad=2.9, head=True):
    t = Table(rows, colWidths=widths, repeatRows=1 if head else 0, hAlign="LEFT")
    cmds = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), pad),
        ("BOTTOMPADDING", (0, 0), (-1, -1), pad),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, RULE),
    ]
    if head:
        cmds += [("LINEBELOW", (0, 0), (-1, 0), 0.8, NAVY), ("BOTTOMPADDING", (0, 0), (-1, 0), 5)]
    if zebra:
        for i in range(2 if head else 1, len(rows), 2):
            cmds.append(("BACKGROUND", (0, i), (-1, i), ZEBRA))
    t.setStyle(TableStyle(cmds))
    return t


def th(text):
    return Paragraph(f'<font size="6.6" color="#627186">{text.upper()}</font>', CELL)


def callout(text, style_=NOTE):
    """The light blue-grey box the lab uses for anything quoted or crucial."""
    inner = Paragraph(text, style_)
    t = Table([[inner]], colWidths=[W], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CALLOUT),
        ("LEFTPADDING", (0, 0), (-1, -1), 13),
        ("RIGHTPADDING", (0, 0), (-1, -1), 13),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    return t


# ───────────────────────── page 1: the rules ─────────────────────────
story += [
    Paragraph("Neobank Sprint", H1),
    Paragraph("Sprint simulation • 6 phases per sprint • one device per group", SUB),
    Paragraph(
        "Your group runs a neobank for several sprints. You plan, build, get hit by an incident, release, and "
        "watch the regulator react. Most customers at the end wins &mdash; if you can still ship by then.", LEAD),
    callout(
        "<b>The three rolls.</b> &nbsp;Develop: d20 + Dev &ge; the summed targets of everything you picked, plus "
        "legacy drag &mdash; all or nothing. &nbsp;Mitigate: d20 + Mit &ge; the incident&rsquo;s target. "
        "&nbsp;Release: d20 + Rel &minus; bugs &minus; 2 per buggy feature &ge; the summed release targets; "
        "miss it and everything soft-launches at 25%."),
    Spacer(1, 4),
]

story.append(Paragraph("The six phases of a sprint", H2))
story.append(table(
    [[th("#"), th("phase"), th("what happens")]] +
    [[Paragraph(f'<font name="Courier" size="7.4" color="#004763">{i+1:02d}</font>', CELL),
      Paragraph(p["n"], CELLB), Paragraph(p["lead"], CELLM)]
     for i, p in enumerate(DATA["PHASES"])],
    [12 * mm, 40 * mm, W - 52 * mm]))

story.append(Paragraph("Two kinds of debt", H2))
debt = [
    ["", "Bugs", "Audit findings"],
    ["Earned by", "Pushing unfinished work through", "Failed incidents and regulatory cards"],
    ["Taxes", "Every Release roll", "Every Mitigation roll"],
    ["Hard wall", "5 bugs → nothing ships at all", "3 findings → one slot less capacity"],
    ["Cleared by", "Automated Testing, or a slot (−2)", "Compliance by Design, or a slot (−1)"],
]
rows = [[th(c) if i == 0 else (Paragraph(c, CELLM) if j == 0 else Paragraph(c, CELL))
         for j, c in enumerate(r)] for i, r in enumerate(debt)]
t = table(rows, [26 * mm, (W - 26 * mm) / 2, (W - 26 * mm) / 2])
t.setStyle(TableStyle([("TEXTCOLOR", (1, 3), (2, 3), BAD)]))
story.append(t)

story.append(Paragraph("The table, and what a slot can buy", H2))
story.append(Paragraph(
    "Six cards each sprint: three product, three platform. One of each rotates off at the end of the sprint, "
    "whether or not anyone took it, so a card is available for exactly three sprints.", BODY))
story.append(Paragraph(
    "Two slots a sprint, three with Cross-Functional Team, one fewer while you hold three open findings. "
    "Taking no new work is always allowed. The two migration cards cost three slots on their own &mdash; they "
    "are the whole sprint, and they stay off the table until the third slot can exist.", BODY))
story.append(Paragraph(
    "A slot does not have to go on a feature. In planning you may spend one on <b>remediation</b> instead: one "
    "slot clears two bugs, or one audit finding. It takes effect at the start of Development, before the release "
    "roll &mdash; so at five bugs, one slot gets you shipping again in the same sprint.", BODY))

story.append(Paragraph("Investment points", H2))
story.append(Paragraph(
    "Every retro pays <b>two</b>. From sprint 3 it pays a <b>third</b> if the sprint handled its incident "
    "&mdash; rolled against it and won, or built the card that removes it &mdash; or ended with no bugs. Only "
    "one extra point, however well both went.", BODY))
story.append(callout(
    "<b>Points do not carry over.</b> Whatever is not spent at the retro is gone when the next sprint starts, "
    "so the three-point practices are only within reach in a sprint that earned the bonus.", BODY))

story.append(Paragraph("Legacy drag", H2))
story.append(Paragraph(
    "One platform card carries two product features. Every product feature past that adds +1 to your combined "
    "Development target, up to +6. Platform cards earn few customers and pay a permanent modifier instead, "
    "capped at +4 in each of Dev, Rel and Mit. The bug counter models unfinished work; legacy drag models the "
    "architecture you never built.", BODY))
story.append(Spacer(1, 2))

story.append(Paragraph("Agile practices", H2))
story.append(Paragraph(
    "Bought with Investment Points at the retro. Permanent, and they compound.", BODY))
story.append(table(
    [[th("practice"), th("cost"), th("session"), th("effect")]] +
    [[Paragraph(p["n"], CELLB), Paragraph(f'{p["ip"]} IP', MONOB),
      Paragraph(p["src"].replace("Session ", ""), CELLM), Paragraph(p["e"], CELL)]
     for p in DATA["PRACTICES"]],
    [38 * mm, 12 * mm, 15 * mm, W - 65 * mm]))

# ───────────────────────── product cards ─────────────────────────
story.append(PageBreak())
prod = [f for f in DATA["FEATURES"] if f["c"] != "platform"]
story.append(Paragraph("Product cards", H1))
story.append(Paragraph(f"{len(prod)} cards • customers now, nothing permanent", SUB))
story.append(table(
    [[th("card"), th("kind"), th("dev"), th("rel"), th("users"), th("cost"), th("what it is")]] +
    [[Paragraph(f["n"], CELLB), Paragraph(f["c"], CELLM),
      Paragraph(str(f["t"]), MONO), Paragraph(str(f["r"]), MONO),
      Paragraph(f'{f["k"]}k', MONOB), Paragraph(str(f["s"]), MONO),
      Paragraph(f["b"], CELLM)]
     for f in sorted(prod, key=lambda x: -x["k"])],
    [34 * mm, 17 * mm, 9 * mm, 9 * mm, 11 * mm, 10 * mm, W - 90 * mm]))

# ───────────────────────── page 3: platform ─────────────────────────
story.append(PageBreak())
plat = [f for f in DATA["FEATURES"] if f["c"] == "platform"]
story.append(Paragraph("Platform cards", H1))
story.append(Paragraph(
    f"{len(plat)} cards • few customers, permanent leverage • the number is the lecture it comes from", SUB))


def bonus_text(f):
    b = f.get("bonus")
    if not b:
        return "—"
    return "  ".join(f"{k.capitalize()} +{v}" for k, v in
                     (("dev", b.get("dev")), ("rel", b.get("rel")), ("mit", b.get("mit"))) if v)


story.append(table(
    [[th("card"), th("s"), th("dev"), th("rel"), th("users"), th("cost"), th("permanent"), th("what it is")]] +
    [[Paragraph(f["n"], CELLB), Paragraph(f.get("src", "").replace("Session ", ""), CELLM),
      Paragraph(str(f["t"]), MONO), Paragraph(str(f["r"]), MONO),
      Paragraph(f'{f["k"]}k', MONO), Paragraph(str(f["s"]), MONO),
      Paragraph(f'<font color="#004763">{bonus_text(f)}</font>', MONOB),
      Paragraph(f["b"], CELLM)]
     for f in sorted(plat, key=lambda x: (int(x.get("src", "Session 99").replace("Session ", "")), -x["t"]))],
    [32 * mm, 7 * mm, 9 * mm, 9 * mm, 10 * mm, 9 * mm, 24 * mm, W - 100 * mm], pad=2.8))

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
story.append(Paragraph("Incidents", H1))
story.append(Paragraph(
    f"{len(DATA['INCIDENTS'])} cards • one a sprint • it hits every group, but not equally", SUB))
story.append(table(
    [[th("incident"), th("target"), th("what moves the roll"), th("if you fail")]] +
    [[Paragraph(c["n"], CELLB),
      Paragraph("—" if c["mit"] is None else str(c["mit"]), MONOB),
      Paragraph(INC_HELP[c["id"]][0], CELLM),
      Paragraph(f'<font color="#9E2F38">{INC_HELP[c["id"]][1]}</font>', CELL)]
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
story.append(Paragraph("Market events", H2))
story.append(Paragraph(
    "One a sprint, resolved against what each group has actually built. Gains are fixed amounts; losses are a "
    "share of the customers you already have, so they grow with you.", BODY))
story.append(table(
    [[th("event"), th("pays"), th("costs")]] +
    [[Paragraph(c["n"], CELLB),
      Paragraph(f'<font color="#2E6B4F">{EV[c["id"]][0]}</font>', CELL),
      Paragraph(f'<font color="#9E2F38">{EV[c["id"]][1]}</font>', CELL)]
     for c in DATA["EVENTS"]],
    [44 * mm, (W - 44 * mm) * 0.5, (W - 44 * mm) * 0.5]))

# ───────────────────────── page 5: tracker ─────────────────────────
story.append(PageBreak())
story.append(Paragraph("Sprint tracker", H1))
story.append(Paragraph(
    "Your console keeps the real numbers • this is for the debrief", SUB))
story.append(Paragraph(
    "Fill it in as you go, so you can point at the sprint where it turned.", BODY))
story.append(Spacer(1, 6))
cols = ["Sprint", "Picked", "Dev roll", "Incident", "Released", "Customers", "Bugs", "Findings", "Bought"]
widths = [13 * mm, 32 * mm, 16 * mm, 24 * mm, 24 * mm, 20 * mm, 12 * mm, 14 * mm, 0]
widths[-1] = W - sum(widths[:-1])
rows = [[th(c) for c in cols]] + [
    [Paragraph(f'<font name="Courier" size="7.8" color="#627186">{i}</font>', CELL)] + [""] * 8
    for i in range(1, 9)]
t = Table(rows, colWidths=widths, rowHeights=[9 * mm] + [13.5 * mm] * 8, hAlign="LEFT")
t.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("GRID", (0, 0), (-1, -1), 0.4, RULE),
    ("LINEBELOW", (0, 0), (-1, 0), 0.8, NAVY),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("LEFTPADDING", (0, 0), (-1, -1), 5),
]))
story.append(t)
story.append(Spacer(1, 12))
story.append(Paragraph(
    "Adapted from the CatTube sprint game, itself inspired by the &ldquo;Agile 101&rdquo; board game by "
    "Emma Hopkinson-Spark (101 Ways).", style("cr", fontSize=7.4, textColor=FAINT)))

# First pass counts the pages, the second prints "n / total" in the footer.
# Flowables carry layout state, so each pass needs its own copies.
counter = make_doc(0)
counter.build(copy.deepcopy(story))
final = make_doc(counter.page)
final.build(copy.deepcopy(story))
print(f"wrote {OUT.relative_to(ROOT)} ({counter.page} pages)")
