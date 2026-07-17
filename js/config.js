// js/config.js — All constants, data definitions
// All descriptive text in this file comes from Roman's post "A Complete
// Overview of Our AI Safety Talent Pipelines"; footnotes and post-only
// asides are stripped, otherwise wording is preserved verbatim.

// ── Full-bleed depth layers behind the whole pipeline — the deeper the
// layer, the further along the pipeline someone has gotten. Boundaries
// are computed from the live layout; this carries each layer's name,
// solid color, and description. Descriptions fade in (and stay) once the
// layer has scrolled into view.
const PIPELINE_LAYERS = [
  {
    id: 'discovery', label: 'FIRST DISCOVERING AI SAFETY', color: '#eef1f4',
    text: 'Most people never learn about existential risks from AI. And from amongst the ones who do, most never think seriously about them. This is bad: we want people to care enough about the problems to vote on them or work on them, and we want people with clever objections to our arguments to push back against our mistakes. The first stage in the pipeline lets us tell people about these risks, but it only succeeds to the extent that it encourages people to engage further.',
    // Rendered bold, on its own line below the description.
    hint: 'Hover over the various “leaks” to see where people are getting lost, and click on them to see proposed fixes.',
  },
  {
    id: 'caring', label: 'REALLY STARTING TO CARE', color: '#dfe4e8',
    text: 'Up to this point, people have learned a decent amount about AI safety, and they have some thoughts about how concerned we should be about existential risks. However, only now do they really consider the possibility of working on it full-time. Many people need something to inspire them, like being part of a community (physical or virtual) that takes AI risks seriously, going to an event where they meet other people worried about AI, or finding some other reasons to care enough about AI to want to work on it directly.',
  },
  {
    id: 'upskilling', label: 'UPSKILLING', color: '#cfd6db',
    text: 'People are committed and care about AI safety. However, many of them lack the relevant skills and context necessary to do meaningful work in AI safety. This point in the pipeline prepares people to take on a job.',
  },
  {
    id: 'jobs', label: 'JOB DECISIONS', color: '#bfc8cf',
    text: 'Relevant skills have been acquired, so now it’s time for our people to choose their jobs. At this point along the way, we have plenty of people excited to do technical research, but not as many people with good outreach skills, organizing/generalist skills, or information security skills. At some points along the pipeline, they were lost, and the materials that advise them which careers they should go into don’t help fix the bottlenecks. An additional worry is that for many people, the choice of career path is sticky, meaning that when people commit to a certain job type, they’re much less likely to leave.',
  },
];

const CONFIG = {
  BG_TOP: '#eef1f5',
  BG_BOTTOM: '#e3e8ee',
  PIPE_BORDER: '#7f96a8',
  PIPE_MID: '#c7d3dc',
  PIPE_LUMEN: '#f4f7fa',
  PIPE_FILL: 'rgba(159, 176, 192, 0.10)',
  LEAK_COLOR: '#a9695f',
  PARTICLE_RADIUS: 2.2,
  GRAVITY: 0.07,
  DAMPING: 0.97,
  PIPE_WIDTH: 22,            // constant trunk pipe diameter
  CHANNEL_PIPE_WIDTH: 14,    // entry-channel feeder pipe diameter
  BRANCH_WIDTH: 13,          // bucket branch pipe diameter
  LANE_OFFSET: 45,           // spacing between the 3 parallel connector pipes
  TANK2_OFFSET_X: 165,       // how far right tank2's spine sits from tank1's
  TANK_FILL_EASE: 0.0006,    // how fast the displayed water level chases the real occupancy (lower = slower)
  BUCKET_COLUMNS: 20,        // fine-grained pile-height slots across a bucket's width, for a mound silhouette rather than a few fat towers
  BUCKET_ROOF_H: 16,         // peak height of the bucket's pitched roof above its side walls
  DISSOLVE_FRAMES: 60,       // 1s at 60fps: fade-out before draining from a tank
  ROLL_SPEED: 2.1,           // px/frame along pipe paths
  DWELL_MIN: 45,             // frames a droplet lingers in a tank before draining
  DWELL_MAX: 100,
  SPAWN_INTERVAL: 40,        // ms between spawn ticks
  // SPAWN_PER_TICK/FUNNEL_CAPTURE_RATE/GHOST_CHANCE are tuned together so
  // that (a) about 5x as many particles are visibly shown never entering
  // a funnel as those that do, and (b) the absolute funnel-entrant volume
  // stays close to its old value (20 * 0.22 ≈ 4.4/tick).
  SPAWN_PER_TICK: 26,        // particles attempted per tick
  FUNNEL_CAPTURE_RATE: 0.17, // fraction of particles that enter a channel funnel
  GHOST_CHANCE: 1.0,         // fraction of non-entrants shown as faint rain
  MAX_PARTICLES: 7500,
  CANVAS_WIDTH: 1100,        // floor only (for very narrow windows) — computeLayout grows past this for its own content, and app.js takes the max with window.innerWidth so a wide window isn't forced wider than the viewport
  // Scales each stage's authored escapeRate into an actual per-checkpoint
  // probability. Tuned per-stage (rather than one global number) so that,
  // despite different leak counts/rates per stage, roughly 1 in 10 droplets
  // that enter a given major pipe survive to the far end — keeping the
  // visible downstream flow sparse. shortfall covers the invisible
  // supply-gap attrition on undersupplied bucket branches (below).
  LEAK_SEVERITY: { funnel: 1.5, caring: 2.2, upskilling: 1.3, jobs: 1.15, shortfall: 1.0 },
  // Invisible per-branch attrition for the bucket paths the field fails to
  // supply. Tuned (together with each person type's bucketWeights) so these
  // four buckets each receive roughly 1 successful entry for every 20 that
  // make it to Technical Research.
  BUCKET_SHORTFALL: { scalers: 0.80, ops: 0.87, generalist: 0.65, comms: 0.85 },
  CENTER_X: 800,             // updated at runtime
};

