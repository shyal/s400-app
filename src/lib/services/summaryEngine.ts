import type { PeriodSummaryData } from "./summaryData";
import { localDateStr } from "$lib/utils/date";

// ── Types ──

export type Mood = "achievement" | "warning" | "neutral" | "trend";

export interface SummaryFragment {
  text: string;
  mood: Mood;
  priority: number;
}

export interface UserContext {
  goalKg: number;
  goalDate: string;
  currentWeight: number | null;
  proteinTarget: number;
  calorieTarget: number;
  waterTarget: number;
  liftFrequencyDays: number;
}

type SummaryRule = (
  data: PeriodSummaryData,
  ctx: UserContext,
) => SummaryFragment[];

// ── RSG core ──

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Pick a variant deterministically based on date + a salt so different rules get different picks on the same day */
function pick(variants: string[], salt: string = ""): string {
  const seed = localDateStr() + salt;
  return variants[hashStr(seed) % variants.length];
}

function fmtVol(v: number): string {
  return v >= 10000
    ? `${(v / 1000).toFixed(0)}k`
    : v >= 1000
      ? `${(v / 1000).toFixed(1)}k`
      : `${v}`;
}

function fmtPct(n: number): string {
  /* v8 ignore next */
  return n > 0 ? `+${n}` : `${n}`;
}

function periodLabel(p: string): string {
  /* v8 ignore next */
  return p === "week" ? "this week" : p === "month" ? "this month" : "today";
}

// shorthand for compound lifts
function shortName(name: string): string {
  const map: Record<string, string> = {
    "Bench Press": "Bench",
    "Barbell Row": "Row",
    "Overhead Press": "OHP",
    "Romanian Deadlift": "RDL",
    "Dumbbell Shoulder Press": "DB Press",
  };
  return map[name] ?? name;
}

// ── Rules ──

const openerRule: SummaryRule = (data) => {
  /* v8 ignore next */ if (data.period !== "today") return [];
  const h = data.time.hour;
  const { dayName, isWeekend } = data.time;

  if (h < 8) {
    return [
      {
        text: pick(
          [
            `Early start this ${dayName}.`,
            `${dayName} morning — let's see what we're working with.`,
            `Rise and grind.`,
          ],
          "opener",
        ),
        mood: "neutral",
        priority: 1,
      },
    ];
  }
  if (h < 12) {
    return [
      {
        text: pick(
          [
            `${dayName} morning check-in.`,
            isWeekend
              ? `${dayName} vibes — still gotta eat right though.`
              : `${dayName} morning, here's where you're at.`,
            `Morning so far:`,
          ],
          "opener",
        ),
        mood: "neutral",
        priority: 1,
      },
    ];
  }
  if (h < 17) {
    return [
      {
        text: pick(
          [
            `Afternoon check — ${dayName}'s shaping up.`,
            `Mid-${dayName} status.`,
            `Here's your ${dayName} so far.`,
          ],
          "opener",
        ),
        mood: "neutral",
        priority: 1,
      },
    ];
  }
  return [
    {
      text: pick(
        [
          `${dayName} evening wrap-up.`,
          `End of ${dayName} — let's see the damage.`,
          `${dayName}'s almost in the books.`,
        ],
        "opener",
      ),
      mood: "neutral",
      priority: 1,
    },
  ];
};

const noDataRule: SummaryRule = (data) => {
  /* v8 ignore next */ if (data.period !== "today") return [];
  if (data.nutrition.totalCalories > 0 || data.nutrition.totalWater > 0)
    return [];

  const h = data.time.hour;
  if (h < 10) {
    return [
      {
        text: pick(
          [
            `Nothing logged yet — still fasting?`,
            `Clean slate so far. If you're taking Moda today, eat something first.`,
            `No food or water logged. If you're fasting intentionally, nice discipline.`,
          ],
          "nodata",
        ),
        mood: "neutral",
        priority: 10,
      },
    ];
  }
  if (h < 14) {
    return [
      {
        text: pick(
          [
            `It's past ${h}:00 and nothing's logged — either you forgot or you're deep in a fast.`,
            `No meals tracked yet. Remember the 20:4 window — the later you start, the later it closes.`,
            `Blank slate at ${h}:00. Clock's ticking on that feeding window.`,
          ],
          "nodata",
        ),
        mood: "warning",
        priority: 10,
      },
    ];
  }
  return [
    {
      text: pick(
        [
          `Nothing logged all day? That doesn't sound right.`,
          `Zero entries at ${h}:00 — did you eat off-app?`,
          `No data today. Hard to coach what I can't see.`,
        ],
        "nodata",
      ),
      mood: "warning",
      priority: 10,
    },
  ];
};

