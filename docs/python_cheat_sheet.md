# Python Cheat Sheet — Reporting Automation Dashboard

This is a teaching doc, not a build log. `python_deep_dive.md` explains
*how the notebook came to be built this way* (the iteration, the bugs
caught, the reasoning at each decision point). This doc explains *what
the finished code actually does*, from scratch, assuming nothing —
like you're seeing it for the first time and need every piece spelled
out: what it is, how it works, why it exists, where it sits in the
bigger picture, and when you'd reach for this technique again.

Read this top to bottom once, then use it as a reference. Every section
maps to one notebook cell.

---

## Before Cell 1: what is this notebook even doing?

The whole notebook's job, in one sentence: **invent two years of fake-but-
realistic social media and business data for 4 made-up clients, then save
it as CSV files that Google Sheets can read.**

Why fake data instead of real data? Because real client social media data
is private — you can't publish someone's actual Instagram numbers on
GitHub. Synthetic (fake but statistically realistic) data solves that: it
looks and behaves like the real thing, but no privacy issue, and you get
to control exactly what patterns show up (seasonality, a bad month, etc.)
so the finished dashboard has interesting things to show off.

The notebook is organized in **layers**, each cell adding one more layer
of realism on top of the last:
1. A boring, flat "baseline" (Cells 1–3)
2. Add growth over time (Cell 4)
3. Add seasons/events (Cells 5–6)
4. Add "did they actually buy something" data for each client (Cells
   7–12)
5. Add a "bad month" for each client, to make the dashboard interesting
   (Cells 13–16)
6. Save everything to files (Cell 17)

---

## Cell 1 — Setup

**What it is:** imports (borrowing pre-built tools other people wrote) and
a handful of settings every later cell will reuse.

```python
import pandas as pd
import numpy as np
import random
```

**What each import is, in plain terms:**
- `pandas` (imported as `pd`) — a tool for working with tables of data
  (rows and columns), the same way Excel is a tool for working with
  spreadsheets. Almost everything in this notebook is a pandas
  **DataFrame** — think "one spreadsheet tab, but controlled by code
  instead of clicking."
- `numpy` (imported as `np`) — a tool for doing math on lots of numbers at
  once, fast. Used here mostly for its random-number generation.
- `random` — Python's built-in tool for generating random numbers/choices.

**Why fix a "seed"?**
```python
random.seed(42)
np.random.seed(42)
```
Computers can't generate *truly* random numbers — they use a formula that
*looks* random. A "seed" is the starting input to that formula. Same
seed → same sequence of "random" numbers, every single time you run it.
Without a seed, every run of the notebook would produce completely
different numbers — which sounds fine, until you're trying to debug
something and can't tell if a number changed because of a real code
change, or just because the randomness landed differently this time. The
seed makes the whole notebook **reproducible** — anyone who runs it gets
byte-for-byte identical results.