// Shared tooltip text for every droplet, from the post's "Categories of
// People" section — the invitation is the same regardless of who you are.
const PERSON_PROMPT = 'Try to imagine yourself as this person. Think about every stage of the pipeline you go through. Where do you get lost? How can things be made easier for you?';

// leakMult scales every leak checkpoint's escape probability for that
// person type: students (<1) survive the pipeline disproportionately
// often, mid-career people (>1) mostly get lost along the way. Tuned
// empirically (headless runs of the particle sim), not by averaging:
// several checkpoints already clamp at 0.97, so mid-career multipliers
// mostly can't raise losses further and the student discount has to
// stay mild to keep total end-to-end arrivals within ~10% of what they
// were before the skew. As tuned, ~19 of every 20 droplets that reach
// a bucket are students.
const PERSON_TYPES = [
  {
    id: 'undergrad', label: 'Undergraduate Student', color: '#90AFC9', weight: 0.22, leakMult: 0.85,
    description: PERSON_PROMPT,
    funnelWeights: { university:0.28, friends:0.16, fellowships:0.12, youtube:0.10, misc:0.08, blogs:0.06, forums:0.04, events:0.06, movies:0.02, books:0.03, activist:0.02, protests:0.01, conferences:0.02 },
    bucketWeights: { research:0.40, policy:0.20, scalers:0.05, ops:0.12, generalist:0.13, comms:0.10 },
  },
  {
    id: 'phd', label: 'PhD Student', color: '#5E7F9C', weight: 0.16, leakMult: 0.92,
    description: PERSON_PROMPT,
    funnelWeights: { conferences:0.22, fellowships:0.20, blogs:0.14, forums:0.08, friends:0.12, university:0.06, books:0.05, youtube:0.04, misc:0.04, events:0.03, activist:0.01, movies:0.005, protests:0.005 },
    bucketWeights: { research:0.60, policy:0.15, scalers:0.04, ops:0.05, generalist:0.10, comms:0.06 },
  },
  {
    id: 'infosec', label: 'Mid-career: InfoSec', color: '#97A3AE', weight: 0.08, leakMult: 1.40,
    description: PERSON_PROMPT,
    funnelWeights: { conferences:0.24, misc:0.14, youtube:0.12, friends:0.12, events:0.10, blogs:0.08, forums:0.05, books:0.05, activist:0.04, movies:0.03, protests:0.02, university:0.005, fellowships:0.005 },
    bucketWeights: { research:0.35, policy:0.08, scalers:0.07, ops:0.20, generalist:0.20, comms:0.10 },
  },
  {
    id: 'comms', label: 'Mid-career: Communications', color: '#7C93A8', weight: 0.08, leakMult: 1.40,
    description: PERSON_PROMPT,
    funnelWeights: { misc:0.18, movies:0.14, books:0.12, friends:0.13, events:0.12, activist:0.10, youtube:0.09, blogs:0.06, conferences:0.03, protests:0.02, forums:0.01 },
    bucketWeights: { comms:0.50, policy:0.15, generalist:0.15, ops:0.10, scalers:0.05, research:0.05 },
  },
  {
    id: 'swe', label: 'Mid-career: Software Engineering', color: '#6C8CA6', weight: 0.10, leakMult: 1.35,
    description: PERSON_PROMPT,
    funnelWeights: { youtube:0.16, blogs:0.16, misc:0.14, forums:0.10, conferences:0.12, friends:0.11, books:0.06, events:0.08, fellowships:0.02, movies:0.02, activist:0.02, protests:0.01 },
    bucketWeights: { research:0.45, ops:0.15, generalist:0.15, scalers:0.10, policy:0.10, comms:0.05 },
  },
  {
    id: 'econ', label: 'Mid-career: Economics', color: '#AAB4BD', weight: 0.07, leakMult: 1.40,
    description: PERSON_PROMPT,
    funnelWeights: { blogs:0.22, books:0.12, conferences:0.18, friends:0.14, misc:0.10, forums:0.06, events:0.08, fellowships:0.04, youtube:0.03, activist:0.02, movies:0.01 },
    bucketWeights: { policy:0.50, research:0.20, generalist:0.15, ops:0.05, scalers:0.05, comms:0.05 },
  },
  {
    id: 'policy', label: 'Mid-career: Policy', color: '#B7CCE0', weight: 0.08, leakMult: 1.35,
    description: PERSON_PROMPT,
    funnelWeights: { conferences:0.20, books:0.14, blogs:0.14, misc:0.12, friends:0.12, events:0.10, activist:0.06, youtube:0.05, forums:0.03, fellowships:0.02, movies:0.01, protests:0.01 },
    bucketWeights: { policy:0.60, generalist:0.12, comms:0.10, research:0.08, ops:0.05, scalers:0.05 },
  },
  {
    id: 'research', label: 'Mid-career: Research', color: '#4F6E8C', weight: 0.08, leakMult: 1.30,
    description: PERSON_PROMPT,
    funnelWeights: { conferences:0.24, blogs:0.16, fellowships:0.10, books:0.10, friends:0.12, forums:0.08, misc:0.08, youtube:0.05, events:0.05, university:0.01, activist:0.005, movies:0.005 },
    bucketWeights: { research:0.55, policy:0.15, generalist:0.12, ops:0.08, scalers:0.05, comms:0.05 },
  },
  {
    id: 'mgmt', label: 'Mid-career: Management', color: '#8FA3B8', weight: 0.07, leakMult: 1.50,
    description: PERSON_PROMPT,
    funnelWeights: { friends:0.18, misc:0.16, books:0.14, events:0.12, conferences:0.12, movies:0.08, youtube:0.08, blogs:0.06, activist:0.04, protests:0.01, forums:0.01 },
    bucketWeights: { scalers:0.40, ops:0.30, generalist:0.20, policy:0.05, comms:0.05 },
  },
  {
    id: 'other', label: 'Mid-career: Other', color: '#839099', weight: 0.06, leakMult: 1.45,
    description: PERSON_PROMPT,
    funnelWeights: { friends:0.20, misc:0.16, movies:0.12, youtube:0.12, events:0.12, activist:0.10, books:0.08, blogs:0.04, protests:0.03, forums:0.02, conferences:0.01 },
    bucketWeights: { generalist:0.30, ops:0.25, comms:0.15, policy:0.15, scalers:0.10, research:0.05 },
  },
];