const calorieRule: SummaryRule = (data, ctx) => {
  const cal = Math.round(data.nutrition.avgCalories);
  if (cal === 0) return [];
  const diff = cal - ctx.calorieTarget;
  const abs = Math.abs(diff);

  if (data.period === "today") {
    if (abs <= 50) {
      return [
        {
          text: pick(
            [
              `${cal} cal — textbook deficit.`,
              `Right at ${cal} cal, basically perfect.`,
              `${cal} cal, which is exactly where you want to be on a cut.`,
            ],
            "cal",
          ),
          mood: "achievement",
          priority: 7,
        },
      ];
    }
    if (abs <= 150) {
      return [
        {
          text: pick(
            [
              diff > 0
                ? `${cal} cal — a touch over but nothing to stress about.`
                : `${cal} cal, still got ${abs} in the tank.`,
              diff > 0
                ? `Slightly over at ${cal} cal, not a dealbreaker.`
                : `${cal} cal with about ${abs} to spare before you hit the limit.`,
            ],
            "cal",
          ),
          mood: diff > 0 ? "neutral" : "neutral",
          priority: 6,
        },
      ];
    }
    if (diff > 150) {
      return [
        {
          text: pick(
            [
              `${cal} cal — that's ${Math.round(diff)} over target. Tomorrow's a new day.`,
              `Ran ${Math.round(diff)} cal over budget today. One day doesn't break a trend.`,
              `${cal} cal, overshot by ${Math.round(diff)}. Not ideal, but consistent weeks matter more than perfect days.`,
            ],
            "cal",
          ),
          mood: "warning",
          priority: 8,
        },
      ];
    }
    // Well under
    return [
      {
        text: pick(
          [
            `Only ${cal} cal so far — ${abs} under target. Room for a solid meal.`,
            `${cal} cal, plenty of headroom left. Don't forget to actually eat enough protein with those calories.`,
            `Budget's wide open at ${cal} cal. That's ${abs} under with time to go.`,
          ],
          "cal",
        ),
        mood: "neutral",
        priority: 5,
      },
    ];
  }

  // Week/month
  const s = "cal" + data.period;
  const { daysOverCalories, days } = data.nutrition;
  if (abs <= 100) {
    return [
      {
        text: pick(
          [
            `Averaging ${cal} cal/day — deficit is dialed in.`,
            `Cal average of ${cal}/day, right in the sweet spot for steady loss.`,
            `${cal} cal/day average — consistent and controlled.`,
          ],
          s,
        ),
        mood: "achievement",
        priority: 6,
      },
    ];
  }
  if (daysOverCalories > days * 0.5) {
    return [
      {
        text: pick(
          [
            `Went over calories on ${daysOverCalories} of ${days} days. That's enough to stall progress.`,
            `More days over budget (${daysOverCalories}/${days}) than under — the deficit only works if you're actually in one.`,
            `${daysOverCalories} out of ${days} days over target. Worth tightening up.`,
          ],
          s,
        ),
        mood: "warning",
        priority: 7,
      },
    ];
  }
  if (diff > 100) {
    return [
      {
        text: `Averaging ${cal} cal/day, about ${Math.round(diff)} over target. Not catastrophic, but it adds up.`,
        mood: "warning",
        priority: 6,
      },
    ];
  }
  return [
    {
      text: pick(
        [
          `${cal} cal/day average — comfortably under target, which means the deficit is working.`,
          `Averaging ${cal} cal/day. That math checks out for losing weight.`,
        ],
        s,
      ),
      mood: "achievement",
      priority: 5,
    },
  ];
};