**What `CLIENTS` is:**
```python
CLIENTS = {
    "chiropractor": {"platforms": [...], "follower_range": (...), ...},
    ...
}
```
This is a **dictionary** — a lookup table where you give it a name
("chiropractor") and it gives you back a bundle of info about that name
(what platforms they're on, how many followers, etc.). Storing all 4
clients' settings in one dictionary, instead of 4 sets of separate
variables, is what lets every later cell **loop** over all 4 clients with
one small piece of code instead of writing the same logic out 4 times.

**When would you use this pattern yourself?** Any time you have "the same
kind of thing, several times, with different settings each time" — a
dictionary-of-configs plus a loop is almost always cleaner than copy-
pasting the same code block repeatedly.

---

## Cell 2 — Two functions: pick posting days, then generate posts

**What a "function" is, if that's new:** a reusable chunk of code you
give a name to, so you can run it over and over with different inputs
instead of retyping the same steps every time. `def generate_posting_dates(...)`
means "here's a new tool called `generate_posting_dates`, here's what it
needs as input, here's what it does."

**Function 1 — `generate_posting_dates()`:** decides *which days* a client
posts on, given how many posts/week they typically do.

**How it works, step by step:** it walks through the 2-year date range
one **week** at a time. For each week, it randomly picks a handful of
days within that week to be posting days (e.g. "this week: Tuesday and
Friday"). Why week-by-week instead of just picking random days across the
whole 2 years? Because real posting habits are a *weekly rhythm* — "1-2
times a week" is a statement about each week, not about the whole year at
once. Doing it week-by-week keeps that rhythm believable instead of
sometimes bunching 5 posts in one week and 0 the next by pure chance.

**Function 2 — `generate_baseline_posts()`:** for every day that Function
1 picked, invents the actual numbers for that post — how many people saw
it (reach), how many liked/commented/shared/saved it.

**The key idea — percentages, not fixed numbers:**
```python
reach_fraction = random.uniform(0.10, 0.35)
reach = int(follower_count * reach_fraction)
```
Reach is calculated as "10-35% of however many followers this client
has," not a flat number like "reach = 5,000." Why? Because a chiropractor
with 5,000 followers and a vlogger with 3 million followers shouldn't be
drawing from the same raw number range — a percentage automatically
scales correctly for accounts of any size, big or small, using one line
of code instead of writing separate number ranges for every possible
account size.

**The engagement breakdown — a math trick worth remembering:**
```python
likes = int(total_engagements * 0.70)
comments = int(total_engagements * 0.12)
shares = int(total_engagements * 0.10)
saves = total_engagements - likes - comments - shares  # whatever's left
```
Likes/comments/shares each get their own fixed percentage — but `saves`
is calculated by **subtraction**, not its own percentage. This guarantees
the four numbers always add up to *exactly* `total_engagements`, with
zero rounding drift. If all four had been separate random percentages,
they might add up to 99% or 101% instead of a clean 100% — subtraction
for the "last" category is a simple, reliable fix for that.

---

## Cell 3 — Running the functions for real, for all 9 client-platform pairs

**What's new here: nested loops.**
```python
for client_name, cfg in CLIENTS.items():
    for platform in cfg["platforms"]:
        df = generate_baseline_posts(client_name, platform, followers)
```
A loop repeats code once per item in a list. A **nested** loop is a loop
inside another loop — the outer loop goes through each of the 4 clients,
and for *each* client, the inner loop goes through *that client's own*
platforms (which differ — the chiropractor has 2, the vlogger has 3).
This is exactly why uneven platform counts (2/2/2/3) "just work" without
any special-case code — the inner loop only ever sees whatever platforms
that specific client actually has in their config.

**`pd.concat()` — stacking tables:**
```python
baseline_df = pd.concat(all_baseline_dfs, ignore_index=True)
```
Each client-platform pair produces its own small table. `pd.concat()`
stacks all 9 of those small tables into one big table, one on top of the
other (like stapling 9 spreadsheets together into one). `ignore_index=True`
renumbers the rows 0, 1, 2, 3... continuously across the whole combined
table, instead of each of the 9 pieces restarting its own row numbering
from 0.

---

## Cell 4 — Follower growth over the 2 years

**The core idea:** each client's follower count doesn't just sit still —
it grows gradually over the 2 years, at its own pace.

```python
def followers_on_date(client_name, date):
    base = CLIENT_FOLLOWERS[client_name]
    growth_rate = CLIENT_GROWTH_RATE[client_name]
    day_index = (date - START_DATE).days
    progress = day_index / (END_DATE - START_DATE).days  # 0.0 to 1.0
    noise = np.random.normal(loc=1.0, scale=0.003)
    return int(base * (1 + growth_rate * progress) * noise)
```

**Breaking this down line by line:**
- `day_index = (date - START_DATE).days` — turns any date into "how many
  days after Jan 1, 2024 is this?" (a plain number, easier to do math
  with than a calendar date).
- `progress = day_index / total_days` — converts that day count into a
  fraction from 0.0 (the very first day) to 1.0 (the very last day). This
  is a common trick: turning "where am I in a range" into a 0-to-1 number
  makes the math that follows much simpler.
- `growth_rate * progress` — multiplying the *total* 2-year growth
  percentage by *how far through the range we are* produces **linear
  growth** — a perfectly straight line from "0% grown" to "fully grown."
- `noise = np.random.normal(loc=1.0, scale=0.003)` — adds a small random
  wobble (a "normal distribution," the classic bell-curve shape, centered
  on 1.0 with a small spread of 0.3%) so the growth line isn't a perfectly
  smooth robot-drawn line — real accounts wobble slightly day to day.

**Why a straight line, not a curve?** The alternative — "grow by X% of
whatever the current total is" (compounding, like a bank account earning
interest) — curves upward increasingly steeply over time. For something
like investment growth, that's realistic. For a 2-year social media
trend, it would make the second year look dramatically steeper than the
first for no real reason. A straight line keeps the growth *rate*
constant and easy to describe: "this account grew by roughly the same
amount each month."