// ── Entry channels: each rendered as its own mini-funnel ─────
const ENTRY_CHANNELS = [
  {
    id: 'youtube', label: 'YouTube/Podcasts', fullLabel: 'YouTube Videos and Podcasts',
    examples: 'AI in Context · Rob Miles · Rational Animations · Dwarkesh Patel · TED Talks · 80,000 Hours · other news sources covering AI safety material',
  },
  {
    id: 'misc', label: 'Web / Social', fullLabel: 'Various Internet Sources / Social Media',
    examples: 'AI Futures Project · Twitter · Reddit · LinkedIn · news articles · newsletters',
  },
  {
    id: 'movies', label: 'Screenings', fullLabel: 'Movie and Documentary Screenings',
    examples: 'The AI Doc: Or How I Became an Apocaloptimist · hopefully more coming soon',
  },
  {
    id: 'books', label: 'Books', fullLabel: 'Books',
    examples: 'Eliezer Yudkowsky · Peter Singer · Will MacAskill · Toby Ord',
  },
  {
    id: 'blogs', label: 'Blogs', fullLabel: 'Blogs',
    examples: 'Bentham’s Bulldog · Scott Alexander · Ozy Brennan · Andy Masley · Matt Yglesias · Nate Silver · Cate Hall',
  },
  {
    id: 'forums', label: 'Forums', fullLabel: 'Forums',
    examples: 'EA Forum · LessWrong',
  },
  {
    id: 'activist', label: 'Activism', fullLabel: 'Adjacent Activist Groups',
    examples: 'Adjacent EA groups · animal welfare groups · Abundance · anti-surveillance groups',
  },
  {
    id: 'protests', label: 'Protests', fullLabel: 'Anti-AI Protest Events',
    examples: 'QuitGPT · AI Moratorium Coalition · PauseAI · anti-data center groups',
  },
  {
    id: 'university', label: 'Uni Groups', fullLabel: 'University Groups',
    examples: 'Effective Altruism and AI Safety groups',
  },
  {
    id: 'fellowships', label: 'Fellowships', fullLabel: 'Fellowships',
    examples: 'Non-Trivial · Leaf · SPAR · ARENA · BlueDot',
  },
  {
    id: 'friends', label: 'Friends', fullLabel: 'Recommendations from Friends',
    examples: 'Direct relationships with people in EA · peer-to-peer outreach',
  },
  {
    id: 'conferences', label: 'Conferences', fullLabel: 'Conferences Related to AI Safety',
    examples: 'NeurIPS safety workshops · GovAI events · ML Safety days',
  },
  {
    id: 'events', label: 'Local Events', fullLabel: 'Local Events and Meetups',
    examples: 'Hackathons · meetups · panels · discussion nights',
  },
];