const proteinRule: SummaryRule = (data, ctx) => {
  const prot = Math.round(data.nutrition.avgProtein);
  if (prot === 0 && data.period === "today" && data.nutrition.mealCount === 0)
    return [];

  if (data.period === "today") {
    if (prot >= ctx.proteinTarget) {
      return [
        {
          text: pick(
            [
              `${prot}g protein — locked in. That's how you preserve muscle on a cut.`,
              `Protein target smashed at ${prot}g. Your muscles thank you.`,
              `${prot}g protein, target hit. This is what separates losing fat from losing muscle.`,
            ],
            "prot",
          ),
          mood: "achievement",
          priority: 8,
        },
      ];
    }
    const gap = Math.round(ctx.proteinTarget - prot);
    if (gap <= 30) {
      return [
        {
          text: pick(
            [
              `${prot}g protein, just ${gap}g short — a shake or some chicken closes that gap.`,
              `Almost there on protein: ${prot}g, only ${gap}g to go. Easy fix.`,
              `${gap}g away from the protein target. A quick snack gets you there.`,
            ],
            "prot",
          ),
          mood: "neutral",
          priority: 7,
        },
      ];
    }
    return [
      {
        text: pick(
          [
            `${prot}g protein with ${gap}g still to go. That's a real meal's worth — don't skip it.`,
            `Only ${prot}g protein so far, need ${gap}g more. This matters for holding onto muscle mass.`,
            `${gap}g protein gap is significant. Prioritize a high-protein meal next.`,
          ],
          "prot",
        ),
        mood: "warning",
        priority: 8,
      },
    ];
  }

  const sp = "prot" + data.period;
  const { daysProteinHit, days, bestProteinDay, worstProteinDay } =
    data.nutrition;
  if (daysProteinHit === days && days > 1) {
    return [
      {
        text: pick(
          [
            `Hit ${ctx.proteinTarget}g+ protein every single day. That consistency is how you recomp.`,
            `Perfect protein ${periodLabel(data.period)} — ${days} for ${days}. Muscle preservation on lock.`,
            `${ctx.proteinTarget}g protein every day ${periodLabel(data.period)}. Your body's getting everything it needs to rebuild.`,
          ],
          sp,
        ),
        mood: "achievement",
        priority: 8,
      },
    ];
  }
  if (daysProteinHit === 0 && days > 1) {
    return [
      {
        text: pick(
          [
            `Didn't hit ${ctx.proteinTarget}g protein on any of the ${days} days tracked. That's a lot of missed muscle-building opportunity.`,
            `Zero days at ${ctx.proteinTarget}g protein ${periodLabel(data.period)}. Best day was only ${bestProteinDay}g — gotta prioritize this.`,
            `Protein was the weak link ${periodLabel(data.period)} — not a single day at target. Think about front-loading protein in your meals.`,
          ],
          sp,
        ),
        mood: "warning",
        priority: 9,
      },
    ];
  }
  const missedDays = days - daysProteinHit;
  if (daysProteinHit >= days * 0.7) {
    return [
      {
        text: pick(
          [
            `Hit protein on ${daysProteinHit}/${days} days. Solid. Best day was ${bestProteinDay}g.`,
            `Protein target hit ${daysProteinHit} of ${days} days — room for improvement but mostly on track.`,
            `${daysProteinHit}/${days} days at ${ctx.proteinTarget}g+ protein. Missed ${missedDays} — try to tighten that up.`,
          ],
          sp,
        ),
        mood: "neutral",
        priority: 5,
      },
    ];
  }
  return [
    {
      text: pick(
        [
          `Only hit protein ${daysProteinHit} of ${days} days. That's leaving gains on the table while you cut.`,
          `Protein consistency needs work — ${daysProteinHit}/${days} days at target. Best: ${bestProteinDay}g, worst: ${worstProteinDay}g.`,
          `Missed protein on ${missedDays} of ${days} days. On a deficit, protein is non-negotiable for keeping muscle.`,
        ],
        sp,
      ),
      mood: "warning",
      priority: 7,
    },
  ];
};

const waterRule: SummaryRule = (data, ctx) => {
  const ml = data.nutrition.avgWater;
  const liters = ml / 1000;
  const targetL = ctx.waterTarget / 1000;
  const leftL = targetL - liters;

  if (data.period === "today") {
    if (ml === 0 && data.nutrition.mealCount === 0) return [];
    if (liters >= targetL) {
      return [
        {
          text: pick(
            [
              `${liters.toFixed(1)}L water done. Hydration sorted.`,
              `Water target hit at ${liters.toFixed(1)}L — kidneys are happy.`,
              `${liters.toFixed(1)}L. Hydrated and functioning.`,
            ],
            "water",
          ),
          mood: "achievement",
          priority: 5,
        },
      ];
    }
    if (leftL <= 0.5) {
      return [
        {
          text: pick(
            [
              `${liters.toFixed(1)}L water — just ${leftL.toFixed(1)}L to go, basically there.`,
              `Almost at the water target, ${leftL.toFixed(1)}L short. One more bottle.`,
            ],
            "water",
          ),
          mood: "neutral",
          priority: 4,
        },
      ];
    }
    if (liters < 0.5 && data.time.hour >= 14) {
      return [
        {
          text: pick(
            [
              `Only ${liters.toFixed(1)}L water and it's past 2pm — you're probably already dehydrated.`,
              `${liters.toFixed(1)}L water at this hour? Drink something. Dehydration kills performance and hunger signaling.`,
              `Seriously behind on water at ${liters.toFixed(1)}L. Dehydration makes you feel hungry when you're not.`,
            ],
            "water",
          ),
          mood: "warning",
          priority: 7,
        },
      ];
    }
    return [
      {
        text: pick(
          [
            `${liters.toFixed(1)}L water, ${leftL.toFixed(1)}L to go. Keep a bottle nearby.`,
            `Water at ${liters.toFixed(1)}L — need ${leftL.toFixed(1)}L more. Spread it out, don't chug it all at once.`,
            `${leftL.toFixed(1)}L of water left to drink today. Set a reminder if you keep forgetting.`,
          ],
          "water",
        ),
        mood: "neutral",
        priority: 4,
      },
    ];
  }

  // Week/month
  const sw = "water" + data.period;
  const { daysWaterHit, days } = data.nutrition;
  if (daysWaterHit === days && days > 1) {
    return [
      {
        text: pick(
          [
            `${targetL}L water every day ${periodLabel(data.period)}. Hydration game is strong.`,
            `Perfect water intake — ${days} for ${days}. That alone improves recovery and satiety.`,
          ],
          sw,
        ),
        mood: "achievement",
        priority: 5,
      },
    ];
  }
  if (daysWaterHit === 0 && days > 1) {
    return [
      {
        text: pick(
          [
            `Didn't hit ${targetL}L water a single day ${periodLabel(data.period)}. This is hurting your cut — dehydration mimics hunger.`,
            `Zero days at water target. Averaging ${(data.nutrition.avgWater / 1000).toFixed(1)}L/day when you need ${targetL}L. Big gap.`,
          ],
          sw,
        ),
        mood: "warning",
        priority: 6,
      },
    ];
  }
  if (daysWaterHit < days * 0.4) {
    return [
      {
        text: pick(
          [
            `Water target hit only ${daysWaterHit} of ${days} days. Dehydration stalls fat loss and makes you hungrier.`,
            `${daysWaterHit}/${days} days at ${targetL}L — water is the easiest target to hit and you're missing it.`,
          ],
          sw,
        ),
        mood: "warning",
        priority: 5,
      },
    ];
  }
  return [
    {
      text: `Water: ${daysWaterHit}/${days} days at target. Averaging ${(data.nutrition.avgWater / 1000).toFixed(1)}L/day.`,
      mood: "neutral",
      priority: 3,
    },
  ];
};