---

## Cell 5 — Seasons and one algorithm-change dip

**The big idea:** businesses aren't equally busy every month. A real
estate agent is busier in summer; a chiropractor gets a January fitness
rush. This cell builds a "multiplier" for every single day of the 2
years, saying "today, this client's normal numbers should be scaled up or
down by this much."

**The starting point — one number per month:**
```python
SEASONAL_MULTIPLIERS = {
    "real_estate_agent": {1: 0.75, 2: 0.75, 3: 1.35, ...},
    ...
}
```
`1.35` for March means "March is 35% busier than a normal baseline
month." `0.75` for January means "January is 25% slower than normal."

**The problem with just 12 numbers a year:** if you only have one number
per month and jump straight from one to the next, you get a "staircase" —
sudden jumps at the start of every month, which looks nothing like how
demand actually shifts (it ramps up and down gradually, not overnight).

**The fix — smooth interpolation:**
```python
from scipy.interpolate import PchipInterpolator
pchip = PchipInterpolator(anchor_days, anchor_values)
```
"Interpolation" means filling in the gaps between known points with a
smooth curve instead of a sudden jump. `PchipInterpolator` is a specific
smoothing method (Piecewise Cubic Hermite Interpolating Polynomial — the
name doesn't matter, what it does does) that draws a smooth curve through
each month's anchor number *without ever overshooting past those actual
numbers*. That last part matters — a simpler smoothing method (a "cubic
spline") was tried first and rejected because it occasionally curved
*above* the highest number in the table or *below* the lowest one,
inventing extremes that were never actually specified anywhere.

**The algorithm-change dip — a sudden event on top of the smooth curve:**
```python
ALGO_DIP_START = datetime(2025, 3, 10)
ALGO_DIP_MULTIPLIER = 0.70   # reach drops to 70% of normal
```
This models something that happens suddenly (a social platform changes
its algorithm overnight) but *recovers* gradually — because rebuilding
trust/reach after an algorithm hit takes time, it doesn't just snap back.
The code checks: is today inside the dip window? If yes, apply the harsh
0.70 multiplier immediately. Is today in the recovery period right after?
If yes, gradually blend back up from 0.70 toward 1.0 over a couple of
weeks, instead of jumping straight back to normal.

---

## Cell 6 — Putting growth + seasons together into the real dataset

This cell takes the "flat baseline" posts from Cell 3 and recalculates
their `reach` as if they'd actually happened with the *real* follower
count and *real* seasonal multiplier for that specific date — using
Cell 4 and Cell 5's functions.

**Why not just scale every column (likes, comments, etc.) directly?**
Because `engagement_rate` (what fraction of people who saw a post reacted
to it) represents something different from `reach` (how many people saw
it) — rate is about audience *quality*, reach is about audience *size*.
Keeping the rate untouched and only recalculating engagement counts *from*
the new reach (`new_engagements = new_reach × engagement_rate`) keeps
that relationship mathematically honest, instead of letting the numbers
drift out of proportion with each other if every column were scaled
independently.

**A subtle bug worth knowing about generally:** when you use
`.apply()` to run a function on every row and have that function return
several different values at once, pandas can accidentally convert whole
number columns (like `likes`) into decimal columns (like `4.0` instead
of `4`) — because a single row's output can only hold one data type, and
mixing a decimal (`engagement_rate`) with whole numbers forces everything
into decimals. Fixed with an explicit "make these columns integers again"
step afterward. **Lesson for any future project:** if you use `.apply()`
to build multiple columns simultaneously, double-check the resulting data
types — this kind of silent conversion is easy to miss.

---

## Cell 7 — The aesthetician's online store: everyday traffic

Starting here, the notebook adds a much richer layer just for the
aesthetician client, who has a full online store (the "flagship" funnel).

**Why a separate random generator just for this cell?**
```python
cell7_rng = random.Random(107)
cell7_np_rng = np.random.default_rng(107)
```
Python's plain `random.seed(42)` from Cell 1 controls *one single shared
stream* of randomness for the *entire notebook*. If you ever re-run just
one cell in the middle while debugging (very common — you don't want to
re-run all 17 cells every time you tweak one), every random number
*after* that point shifts to a different value, even after fixing the
bug — because you've moved further along in that one shared stream.
`random.Random(107)` creates a **brand new, independent** random number
generator, with its own private starting point, completely separate from
the shared one. Now Cell 7's numbers only depend on Cell 7's own code
running — nothing that happens in any other cell can accidentally shift
them.

**When would you use this yourself?** Any time you're actively iterating
on one specific piece of code inside a bigger notebook and want that
piece's random numbers to stay stable regardless of what else changes
around it.

**BFCM (Black Friday/Cyber Monday) spike:** a specific 4-day window gets
an extra 1.8×–2.5× multiplier on top of the smooth seasonal curve — the
same "sudden sharp event stacked on a smooth trend" idea as the algorithm
dip in Cell 5, just applied to store traffic instead of reach.

---

## Cell 8 — Store visits that came *from* social media

**The idea:** some fraction of people who engage with a social post click
through to the actual online store. This cell models that.

**Why base it on `total_engagements`, not `reach`?** The first attempt
used reach (impressions — everyone who scrolled past a post, whether or
not they reacted). That produced way too many store visits, because reach
is a *huge* number (hundreds of thousands on a big post), so even a tiny
percentage of it is still a big number. Switching to `total_engagements`
(people who actually liked/commented/shared — a much smaller, "warmer"
group who've already shown real interest) fixed the scale problem and is
also just more realistic — most people scrolling past never click
through to anything.

**The "decay tail" — modeling that a post's effect doesn't vanish
instantly:**
```python
social_sessions = (
    immediate_sessions
    + 0.5 * immediate_sessions.shift(1, fill_value=0)
    + 0.25 * immediate_sessions.shift(2, fill_value=0)
)
```
`.shift(1)` takes a whole column of daily numbers and moves every value
forward by one day — so on any given date, `.shift(1)` gives you
*yesterday's* number. Adding "half of yesterday's effect, plus a quarter
of the day-before-yesterday's effect" on top of today's own number
creates a fading trail — a big post's boost to store traffic doesn't
disappear the instant the day ends, it tapers off over the following
couple of days, which is realistic (not everyone who's interested clicks
through same-day).

---

## Cell 9 — New vs. Returning customers, conversion rates, orders & revenue

Three things happen in this cell, building on Cell 8's traffic data.

**1. New vs. Returning split** — just descriptive (doesn't feed into
anything else numerically, to avoid double-counting an effect that's
already captured elsewhere). Models that an established store gradually
builds up more repeat customers over time.

**2. Conversion rates — with a twist:**
```python
CONVERSION_RATE = min(base_rate * seasonal_lift, HARD_CAP)
```
"Conversion rate" is the percentage of website visitors who actually buy
something. Two separate conversion rates exist here — one for people who
arrived from social media, one for everyone else — because social-sourced
visitors have already seen content that primed them to buy, so they
convert at a meaningfully higher rate. Both get a seasonal boost (busier
months convert slightly better too) and both are **capped** — a hard
ceiling that no random combination of boosts can push past, since
compounding multiple boosts together can occasionally produce an
unrealistically huge number by pure chance, even if each individual boost
looked reasonable on its own.

**3. Orders and revenue:**
```python
orders = sessions * conversion_rate
revenue = orders * average_order_value
```
Straightforward multiplication once the pieces above exist: how many
people visited × what fraction bought = orders; orders × how much they
spent on average = revenue.

---

## Cells 10–12 — Lightweight conversion layers for the other 3 clients

These three cells are deliberately simpler than the aesthetician's full
funnel (Cells 7–9) — a design choice, not a shortcut taken out of
laziness. The aesthetician is the "flagship" full-funnel showcase; the
other three get one focused, business-relevant metric each, reusing the
growth/seasonality functions already built in Cells 4–5 rather than
building their own separate systems from scratch.

**Cell 10 — Chiropractor:** booking inquiries → show-up rate → completed
visits. `completed_visits = booking_inquiries × show_up_rate` — this
becomes the chiropractor's `primary_outcome_count`.

**Cell 11 — Real estate agent:** inquiries → showings → closed deals,
with something the other funnels don't have — a **time lag**.
```python
closes_today = showings.shift(35).apply(lambda s: poisson_draw(s * close_rate))
```
A closing typically happens ~35 days *after* the showing that led to it
(financing, inspections, paperwork all take time) — modeled by
`.shift(35)`, pulling each day's showing count from 35 days earlier
before calculating that day's closes. **`Poisson`-distributed, not a
plain rounded fraction:** closes are rare, whole-number events (you can't
close "2.3 deals"), and Poisson is the standard statistical distribution
for modeling "how many rare, random events happen in a given period" —
using it instead of just rounding a fraction produces a much more
realistic pattern (mostly 0 closes a day, occasionally 1, rarely more)
instead of an artificially smooth, evenly-spread number.

**Cell 12 — Vlogger:** a single combined `est_monetization` number, made
of two different mechanisms blended together rather than kept as two
separate systems:
- **Ad revenue** — scales directly off the vlogger's actual daily `reach`
  from earlier cells, so growth/seasonality/the algorithm dip all flow
  into ad revenue automatically, with zero extra code needed.
- **Sponsorship** — a small percentage of individual posts are randomly
  flagged as sponsored, valued relative to the account's follower count
  (so a sponsorship deal is worth proportionally more for a bigger
  channel).

---

## Cells 13–15 — Injecting one "bad month" per client

**The big idea:** a dataset with only smooth, boring, ever-increasing
numbers gives the dashboard's conditional-formatting and anomaly logic
nothing real to catch. These three
cells each inject one realistic negative event into one client's data —
different scenario, different mechanism, different timing for each, so
they don't read as three copies of the same trick.

**Critical thing to understand about these three cells specifically:**
unlike every earlier cell (which only ever *adds new columns* to the
data), these three **mutate existing data in place** — they delete rows
(cancelled posts) and rescale existing values (suppressed numbers). That
means **re-running one of these cells a second time without restarting
the whole notebook from scratch will suppress the numbers twice**,
silently producing wrong, double-suppressed data. Always do a full kernel
restart + run-everything-from-the-top after touching any of these three.

**Cell 13 — Chiropractor: owner takes a break.** Posting mostly stops,
booking inquiries collapse to a small fraction of normal for 2 weeks,
then a straight-line 7-day ramp back to normal (not an instant snap-back
— that would look like a data glitch, not a real event).

**Cell 14 — Real estate agent: personal gap during the slow season.**
Timed deliberately during the already-slow winter months, so the
personal gap *compounds* an existing seasonal dip rather than reading as
a separate, unrelated event.

**A specific technique worth remembering — binomial thinning:**
```python
suppressed_closes = np.random.binomial(original_closes, keep_probability)
```
The first attempt at suppressing rare closed-deal counts tried drawing a
*brand new* random count using a lower average (a fresh Poisson draw at a
smaller lambda). That's a subtle mistake: a fresh random draw at a lower
average isn't *guaranteed* to actually come out lower than the original —
it can land higher purely by chance, especially with rare events, and
on the first attempt, it did exactly that. **Binomial thinning** fixes
this cleanly: instead of throwing away the original numbers and drawing
new ones, it takes each *original* close and randomly "keeps" it with
some probability — this can only ever reduce the count (or leave it
unchanged), never accidentally increase it, and it's also a more honest
model of what's really happening (fewer showings in the pipeline means
some already-likely deals just don't happen).

**Cell 15 — Aesthetician: negative review cycle, deliberately overlapping
BFCM.** The structural opposite of Cells 13–14 — a *pure conversion-side*
shock. Website traffic and posting stay completely untouched; only the
conversion rates (percentage of visitors who buy) get suppressed, since
this models a trust problem at the point of purchase, not a traffic
problem.

**The most interesting discovery in the whole notebook:** despite ~48%
conversion suppression, actual daily orders during the shock barely
moved. Not a bug — the shock window deliberately overlaps BFCM, and
BFCM's traffic surge (+58%) happens to almost exactly cancel out the
conversion drop numerically. A reader looking only at the orders chart
would conclude nothing was wrong. **The fix wasn't to pick an easier,
non-overlapping window** — it was to add a **counterfactual column**:
"what would orders have been at these actual traffic levels, using the
*original*, unsuppressed conversion rate?" The gap between that
counterfactual and the real (suppressed) orders is where the actual
damage becomes visible — a technique worth remembering any time a rate
metric and a volume metric might be moving in offsetting directions.

---

## Cell 16 — Combining all 4 clients' anomalies into one table

Simple in mechanism, useful in what it enables: gathers each anomaly's
details (client, dates, type, severity) — three of which were built
directly in Cells 13–15, plus the vlogger's algorithm dip from Cell 5
(which never had its own dedicated "anomaly cell," so this is the first
place it gets formally documented alongside the other three) — into one
combined table, plus a timeline chart confirming the four events don't
overlap or cluster together in a way that would make them hard to tell
apart on a dashboard.

**One subtlety worth knowing:** the "severity" number means slightly
different things depending on where it came from — for three of the four
clients it's a *suppression* factor (lower number = more severe), for the
vlogger it's sourced from a differently-named constant built for a
different original purpose. Same direction, same basic meaning, just
worth knowing before writing any code that averages or directly compares
these numbers across all four rows.

---

## Cell 17 — Saving everything to CSV files

The final cell writes every table built so far out to actual files on
disk, organized into folders that mirror exactly how the data will get
imported into Google Sheets later.

```python
DATA_ROOT = os.path.join("..", "data")
if os.path.exists(DATA_ROOT):
    shutil.rmtree(DATA_ROOT)
os.makedirs(DATA_ROOT, exist_ok=True)
```

**Why `"../data"` and not just `"data"`?** The notebook lives inside a
`notebooks/` folder, and `data/` is meant to be a **sibling** folder
(next to `notebooks/`), not a child folder (inside `notebooks/`). `".."`
means "go up one level first" — without it, the code would create
`notebooks/data/`, nested one level too deep.

**Why delete the whole folder before writing anything?**
`shutil.rmtree()` removes a folder and everything inside it. Doing this
first guarantees every re-run produces a genuinely clean, current set of
files — if a filename or folder structure ever changes in the code, an
old, now-outdated file from a previous run won't quietly linger behind
alongside the new ones.

**Splitting post data by platform, not by client:**
```python
for platform in ["youtube", "instagram", "facebook", "tiktok"]:
    platform_df = final_df[final_df["platform"] == platform]
    platform_df.to_csv(f"{platform}_posts.csv")
```
Since `final_df` already has a `client` column, filtering by platform
naturally pulls in every client on that platform at once, no separate
per-client filtering needed. This also matches exactly how the raw tabs
get structured later in Google Sheets — one tab per platform, all clients
mixed together inside it — so the local files and the Sheets tabs line up
1:1 without any extra reshaping step in between.

**The row-count sanity check at the very end:**
```python
platform_row_total = sum((final_df["platform"] == p).sum() for p in [...])
assert platform_row_total == len(final_df)
```
Adds up how many rows ended up in the 4 separate platform files and
compares that total against the original combined `final_df`'s row
count. If a platform name were ever typo'd somewhere upstream, this
check would catch it immediately — the row counts wouldn't match, right
here at generation time, instead of surfacing as a confusing, silent
mismatch several steps later inside a Google Sheets formula.

---

## Quick-reference: concepts that show up more than once

- **Seed / reproducibility** — Cell 1 (global), Cells 7–15 (per-cell
  dedicated generators, because re-running one cell mid-debug shifts a
  shared generator's position)
- **Dictionary + loop instead of repeated code** — `CLIENTS` (Cell 1),
  used everywhere after
- **Percentage-of-something instead of a flat number** — reach as % of
  followers (Cell 2), conversion rate as % of sessions (Cell 9)
- **Subtraction for the "last" category to force an exact total** — saves
  = total − likes − comments − shares (Cell 2)
- **Smooth interpolation instead of a sudden jump** — `PchipInterpolator`
  for seasonality (Cell 5)
- **Sudden onset, gradual recovery** — algorithm dip (Cell 5), BFCM spike
  (Cell 7) — real events don't usually snap back to normal instantly
- **`.shift()`** — used for two different things: a decay tail (Cell 8)
  and a fixed time lag (Cell 11) — same tool, different purpose
- **Hard caps on compounding multipliers** — Cell 9's conversion rate
  ceilings, a safety net for when several individually-reasonable boosts
  happen to stack unusually high all at once
- **Binomial thinning vs. independent redraw** — Cell 14's closed-deals
  suppression — thinning the original draws can only reduce a count,
  never accidentally increase it by chance
- **Mutating data in place vs. only adding columns** — Cells 13–15 break
  the "safe to re-run" pattern every earlier cell follows
- **Counterfactual columns** — Cell 15's `orders_expected_baseline`,
  making a hidden effect visible when a volume metric and a rate metric
  are moving in offsetting directions

---

*Companion to `python_deep_dive.md` (the build-log version, with
iteration history and reasoning Q&A) and `reporting-automation-spec.md`
(the decisions-and-why doc). This file teaches the finished code;
`python_deep_dive.md` explains how it got built.*