// ── Which entry channels belong to the same funnel category from the
// post (and so share one pipe down to tank1, rather than each getting
// its own) ───────────────────────────────────────────────────────
const FUNNEL_GROUPS = [
  { id: 'media', label: 'STANDARD MEDIA OUTREACH', channelIds: ['youtube', 'misc', 'movies', 'books'] },
  { id: 'internet', label: 'AI SAFETY & ADJACENT INTERNET CULTURES', channelIds: ['blogs', 'forums'] },
  { id: 'activism', label: 'ADJACENT ACTIVIST GROUPS & PROTESTS', channelIds: ['activist', 'protests'] },
  { id: 'university', label: 'UNIVERSITY GROUPS', channelIds: ['university'] },
  { id: 'fellowships', label: 'FELLOWSHIPS', channelIds: ['fellowships'] },
  { id: 'friends', label: 'RECOMMENDATIONS FROM FRIENDS', channelIds: ['friends'] },
  { id: 'events', label: 'EVENTS', channelIds: ['conferences', 'events'] },
];

// escapeRate/fixedEscapeRate are simulation tuning only (probability a
// droplet leaks at this checkpoint, before/after the fix is applied) —
// the post doesn't quantify these. noFix marks entries the post raises
// without proposing a fix; clicking them doesn't toggle anything.
const LEAKS = [
  // ── Entry-funnel leaks ──
  {
    id:'media_no_next_step', stage:'funnel', channels:['youtube','misc','movies','books'],
    title: 'People Aren’t Told Where They Can Learn More',
    escapeRate: 0.70, fixedEscapeRate: 0.50, fixed: false,
    problem: 'Many people who hear about AI risks in these contexts become interested, but often, they aren’t told where they can learn more or who they can talk to if they want advice.',
    solution: 'Reach out to people performing this type of outreach and ask them to advertise the next stages in the pipeline: link them to 80,000 Hours or other resources that can help them think about these things.',
  },
  {
    id:'internet_technical_language', stage:'funnel', channels:['blogs','forums'],
    title: 'Highly Technical Language Intimidates Newcomers',
    escapeRate: 0.55, fixedEscapeRate: 0.45, fixed: false,
    problem: 'Mostly on forums: Highly technical language makes joining a community intimidating for newcomers.',
    solution: 'I don’t think working on this is very tractable, actually, aside from recommending the EA Handbook to people.',
  },
  {
    id:'activism_culture', stage:'funnel', channels:['activist','protests'],
    title: 'Community Norms Can Seem Intimidating and Weird to Outsiders',
    escapeRate: 0.65, fixedEscapeRate: 0.52, fixed: false,
    problem: 'The existing set of rules/resources we have for AI safety comes with an implicit set of social/cultural norms that can seem intimidating and weird to outsiders. As long as associated communities look intimidating and weird, it can be hard to support people interested in learning. Additionally, many of the people at protest events aren’t primarily concerned with extinction risks specifically.',
    solution: 'Even if these protesters aren’t interested in becoming technical AI safety researchers, many people may be sympathetic to fighting for relevant solutions (democracy preservation, pauses on AI development, etc) outside of the main AI safety community. Even though these protest actions might not fill many conventional AI safety roles, they could help build the necessary political capital to pass important regulations, like slowdowns and safety checks for new models. Perhaps this should be its own, separate pipeline? I would like to see a full post that thinks about this in much more depth.',
  },
  {
    id:'university_persistence', stage:'funnel', channels:['university'],
    title: 'Groups Struggle to Begin, Stay Active, and Recruit New Leaders',
    escapeRate: 0.45, fixedEscapeRate: 0.30, fixed: false,
    problem: 'While there are a lot of resources to improve EA and AI Safety groups (see: OSP, Beacon, Pathfinder, and NEST), many groups struggle to begin, stay active, and recruit new leaders. This decreases the number and effectiveness of university groups.',
    solution: 'Get more people to focus on seeding new university groups to expand the funnel, and try to make organizers of existing groups think more carefully about making sure their groups survive.',
  },
  {
    id:'fellowship_rejection', stage:'funnel', channels:['fellowships'],
    title: 'High Rejection Rates',
    escapeRate: 0.55, fixedEscapeRate: 0.40, fixed: false,
    problem: 'Fellowships often have high rejection rates, especially to people who are low-context on AI safety topics.',
    solution: 'Fellowship rejection systems should offer participants ways to get interested and upskill more so that they are better applicants for future rounds. Many universities have systems to provide funding for students interested in doing this; we should make sure students know!',
  },
  {
    id:'fellowship_nerdsnipe', stage:'funnel', channels:['fellowships'],
    title: 'Some Intro Fellowships Fail to Excite and Motivate',
    escapeRate: 0.40, fixedEscapeRate: 0.28, fixed: false,
    problem: 'While intro fellowships can give valuable information to people, some fail to provide the exciting information and context that motivates a smart and passionate person to join EA/AI Safety. I think this delayed my personal introduction to AI safety by several months, which really sucks!',
    solution: 'Fellowships could be designed to better “nerdsnipe” some of their participants with cool ideas. EA Purdue has had some success by adding readings like “Double Crux” into our Week 1 Intro Fellowship, instead of just the classic Scout Mindset video.',
  },
  {
    id:'friends_motivation', stage:'funnel', channels:['friends'],
    title: 'Few Feel Motivated to Encourage Their Friends',
    escapeRate: 0.30, fixedEscapeRate: 0.22, fixed: false,
    problem: 'Not many people feel strongly motivated to encourage their friends to do more things in AI safety, and many people already in AI safety have few friends on the outside.',
    solution: 'Motivate more people to be a “Noah Birnbaum”: someone who regularly reaches out to their friends, encourages them to try new things, and tells them about upcoming opportunities that they might not otherwise know about.',
  },
  {
    id:'events_first_contact', stage:'funnel', channels:['conferences','events'],
    title: 'Not Many People First Hear About AI Safety at an Event',
    escapeRate: 0.55, fixedEscapeRate: 0.40, fixed: false,
    problem: 'Not many people first hear about AI safety at an event — conferences and meetups mostly reach people who already know enough about the field to show up in the first place.',
    solution: 'Make more events! More conferences, hackathons, meetups, and panels in more places give more people a chance at a first point of contact.',
  },

  // ── Caring-stage leaks (on the pipes toward upskilling) ──
  {
    id:'events_attendance', stage:'caring',
    title: 'Some People Might Never Make It to an Event',
    escapeRate: 0.55, fixedEscapeRate: 0.38, fixed: false,
    problem: 'While many people self-report getting lots of value from events, some people might never make it to one.',
    solution: 'I think we should be thinking more carefully about why people don’t make it to events. However, one thing that may be helpful is to run more events for more diverse groups of people! Action Potential seems like it was really good, but it was limited in scope. How do we scale it up? Note: If you’re interested in running an event for any group of people, contact me at roman.alex.ross@gmail.com, and I’ll connect you to someone with relevant expertise who can help you see if you may be a good fit.',
    impactNote: 'Note: The primary “theory of change” for many of these events isn’t solely to build talent pipelines. Much of their value comes from building political will, increasing people’s “surface area for luck,” and convincing important people that these issues are worth caring about.',
  },
  {
    id:'advising_quality', stage:'caring',
    title: 'Career Advising Can Fail to Be Helpful Enough',
    escapeRate: 0.55, fixedEscapeRate: 0.40, fixed: false,
    problem: 'While it’s important for a lot of career advising to be personalized, it may often fail to meet a certain level of helpfulness. For example, I have friends who were delayed from learning more about AI safety because their BlueDot mentor didn’t give them good advice on where they could go next to gain more skills.',
    solution: 'Raise the bar on helpfulness by providing common advising resources that can be used as a fallback by mentors.',
  },
  // "Other Communities" ("No tractable leaks immediately spotted" in the
  // post) intentionally carries no leak.

  // ── Upskilling-stage leaks ──
  {
    id:'program_cause_prio', stage:'upskilling',
    title: 'Many Program Participants Don’t Prioritize Existential Risk',
    escapeRate: 0.45, fixedEscapeRate: 0.35, fixed: false,
    problem: 'Many people who end up accepted into many of these research programs don’t actually care that much about reducing existential risks, meaning that they may be less likely to take on highly impactful jobs if given the opportunity (for example, choosing to work at a lab over a research org). This is an inefficient use of mentor time and resources.',
    solution: 'Dedicate sections of these programs to talking about why these risks are important to think about and prioritize. Explicit cause prioritization work can make participants understand why they should be trying to align AGI, rather than build it. Note: I’m quite uncertain about how valuable these types of programs are, or if they would even be a net-positive.',
  },
  {
    id:'program_rejection', stage:'upskilling',
    title: 'Rejected Applicants Feel Discouraged and Opt Out',
    escapeRate: 0.50, fixedEscapeRate: 0.35, fixed: false,
    problem: 'Low acceptance rates mean that many people who get rejected from various programs feel discouraged and opt out of applying for more.',
    solution: 'Help direct people to the places where they should be applying first. If people tried applying for MATS with no other experience, they have little chance of getting in. Tell them to check out BlueDot, ARENA, and SPAR first. Note: Many programs already do this or something similar. But do all of them?',
  },
  {
    id:'career_transition_uncertainty', stage:'upskilling', noFix: true,
    title: 'Personal Uncertainty: Career Transitions',
    escapeRate: 0.35, fixedEscapeRate: 0.35, fixed: false,
    problem: 'Does everyone who want to pivot careers have an accessible path to doing so? Maybe they do, but if they don’t, what can we do about it?',
  },

  // ── Job-decision leaks ──
  {
    id:'fellowship_hopping', stage:'jobs', rail: true, noFix: true,
    title: 'Fellowship Hopping',
    escapeRate: 0.30, fixedEscapeRate: 0.30, fixed: false,
    problem: 'Some people keep “fellowship hopping” instead of taking real, impactful jobs.',
    impactNote: 'Note: The story behind fellowship hopping is a little confusing to me. Most of the time, the people doing the hopping are applying for jobs, but these jobs can be hard to get. I suspect that many of these people would be best off doing some amount of dedicated upskilling in a different direction than what the fellowships give them, but I’m not sure what the pipeline for this looks like or how good it currently is. Maybe research mentors recommend ways to improve?',
  },
  {
    id:'generalist_unknown', stage:'jobs', bucket:'generalist',
    title: 'Many People Don’t Know What a “Generalist” Is',
    escapeRate: 0.60, fixedEscapeRate: 0.45, fixed: false,
    problem: 'Amongst the more vague roles, many people don’t know what a “generalist” is, or that it’s something they should be doing.',
    solution: 'Stories from successful generalists in AI safety explaining how they got into the field.',
  },
  {
    id:'policy_skills', stage:'jobs', bucket:'policy',
    title: 'Many Don’t Learn the Skills Required to Be Highly Impactful',
    escapeRate: 0.55, fixedEscapeRate: 0.40, fixed: false,
    problem: 'Many people who want to go into policy don’t learn many of the skills required to be highly impactful.',
    solution: 'Directly embed governance fellows into real, multistakeholder policy processes as part of their training, so they learn some of the important tacit knowledge required to succeed.',
  },

  // ── Informational markers on the undersupplied bucket branches. These
  // carry no attrition of their own (escapeRate 0) — the actual thinning
  // is CONFIG.BUCKET_SHORTFALL, which stays untouched so the flow of
  // droplets reaching these buckets doesn't change. They exist to explain
  // the visible drip: the people who could have filled these roles were
  // lost long before this point. ──
  {
    id:'scalers_upstream', stage:'jobs', bucket:'scalers', noFix: true, tagLabel: 'Upstream Losses',
    title: 'Most People Leaked Out Much Earlier',
    escapeRate: 0, fixedEscapeRate: 0, fixed: false,
    problem: 'Only a trickle arrives here — not because this branch itself leaks, but because most of the people who could have grown into org-scaling roles leaked out much earlier in the pipeline, long before choosing a job.',
  },
  {
    id:'ops_upstream', stage:'jobs', bucket:'ops', noFix: true, tagLabel: 'Upstream Losses',
    title: 'Most People Leaked Out Much Earlier',
    escapeRate: 0, fixedEscapeRate: 0, fixed: false,
    problem: 'Only a trickle arrives here — not because this branch itself leaks, but because most of the people who could have filled operations roles leaked out much earlier in the pipeline, long before choosing a job.',
  },
  {
    id:'comms_upstream', stage:'jobs', bucket:'comms', noFix: true, tagLabel: 'Upstream Losses',
    title: 'Most People Leaked Out Much Earlier',
    escapeRate: 0, fixedEscapeRate: 0, fixed: false,
    problem: 'Only a trickle arrives here — not because this branch itself leaks, but because most of the people who could have filled communications roles leaked out much earlier in the pipeline, long before choosing a job.',
  },
];