const fastingRule: SummaryRule = (data) => {
  if (data.period !== "today" || !data.feedingWindow) return [];
  const fw = data.feedingWindow;

  if (!fw.firstMealTime) return []; // noDataRule handles this
  if (fw.isOpen && fw.minutesLeft !== null && fw.minutesLeft <= 240) {
    // Only show remaining time if it's actually within the 4h window
    const hrs = Math.floor(fw.minutesLeft / 60);
    const mins = fw.minutesLeft % 60;
    const timeStr =
      hrs > 0 ? `${hrs}h${mins > 0 ? ` ${mins}m` : ""}` : `${mins}m`;
    if (fw.minutesLeft <= 60) {
      return [
        {
          text: pick(
            [
              `Feeding window closes in ${timeStr} — get your remaining protein in now.`,
              `${timeStr} left on the window. Last call for calories.`,
              `Window's closing in ${timeStr}. If you still need protein, eat now, not later.`,
            ],
            "fast",
          ),
          mood: "warning",
          priority: 9,
        },
      ];
    }
    return [
      {
        text: pick(
          [
            `Window open until ${fw.closesAt}, ${timeStr} left.`,
            `${timeStr} left in your 4h window (closes ${fw.closesAt}).`,
          ],
          "fast",
        ),
        mood: "neutral",
        priority: 3,
      },
    ];
  }
  if (fw.closesAt && !fw.isOpen) {
    return [
      {
        text: pick(
          [
            `Window closed at ${fw.closesAt}. Fasting mode engaged.`,
            `Feeding window shut since ${fw.closesAt}. Now it's just water and willpower.`,
          ],
          "fast",
        ),
        mood: "neutral",
        priority: 3,
      },
    ];
  }
  return [];
};

const workoutTodayRule: SummaryRule = (data) => {
  /* v8 ignore next */ if (data.period !== "today") return [];

  if (data.workouts.count > 0) {
    const { exercisesDone, totalSets, avgDuration, heaviestLift } =
      data.workouts;
    const names = exercisesDone.map(shortName);
    const heavyNote = heaviestLift
      ? `, heaviest was ${shortName(heaviestLift.name)} at ${heaviestLift.weight}kg`
      : "";
    return [
      {
        text: pick(
          [
            `Crushed a session today: ${names.join(", ")}. ${totalSets} sets in ${avgDuration} min${heavyNote}.`,
            `Workout done — ${names.join(", ")}. ${totalSets} working sets${heavyNote}. That's how it's done.`,
            `Today's session: ${names.join("/")} — ${totalSets} sets, ${avgDuration} min. Every session compounds.`,
          ],
          "wtoday",
        ),
        mood: "achievement",
        priority: 8,
      },
    ];
  }

  const dsl = data.daysSinceLastWorkout;
  if (dsl !== null && dsl >= 2) {
    return [
      {
        text: pick(
          [
            `No workout today and it's been ${dsl} days since the last one. You're due.`,
            `${dsl} days since you last lifted — the every-2-days rule says get in the gym.`,
            `Last workout was ${dsl} days ago. Muscles don't build themselves on rest alone.`,
          ],
          "wtoday",
        ),
        mood: "warning",
        priority: 7,
      },
    ];
  }
  if (dsl === 1) {
    return [
      {
        text: pick(
          [
            `Rest day — you lifted yesterday. Recovery is when muscles actually grow.`,
            `Day off from lifting. You earned the rest after yesterday's session.`,
          ],
          "wtoday",
        ),
        mood: "neutral",
        priority: 3,
      },
    ];
  }
  return [];
};