// ── Job buckets: the six career paths, hover text = Theories of Change ──
const JOB_BUCKETS = [
  {
    id: 'research', label: 'Technical Research', color: '#5E7F9C',
    theoryOfChange: 'Unless we have technical researchers to address the important problems in alignment, control, compute verification, and macrostrategy, we will have no hope of winning in a world where superintelligent AI can be easily built. However, there is an important difference between saying, “We need more good people to be doing technical research work,” and saying, “We need more people applying to technical research positions.” Impact in technical research is heavy-tailed, meaning that most of the impact comes from the top few percentiles of researchers. Because of this, it is somewhat unclear how impactful a marginal, 50th-percentile technical researcher is. Perhaps there are many technical researchers who should be working on other things instead.',
  },
  {
    id: 'policy', label: 'Policy & Governance', color: '#7C93A8',
    theoryOfChange: 'If the US and other foreign governments cared about existential risks from AI and could regulate against them well, we could have a greater chance at making the future much better. Policy and governance people can fill this gap: lobbyists can lobby, policymakers can work to pass AI safety legislation, and talented people working in campaigns can support politicians who take existential threats from AI seriously.',
  },
  {
    id: 'scalers', label: 'Org Scalers', color: '#97A3AE',
    theoryOfChange: 'The skills required for someone to bring an organization from 0 people to 100 people are very different than the skills required for someone to bring an organization from 100 people to 1000 people. In the first stage, a manager leads by making good decisions themselves and knowing everyone personally, and the culture is built implicitly. In the second stage, the manager needs to lead a group of managers and ensure that they can be trusted to make good decisions about a company\'s strategy. This requires an enormous amount of difficult tacit knowledge, and in extreme cases, it can take decades of experience to get right. Unfortunately, AI safety lacks the time to train people to do this internally, and it struggles to recruit many of the mid-career people who could do this. Job titles include Chief Operating Officer, Chief of Staff, Chief Executive Officer, Talent Director/Recruiting Lead, and Program/Research Manager.',
  },
  {
    id: 'ops', label: 'Operations', color: '#A9958F',
    theoryOfChange: 'Operations people can serve as productivity multipliers for everyone else in the company. Some roles are “hard ops” and require in-depth technical expertise on a certain set of skills, such as legal or financial knowledge. Other roles are more “soft ops”, which require having a deep understanding of an organization, the people working at it, and its goals. Because soft ops requires so much context on the AI safety ecosystem and its goals, it is generally much more difficult to hire for than hard ops, meaning that it’s a tighter bottleneck in the AI safety ecosystem. Some examples of soft ops roles might include managing projects, creating more productive office spaces, assisting executives in the organization, managing hiring/human resources, and running events/conferences.',
  },
  {
    id: 'generalist', label: 'Other Generalists', color: '#839099',
    theoryOfChange: 'There are problems everywhere that need solving without clear directions on how they should be solved. If we want to implement a multilateral pause on AI development, we need more political capital. We need to build out a Chinese AI safety ecosystem. We need to convince people in the labs to care about safety concerns. Many of the solutions to these problems aren’t necessarily org-shaped, so it’s nice to have high-context generalist people who can step in and solve these problems. Generalist roles often overlap with operations and scaling roles. This category also might include founders and grantmakers.',
  },
  {
    id: 'comms', label: 'Communications', color: '#8C7F9C',
    theoryOfChange: 'Succeeding in a communications role is difficult because it requires a lot of tacit knowledge that only comes from experience, meaning that it is difficult to hire for in AI safety. In practice, this looks like being able to make good judgments when faced with questions like the following: “Should we put out a statement or stay quiet?”, “Will people react well to this framing?”, or “How will journalists write stories about the information we gave them?”. They also need to have institutional knowledge: “Who actually drafts the language for this bill?”, “What does a journalist’s editor need to do to greenlight a piece”, or “Do I need to hear from a committee staffer or a member?”. Also, a lot of successful comms work requires existing, trusted relationships: policymakers need to know that you’re a reliable source, and journalists need to believe that you’re not wasting their time. Still, good comms are important for research orgs to convey the significance of their findings to the public and policymakers, the people who will make the important changes happen.',
  },
];