const workoutFreqRule: SummaryRule = (data, ctx) => {
  /* v8 ignore next */ if (data.period === "today") return [];

  const expectedPerWeek = 7 / ctx.liftFrequencyDays;
  const weeks = data.period === "week" ? 1 : 4;
  const expected = Math.round(expectedPerWeek * weeks);
  const { count, totalSets, avgDuration } = data.workouts;

  const sf = "wfreq" + data.period;
  if (count === 0) {
    return [
      {
        text: pick(
          [
            `No workouts logged ${periodLabel(data.period)}. The barbell misses you.`,
            `Zero sessions ${periodLabel(data.period)}. That's a full ${data.period} of lost gains.`,
            `Not a single session ${periodLabel(data.period)}. Even one is infinitely better than zero.`,
          ],
          sf,
        ),
        mood: "warning",
        priority: 9,
      },
    ];
  }
  if (count >= expected) {
    return [
      {
        text: pick(
          [
            `${count} sessions ${periodLabel(data.period)} — right on the every-${ctx.liftFrequencyDays}-days cadence. ${totalSets} total sets, averaging ${avgDuration} min/session.`,
            `Nailed the workout frequency: ${count} sessions in ${data.period === "week" ? "7 days" : "30 days"}, averaging ${avgDuration} min each.`,
            `${count} workouts, ${totalSets} sets, ${avgDuration} min average. Cadence is locked.`,
          ],
          sf,
        ),
        mood: "achievement",
        priority: 7,
      },
    ];
  }
  return [
    {
      text: pick(
        [
          `${count} sessions ${periodLabel(data.period)} vs ${expected} expected. ${expected - count} short of the cadence.`,
          `Missed ${expected - count} sessions ${periodLabel(data.period)}. ${count} out of ${expected} target.`,
        ],
        sf,
      ),
      mood: "warning",
      priority: 7,
    },
  ];
};

const workoutGapRule: SummaryRule = (data, ctx) => {
  if (data.period === "today" || data.workouts.count < 2) return [];
  const gap = data.workouts.longestGap;
  if (gap <= ctx.liftFrequencyDays + 1) return [];

  if (gap >= 5) {
    return [
      {
        text: pick(
          [
            `Had a ${gap}-day gap between workouts — that's long enough to start losing momentum.`,
            `Longest break was ${gap} days. Life happens, but try to cap gaps at ${ctx.liftFrequencyDays + 1} days max.`,
          ],
          "wgap" + data.period,
        ),
        mood: "warning",
        priority: 5,
      },
    ];
  }
  return [
    {
      text: `Longest gap between sessions: ${gap} days. Slightly over the ideal ${ctx.liftFrequencyDays}-day rhythm.`,
      mood: "neutral",
      priority: 4,
    },
  ];
};

const volumeRule: SummaryRule = (data) => {
  if (data.period === "today" || data.workouts.totalVolume === 0) return [];

  const vol = data.workouts.totalVolume;
  const { count, avgDuration } = data.workouts;
  return [
    {
      text: pick(
        [
          `Moved ${fmtVol(vol)}kg total volume across ${count} sessions (avg ${avgDuration} min).`,
          `${fmtVol(vol)}kg of total volume ${periodLabel(data.period)}. That's ${count} sessions of work your body has to adapt to.`,
          `Total volume: ${fmtVol(vol)}kg. Progressive overload is the name of the game.`,
        ],
        "vol" + data.period,
      ),
      mood: "trend",
      priority: 3,
    },
  ];
};

const prRule: SummaryRule = (data) => {
  const prs = data.workouts.exercisePRs;
  if (prs.length === 0) return [];

  const salt = "pr" + data.period; // different variant per period

  if (prs.length === 1) {
    const pr = prs[0];
    return [
      {
        text: pick(
          [
            `New PR on ${pr.name}: ${pr.weight}kg! Strength going up even on a cut — textbook recomp.`,
            `${pr.name} PR: ${pr.weight}kg. Getting stronger while losing weight is the dream.`,
            `Hit a ${pr.name} PR at ${pr.weight}kg. Proof that the deficit isn't eating your strength.`,
            `${pr.weight}kg on ${pr.name} — new all-time best. The body is adapting.`,
          ],
          salt,
        ),
        mood: "achievement",
        priority: 10,
      },
    ];
  }

  const names = prs
    .slice(0, 3)
    .map((p) => `${shortName(p.name)} ${p.weight}kg`)
    .join(", ");
  return [
    {
      text: pick(
        [
          `Multiple PRs ${periodLabel(data.period)}: ${names}. You're getting stronger across the board.`,
          `PR city — ${names}. The program is clearly working.`,
          `New records ${periodLabel(data.period)}: ${names}. Deficit who?`,
        ],
        salt,
      ),
      mood: "achievement",
      priority: 10,
    },
  ];
};

const weightTrendRule: SummaryRule = (data) => {
  if (data.period === "today" || data.weight.change === null) return [];
  const {
    change,
    trend,
    endWeight,
    lowestWeight,
    highestWeight,
    measurementCount,
  } = data.weight;
  const abs = Math.abs(change!);
  const s = "wt" + data.period;

  if (measurementCount < 2) {
    return [
      {
        text: `Only ${measurementCount} weigh-in ${periodLabel(data.period)} — need more data points for a reliable trend.`,
        mood: "neutral",
        priority: 4,
      },
    ];
  }

  if (trend === "flat") {
    return [
      {
        text: pick(
          [
            `Weight stable at ${endWeight}kg — not moving this ${data.period}. Plateau or recomp?`,
            `Flat at ${endWeight}kg. If the lifts are going up, this might actually be recomp.`,
            `Scale didn't budge this ${data.period} (${endWeight}kg). Check body fat trend for the real story.`,
          ],
          s,
        ),
        mood: "neutral",
        priority: 5,
      },
    ];
  }

  const range =
    lowestWeight && highestWeight
      ? ` (ranged ${lowestWeight}–${highestWeight}kg)`
      : "";

  if (trend === "down") {
    if (abs >= 1.5 && data.period === "week") {
      return [
        {
          text: pick(
            [
              `Down ${abs}kg this week${range}. That's fast — some of that's water weight, don't expect it every week.`,
              `Dropped ${abs}kg in a week. Aggressive, but sustainable if protein stays high.`,
            ],
            s,
          ),
          mood: "achievement",
          priority: 9,
        },
      ];
    }
    return [
      {
        text: pick(
          [
            `Down ${abs}kg ${periodLabel(data.period)}${range}. The deficit is doing its job.`,
            `Lost ${abs}kg ${periodLabel(data.period)}. Scale's heading the right direction.`,
            `${abs}kg lighter ${periodLabel(data.period)}${range}. Steady progress.`,
          ],
          s,
        ),
        mood: "achievement",
        priority: 8,
      },
    ];
  }

  // Up
  return [
    {
      text: pick(
        [
          `Up ${abs}kg ${periodLabel(data.period)}${range}. Could be water, sodium, or glycogen. One week doesn't define the trend.`,
          `Scale went up ${abs}kg. Don't panic — weight fluctuates. Check the multi-week trend.`,
          `${fmtPct(change!)}kg ${periodLabel(data.period)}. If you've been lifting hard, some of that could be muscle glycogen.`,
        ],
        s,
      ),
      mood: "warning",
      priority: 7,
    },
  ];
};