// ── Hoverable info boxes: stage questions, recommended-project lists,
// and the additional notes attached near the Technical Research bucket ──
const INFO_BOXES = {
  discovery_lost: {
    tag: 'Pipeline Question', title: 'Who gets lost?',
    body: 'At this point, people have only learned about AI safety to the extent that they’ve managed to stumble across it. YouTube videos, miscellaneous internet content, and discussion forums reach people who go to the internet for entertainment. Books, news articles, and some blogs reach people looking to participate in the “sophisticated” discourse. While university and high school students have plenty of time to consume fun AI safety content, many mid-career professionals with more “serious” hobbies may get fewer opportunities to think about these things. How do we address this? Primarily, anyone doing outreach should think carefully about who their target audience is and what they should do next. Additional books, conferences, and news articles might help push AI safety ideas into the mainstream, allowing mid-career professionals to get interested in learning more, with the hope of helping them pivot to an AI safety career.',
  },
  discovery_projects: {
    tag: 'Recommended Projects', title: 'Projects that might be worth trying (in addition to fixing leaks)',
    body: '• Bring AI safety representatives to more non-AI-safety conferences.\n• Create conferences dedicated to teaching mid-career professionals about AI risks.\n• Create “day in the life of an AI safety worker” short-form content targeted at ADSMs (Attention-Deficit STEM-Majors) to reach more people who may be interested in AI safety.\n• Bring QuitGPT groups to more cities and universities.\n• Motivate popular bloggers and journalists to write out more AI safety arguments, especially when they can do so with fresh arguments and perspectives. Do people spend enough time talking about AI and authoritarianism? I’m not sure, but maybe good things can happen here.\n• Double-check that every potential entry point to the pipeline recommends additional resources for people to learn more. We don’t expect everyone entering the pipeline to be a good fit to aim for a research or policy job, but we should make sure anyone who could be interested learns about resources like BlueDot.\n• University AI safety groups could advertise programs like SPAR, saying that they could provide the resources for anyone who wants a better shot at getting in.\n• Create a database of EA group alumni who can be contacted again about doing impactful things.\n• Run 80,000 Hours book tours at universities through university EA groups.\n• Get university faculty to advertise AI safety fellowships and programs.\n• Create shorter podcast episodes for people new to AI safety.',
  },
  caring_lost: {
    tag: 'Pipeline Question', title: 'Who gets lost?',
    body: 'While some are making good progress, continuing down the path can still be quite confusing for others, especially those without many friends interested in AI safety. Failing to attend events might be a continuous leakage point, and it’s worth investigating why some people never go to one.',
  },
  caring_faster: {
    tag: 'Another Question', title: 'How can we make the process faster?',
    body: 'A bunch of resources already exist in the pipeline, but maybe someone traveling through has various uncertainties slowing them down. Maybe something as simple as letting people know there’s a lot of money in AI safety would make them much more motivated to make it to the end? A lot of people have a default assumption that any work that does good will inherently come with a cut to salaries, but this isn’t necessarily the case, especially with the wave of cash flooding in.\n\nHere are some other pieces of information that, when dispersed, might speed up the pipeline:\n• Why we’re building out this pipeline so carefully (we care about impact and are worried that we have limited time)\n• Details about the intellectual history of EA and how we got here (to help people understand the culture that we’re situated within)\n• “There are real careers and job security in AI safety”\n• “You can just do things,” and “You can just do things NOW! Don’t wait for permission!”',
  },
  caring_projects: {
    tag: 'Recommended Projects', title: 'Projects that might be worth trying (in addition to fixing leaks)',
    body: '• Getting more people to motivate their friends to think about AI safety more and show them how they can get into it (Producing more “Noah Birnbaum”s). I will write a blog post about this.\n• A “retreat consultancy” org that centralizes advice about how to run good retreats and distributes it (see: Canopy Retreats and Skylark for more details).',
  },
  upskilling_missing: {
    tag: 'Pipeline Question', title: 'What are we missing?',
    body: 'For one reason or another, many of the candidates moving through the pipeline lack important skills and context. Mid-career professionals lack context on the AI safety space, and young people lack the skills and experience that the mid-career professionals have. Not many people take the time to develop a nuanced, big-picture strategy or learn how to “backchain” to determine the Theory of Change of an action. Many skills, such as communications, information security, and complex management, require years of technical practice to gain, and are hard to find in applicants who are willing to pivot into AI safety. But perhaps the hardest thing to hire for is finding people with those skills who also genuinely care about impact and will try carefully and earnestly to do good. In many places, “really caring” can mark the difference between someone good and someone great.',
  },
  upskilling_projects: {
    tag: 'Recommended Projects', title: 'Projects that might be worth trying (in addition to fixing leaks)',
    body: '• Sophie Kim is working on a grantmaking BlueDot course.\n• Some of my friends (anonymous) are working on trialing and scaling a “world model building bootcamp” for people to learn a wide range of strategy takes and relevant pieces of technical knowledge to succeed in AI safety.\n• I think an ARENA for broader strategy takes could be good. I have some thoughts about how this might look. (BlueDot struggled with this because it was hard to select good people for, hard to have clear deliverable outcomes, and there were some formatting issues. If someone is interested in pursuing this, they should look more into this.)\n• Make general tabletop exercise (TTX) resources to help scale up their usage.',
  },
  jobs_projects: {
    tag: 'Recommended Projects', title: 'Projects that might be worth trying (in addition to fixing leaks)',
    body: '• Creating more co-working spaces around the world, similar to Constellation (it’s hard for people to just fly to the Bay if they want to learn about AI safety in much more fidelity).',
  },
  note_infosec: {
    tag: 'Additional Note', title: 'Information Security',
    body: 'Many open research and software engineering jobs also wish that their hires had more information security skills, to the point that it shows up as a frequent ask on job boards. These skills seem generally scarce, though.',
  },
  note_compute: {
    tag: 'Additional Note', title: 'Compute Verification',
    body: 'Compute verification is important if we want to make a pause on AI development viable. It builds technology to monitor the types of activities data centers perform (training vs inference) by analyzing the data/metadata transmitted through their cables. When done well, it is able to detect if a model is being trained in secret, meaning that different countries will be able to trust that a pause is actually happening. The field of compute verification is very new, so it needs many roles to be filled. However, it might not be too hard to easily scale it up, compared to other roles where people entering need lots of context on AI safety macrostrategy (I am somewhat uncertain about this, though).',
  },
};

// Which info-box chips sit beside each depth layer's heading.
const STAGE_BOXES = {
  discovery: [
    { id: 'discovery_lost', label: 'Who gets lost?' },
    { id: 'discovery_projects', label: 'Projects worth trying' },
  ],
  caring: [
    { id: 'caring_lost', label: 'Who gets lost?' },
    { id: 'caring_faster', label: 'How can we make it faster?' },
    { id: 'caring_projects', label: 'Projects worth trying' },
  ],
  upskilling: [
    { id: 'upskilling_missing', label: 'What are we missing?' },
    { id: 'upskilling_projects', label: 'Projects worth trying' },
  ],
  jobs: [
    { id: 'jobs_projects', label: 'Projects worth trying' },
  ],
};

// Additional-note chips anchored near the Technical Research bucket.
const NOTE_BADGES = [
  { id: 'note_infosec', label: 'Additional Note: InfoSec' },
  { id: 'note_compute', label: 'Additional Note: Compute Verification' },
];