const goalPaceRule: SummaryRule = (data, ctx) => {
  if (!ctx.currentWeight || data.period === "today") return [];
  // Only show in week to avoid duplication across week/month
  if (data.period === "month") return [];

  const now = new Date();
  const goal = new Date(ctx.goalDate);
  const daysLeft = Math.floor(
    (goal.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  const kgLeft = ctx.currentWeight - ctx.goalKg;

  if (kgLeft <= 0) {
    return [
      {
        text: pick(
          [
            `You've hit ${ctx.goalKg}kg. Goal achieved. Time to set the next one.`,
            `${ctx.currentWeight}kg — you're at or past your ${ctx.goalKg}kg goal. Absolute machine.`,
          ],
          "goal",
        ),
        mood: "achievement",
        priority: 10,
      },
    ];
  }

  if (daysLeft <= 0) {
    return [
      {
        text: pick(
          [
            `${kgLeft.toFixed(1)}kg from goal. The June 1 deadline passed but the mission hasn't — keep pushing.`,
            `Still ${kgLeft.toFixed(1)}kg from ${ctx.goalKg}kg. Deadline's behind you but the finish line isn't. Stay on it.`,
          ],
          "goal",
        ),
        mood: "trend",
        priority: 8,
      },
    ];
  }

  const weeksLeft = daysLeft / 7;
  const neededRate = kgLeft / weeksLeft;

  if (data.weight.weeklyRate !== null && data.weight.weeklyRate < 0) {
    const actualRate = Math.abs(data.weight.weeklyRate);
    const estWeeks = kgLeft / actualRate;

    if (estWeeks < weeksLeft * 0.8) {
      const weeksEarly = Math.round(weeksLeft - estWeeks);
      return [
        {
          text: pick(
            [
              `At this ${actualRate.toFixed(1)}kg/week rate, you'll hit ${ctx.goalKg}kg roughly ${weeksEarly} weeks ahead of schedule.`,
              `Losing ${actualRate.toFixed(1)}kg/week. That puts ${ctx.goalKg}kg about ${weeksEarly} weeks early. Don't let up.`,
            ],
            "goal",
          ),
          mood: "achievement",
          priority: 9,
        },
      ];
    }
    if (actualRate >= neededRate * 0.8) {
      return [
        {
          text: pick(
            [
              `${kgLeft.toFixed(1)}kg to go, ${Math.round(weeksLeft)} weeks left. Current rate of ${actualRate.toFixed(1)}kg/week keeps you on pace.`,
              `On track: losing ${actualRate.toFixed(1)}kg/week, need ${neededRate.toFixed(1)}kg/week. ${ctx.goalKg}kg by ${ctx.goalDate} is realistic.`,
            ],
            "goal",
          ),
          mood: "trend",
          priority: 7,
        },
      ];
    }
    return [
      {
        text: pick(
          [
            `Losing ${actualRate.toFixed(1)}kg/week but need ${neededRate.toFixed(1)}kg/week for ${ctx.goalKg}kg by ${ctx.goalDate}. ${kgLeft.toFixed(1)}kg to go.`,
            `${kgLeft.toFixed(1)}kg from goal. Current pace (${actualRate.toFixed(1)}kg/wk) needs to pick up to hit ${ctx.goalDate}.`,
          ],
          "goal",
        ),
        mood: "warning",
        priority: 7,
      },
    ];
  }

  return [
    {
      text: `${kgLeft.toFixed(1)}kg to ${ctx.goalKg}kg, ${Math.round(weeksLeft)} weeks to deadline. Need ~${neededRate.toFixed(1)}kg/week.`,
      mood: "trend",
      priority: 6,
    },
  ];
};

const bodyCompRule: SummaryRule = (data) => {
  /* v8 ignore next */ if (data.period === "today") return [];
  const { bodyFatChange, muscleChange, bodyFatEnd, muscleEnd } = data.weight;

  const parts: string[] = [];
  let mood: Mood = "neutral";
  let priority = 5;

  if (bodyFatChange !== null && Math.abs(bodyFatChange) >= 0.2) {
    if (bodyFatChange < 0) {
      parts.push(
        `body fat down ${Math.abs(bodyFatChange)}%${bodyFatEnd !== null ? ` to ${bodyFatEnd}%` : ""}`,
      );
      mood = "achievement";
      priority = 7;
    } else {
      parts.push(`body fat up ${bodyFatChange}%`);
      mood = "warning";
      priority = 6;
    }
  }
  if (muscleChange !== null && Math.abs(muscleChange) >= 0.2) {
    if (muscleChange > 0) {
      parts.push(
        `muscle up ${muscleChange}kg${muscleEnd !== null ? ` to ${muscleEnd}kg` : ""}`,
      );
      if (mood !== "achievement") mood = "achievement";
      priority = Math.max(priority, 7);
    } else {
      parts.push(`muscle down ${Math.abs(muscleChange)}kg`);
      mood = "warning";
      priority = 7;
    }
  }

  if (parts.length === 0) return [];

  if (parts.length === 2) {
    // Recomp detection
    if (
      bodyFatChange !== null &&
      bodyFatChange < 0 &&
      muscleChange !== null &&
      muscleChange >= 0
    ) {
      return [
        {
          text: pick(
            [
              `Recomp in action: ${parts.join(" and ")} ${periodLabel(data.period)}. This is the gold standard.`,
              `Losing fat, gaining muscle — ${parts.join(", ")}. Exactly what we want.`,
            ],
            "comp" + data.period,
          ),
          mood: "achievement",
          priority: 9,
        },
      ];
    }
  }

  const joined = parts.join(", ");
  return [
    {
      text: `Body comp ${periodLabel(data.period)}: ${joined}.`,
      mood,
      priority,
    },
  ];
};

const streakRule: SummaryRule = (data, ctx) => {
  if (data.period === "today" || data.workouts.count < 3) return [];

  if (data.workouts.longestGap <= ctx.liftFrequencyDays + 1) {
    return [
      {
        text: pick(
          [
            `${data.workouts.count} sessions without breaking the ${ctx.liftFrequencyDays}-day cadence. Discipline is showing.`,
            `Perfect consistency: every session within ${ctx.liftFrequencyDays + 1} days of the last. That's how you build a physique.`,
            `Not a single missed cadence ${periodLabel(data.period)} — ${data.workouts.count} sessions, all on schedule.`,
          ],
          "streak" + data.period,
        ),
        mood: "achievement",
        priority: 6,
      },
    ];
  }
  return [];
};

const recoveryRule: SummaryRule = (data, ctx) => {
  /* v8 ignore next */ if (data.period !== "today") return [];
  if (data.workouts.count === 0) return [];

  // Worked out today — check if protein is on track
  if (
    data.nutrition.avgProtein < ctx.proteinTarget * 0.5 &&
    data.nutrition.mealCount > 0
  ) {
    return [
      {
        text: pick(
          [
            `You lifted today but protein is way behind — your muscles need fuel to recover and grow.`,
            `Post-workout nutrition matters: you've lifted but only hit ${Math.round(data.nutrition.avgProtein)}g protein so far.`,
          ],
          "recov",
        ),
        mood: "warning",
        priority: 8,
      },
    ];
  }
  if (
    data.nutrition.avgProtein >= ctx.proteinTarget &&
    data.nutrition.avgCalories <= ctx.calorieTarget * 1.1
  ) {
    return [
      {
        text: pick(
          [
            `Lifted and hit protein while staying in deficit — that's the whole playbook right there.`,
            `Workout + protein target + calorie control in one day. This is how you recomp.`,
          ],
          "recov",
        ),
        mood: "achievement",
        priority: 8,
      },
    ];
  }
  return [];
};

const deficitInsightRule: SummaryRule = (data, ctx) => {
  if (
    data.period === "today" ||
    (data.period === "week" && data.nutrition.days < 5)
  )
    return [];

  const avgCal = data.nutrition.avgCalories;
  if (avgCal === 0) return [];

  // Rough TDEE estimate based on target being a deficit
  // If they're losing weight, we can infer the actual deficit
  if (data.weight.weeklyRate !== null && data.weight.weeklyRate < 0) {
    const weeklyLoss = Math.abs(data.weight.weeklyRate);
    // ~7700 cal per kg of fat
    const dailyDeficit = Math.round((weeklyLoss * 7700) / 7);
    if (dailyDeficit > 200) {
      return [
        {
          text: pick(
            [
              `Running roughly a ${dailyDeficit} cal/day deficit based on actual weight loss. That's ${Math.round(weeklyLoss * 10) / 10}kg/week.`,
              `Your real-world deficit is about ${dailyDeficit} cal/day — that's what's driving the ${Math.round(weeklyLoss * 10) / 10}kg/week loss.`,
            ],
            "deficit" + data.period,
          ),
          mood: "trend",
          priority: 5,
        },
      ];
    }
  }
  return [];
};

const weekOpenerRule: SummaryRule = (data) => {
  if (data.period !== "week") return [];
  const { days } = data.nutrition;
  if (days === 0) {
    return [
      { text: `No data logged this week yet.`, mood: "neutral", priority: 1 },
    ];
  }
  return [
    {
      text: pick(
        [
          `Here's your 7-day snapshot.`,
          `Weekly rollup from the last 7 days.`,
          `This week in numbers:`,
        ],
        "wkopen",
      ),
      mood: "neutral",
      priority: 1,
    },
  ];
};

const monthOpenerRule: SummaryRule = (data) => {
  if (data.period !== "month") return [];
  const { days } = data.nutrition;
  if (days === 0) {
    return [
      {
        text: `Not much data to work with this month.`,
        mood: "neutral",
        priority: 1,
      },
    ];
  }
  return [
    {
      text: pick(
        [
          `30-day overview.`,
          `The bigger picture — last 30 days.`,
          `Monthly trends:`,
        ],
        "moopen",
      ),
      mood: "neutral",
      priority: 1,
    },
  ];
};

// ── Assembly ──

const TODAY_RULES: SummaryRule[] = [
  openerRule,
  noDataRule,
  fastingRule,
  calorieRule,
  proteinRule,
  waterRule,
  workoutTodayRule,
  recoveryRule,
  prRule,
];

const PERIOD_RULES: SummaryRule[] = [
  weekOpenerRule,
  monthOpenerRule,
  weightTrendRule,
  goalPaceRule,
  bodyCompRule,
  prRule,
  workoutFreqRule,
  workoutGapRule,
  streakRule,
  calorieRule,
  proteinRule,
  waterRule,
  volumeRule,
  deficitInsightRule,
];

const MAX_TODAY = 8;
const MAX_PERIOD = 10;

export function generateSummary(
  data: PeriodSummaryData,
  ctx: UserContext,
): SummaryFragment[] {
  const rules = data.period === "today" ? TODAY_RULES : PERIOD_RULES;
  const max = data.period === "today" ? MAX_TODAY : MAX_PERIOD;

  const fragments: SummaryFragment[] = [];
  for (const rule of rules) {
    try {
      fragments.push(...rule(data, ctx));
    } catch {
      // Never crash the UI
    }
  }

  // Separate opener (priority 1) from content, sort content by priority
  const openers = fragments.filter((f) => f.priority <= 1);
  const content = fragments.filter((f) => f.priority > 1);
  content.sort((a, b) => b.priority - a.priority);

  return [...openers, ...content].slice(0, max);
}
