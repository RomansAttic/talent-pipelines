// js/config.js — All constants, data definitions

// ── Full-bleed depth layers behind the whole pipeline, atmosphere-diagram
// style — the deeper the layer, the further along the pipeline someone
// has gotten. Boundaries are computed from the live layout (tank/rail/
// ground positions), not stored here; this just carries each layer's
// name, solid color, and the description text that fades in on hover.
const PIPELINE_LAYERS = [
  {
    id: 'discovery', label: 'DISCOVERY', color: '#eef1f4',
    text: 'Millions of people could contribute to AI safety, but of everyone who might, roughly 80% never meaningfully encounter the field at all — the droplets shown here are a tiny sample of those who do. They arrive through a YouTube video, a friend\'s offhand mention, or a conference talk, but a first spark of interest rarely turns into anything more without a next step to take.',
  },
  {
    id: 'caring', label: 'REALLY STARTING TO CARE', color: '#dfe4e8',
    text: 'Once curiosity turns into real interest, people look for a way in — joining a local group, attending an event like EAG, or finding community online. This is also where quiet, unforced disengagement takes the largest toll.',
  },
  {
    id: 'upskilling', label: 'UPSKILLING', color: '#cfd6db',
    text: 'Turning interest into capability means building real skills — through independent study, fellowships, or research programs — and starting to decide which kind of role in AI safety actually fits.',
  },
  {
    id: 'jobs', label: 'CAREER CHOICES', color: '#bfc8cf',
    text: 'The few who make it this far land in one of five career paths — technical research, policy, generalist leadership, communications, or information security — each facing a very different supply-and-demand gap.',
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
  // that enter a given major pipe survive to the far end.
  LEAK_SEVERITY: { funnel: 1.5, caring: 2.2, upskilling: 1.3, jobs: 1.15 },
  CENTER_X: 800,             // updated at runtime
};

const PERSON_TYPES = [
  {
    id: 'highschool',
    label: 'High School Student',
    color: '#B7CCE0',
    weight: 0.20,
    description: 'Young people still in high school, often introduced via YouTube or EA clubs. A large potential cohort with a long runway.',
    funnelWeights: { youtube:0.28, misc:0.20, lesswrong:0.14, university:0.10, friends:0.09, events:0.06, blogs:0.05, fellowships:0.02, activist:0.02, movies:0.02, conferences:0.01, protests:0.01 },
    bucketWeights: { research:0.28, policy:0.20, generalist:0.30, comms:0.17, infosec:0.05 },
  },
  {
    id: 'undergrad',
    label: 'Undergraduate Student',
    color: '#90AFC9',
    weight: 0.28,
    description: 'University students — the largest and most reachable cohort. Campus EA/AI Safety groups are the primary pathway.',
    funnelWeights: { university:0.30, friends:0.18, fellowships:0.13, events:0.08, blogs:0.09, youtube:0.07, misc:0.05, lesswrong:0.04, conferences:0.02, activist:0.02, movies:0.01, protests:0.01 },
    bucketWeights: { research:0.45, policy:0.25, generalist:0.15, comms:0.10, infosec:0.05 },
  },
  {
    id: 'phd',
    label: 'PhD Student / Researcher',
    color: '#5E7F9C',
    weight: 0.20,
    description: 'Graduate researchers in ML, CS, or philosophy. The strongest pipeline of any group — and the most directly recruited.',
    funnelWeights: { fellowships:0.26, conferences:0.22, blogs:0.17, friends:0.13, events:0.08, misc:0.05, lesswrong:0.03, university:0.03, youtube:0.01, activist:0.01, movies:0.005, protests:0.005 },
    bucketWeights: { research:0.65, policy:0.15, generalist:0.10, comms:0.05, infosec:0.05 },
  },
  {
    id: 'infosec',
    label: 'Mid-career: InfoSec',
    color: '#97A3AE',
    weight: 0.07,
    description: 'Security professionals with directly applicable skills (red-teaming, adversarial thinking). Critically undersupplied — and rarely reached.',
    funnelWeights: { conferences:0.28, misc:0.18, friends:0.13, activist:0.12, events:0.12, youtube:0.09, blogs:0.05, fellowships:0.01, university:0.01, lesswrong:0.01, movies:0.00, protests:0.00 },
    bucketWeights: { infosec:0.45, research:0.20, generalist:0.20, policy:0.10, comms:0.05 },
  },
  {
    id: 'comms',
    label: 'Mid-career: Communications',
    color: '#7C93A8',
    weight: 0.07,
    description: 'PR, journalism, and comms professionals. The pipeline almost never reaches them, despite critical need.',
    funnelWeights: { misc:0.20, activist:0.20, movies:0.16, events:0.14, friends:0.13, youtube:0.09, conferences:0.05, blogs:0.01, fellowships:0.01, university:0.01, lesswrong:0.00, protests:0.00 },
    bucketWeights: { comms:0.45, policy:0.20, generalist:0.20, research:0.10, infosec:0.05 },
  },
  {
    id: 'swe',
    label: 'Mid-career: SWE',
    color: '#6C8CA6',
    weight: 0.08,
    description: 'Industry software engineers. Technical background helps, but the pipeline is weak for non-academic entrants.',
    funnelWeights: { youtube:0.18, blogs:0.18, misc:0.16, conferences:0.16, friends:0.13, events:0.10, lesswrong:0.05, fellowships:0.02, university:0.01, activist:0.005, movies:0.005, protests:0.00 },
    bucketWeights: { research:0.50, generalist:0.20, infosec:0.15, policy:0.10, comms:0.05 },
  },
  {
    id: 'econ',
    label: 'Mid-career: Economist',
    color: '#AAB4BD',
    weight: 0.05,
    description: 'Economists and policy analysts. Valuable for governance; a moderate pipeline exists via policy networks.',
    funnelWeights: { blogs:0.22, conferences:0.22, friends:0.18, fellowships:0.13, events:0.10, misc:0.08, university:0.05, youtube:0.01, activist:0.005, lesswrong:0.005, movies:0.00, protests:0.00 },
    bucketWeights: { policy:0.55, research:0.20, generalist:0.15, comms:0.05, infosec:0.05 },
  },
  {
    id: 'other',
    label: 'Mid-career: Other',
    color: '#839099',
    weight: 0.05,
    description: 'Lawyers, doctors, social scientists, and more. Often self-directed; the pipeline offers little targeted support.',
    funnelWeights: { friends:0.26, misc:0.18, movies:0.13, activist:0.13, events:0.12, youtube:0.09, blogs:0.04, university:0.04, conferences:0.01, lesswrong:0.00, fellowships:0.00, protests:0.00 },
    bucketWeights: { generalist:0.35, policy:0.25, research:0.20, comms:0.15, infosec:0.05 },
  },
];

// ── Entry channels: each rendered as its own mini-funnel ─────
const ENTRY_CHANNELS = [
  {
    id: 'youtube', label: 'YouTube', fullLabel: 'YouTube Videos',
    examples: 'Rob Miles · AI in Context · Bentham\'s Bulldog · Scott Alexander (readings)',
    description: 'AI safety YouTube reaches large audiences — but conversion to sustained engagement is very low.',
  },
  {
    id: 'blogs', label: 'Blogs', fullLabel: 'Blog Posts',
    examples: 'Alignment Forum · Slate Star Codex · Cold Takes · Paul Christiano',
    description: 'Long-form blog content reaches technically literate readers who engage deeply.',
  },
  {
    id: 'lesswrong', label: 'LW / HPMOR', fullLabel: 'LessWrong / HPMOR',
    examples: 'LessWrong · Harry Potter and the Methods of Rationality · rationalist ecosystem',
    description: 'The rationalist community is a major gateway — but has significant cultural barriers.',
  },
  {
    id: 'misc', label: 'Web / Social', fullLabel: 'Miscellaneous Internet',
    examples: 'Twitter/X · Reddit · news articles · LinkedIn · newsletters',
    description: 'Social media creates brief awareness spikes — rarely leading to sustained engagement.',
  },
  {
    id: 'university', label: 'Uni Groups', fullLabel: 'University EA / AI Safety Groups',
    examples: 'AISF · Cambridge AI Safety Society · student-run EA chapters',
    description: 'University groups are among the most effective pathways — but quality varies wildly.',
  },
  {
    id: 'fellowships', label: 'Fellowships', fullLabel: 'Fellowship Applications & Offers',
    examples: 'MATS · ARENA · BlueDot Impact · AISF Introductory Program',
    description: 'Fellowships actively recruit — but high rejection rates filter many promising candidates.',
  },
  {
    id: 'friends', label: 'Friends', fullLabel: 'Friend Recommendations',
    examples: 'Personal introductions · peer-to-peer sharing · community members',
    description: 'Word-of-mouth is the highest-quality conversion pathway — but inherently limited in scale.',
  },
  {
    id: 'activist', label: 'Activism', fullLabel: 'Adjacent Activist Groups',
    examples: 'PauseAI · tech ethics groups · digital rights crossover · Stop Killer Robots',
    description: 'Adjacent movements bring people in, but their theory of change may diverge.',
  },
  {
    id: 'movies', label: 'Screenings', fullLabel: 'Movie Screenings',
    examples: '"We Need to Talk About AI" screenings · documentary nights',
    description: 'High emotional impact but low sustained engagement without strong follow-up structure.',
  },
  {
    id: 'events', label: 'Local Events', fullLabel: 'Local Events & Meetups',
    examples: 'Meetups · panels · hackathons · discussion nights',
    description: 'Casual local events create light first contact, but rarely give a next step toward deeper involvement.',
  },
  {
    id: 'conferences', label: 'Conferences', fullLabel: 'AI Conferences / Safety Days',
    examples: 'NeurIPS safety workshops · ICLR · GovAI events · ML Safety days',
    description: 'Reaches technical professionals — but safety tracks are often marginalized.',
  },
  {
    id: 'protests', label: 'Protests', fullLabel: 'AI Safety Protests',
    examples: 'Protest marches · public demonstrations · open letters',
    description: 'Growing tactic, but framing often mismatches the technical-research-focused pipeline.',
  },
];

// ── Caring-stage sub-paths (three columns) ────────────────────
const CARING_PATHS = [
  { label: 'Organizing', items: ['Running a local EA/AI Safety group', 'Campus chapter leadership', 'Event hosting'] },
  { label: 'Events', items: ['EAG', 'Action Potential', 'GCP', 'The Curve', 'Control Conference', 'Uni retreats'] },
  { label: 'Communities', items: ['EA/AIS groups', 'Dedicated blogs', 'Friend networks', '80,000 Hours'] },
];

// ── Upskilling items, split by barrier to entry ───────────────
const EASY_UPSKILLING = ['BlueDot Impact courses', 'Career transition grants', 'Fieldbuilder / incubation weeks', 'Contractor / intern roles'];
const HARD_UPSKILLING = ['Research fellowships (MATS, ARENA)', 'Generator Residency', 'Tarbell Fellowship', 'Genstream (LISA)'];
const JOB_DECISION_ITEMS = ['Discussions with mentors', '80,000 Hours advising', 'Career guides by role', 'Org direct outreach'];

// ── Which entry channels share a failure mode (and so share one pipe
// down to tank1, rather than each getting its own) ───────────────
const FUNNEL_GROUPS = [
  { id: 'no_followup', channelIds: ['youtube', 'misc', 'movies', 'events'] },
  { id: 'blogs_solo', channelIds: ['blogs'] },
  { id: 'culture_mismatch', channelIds: ['lesswrong', 'activist', 'protests'] },
  { id: 'university_solo', channelIds: ['university'] },
  { id: 'fellowships_solo', channelIds: ['fellowships'] },
  { id: 'friends_solo', channelIds: ['friends'] },
  { id: 'conferences_solo', channelIds: ['conferences'] },
];

const LEAKS = [
  // ── Entry-channel leaks. Channels that share the same underlying
  // failure mode share one leak (and, per the layout, one downstream
  // pipe) rather than each getting a separate diagnosis. ──
  {
    id:'no_followup_path', stage:'funnel', channels:['youtube','misc','movies','events'],
    title: 'No Clear Next Step After Initial Exposure',
    escapeRate: 0.76, fixedEscapeRate: 0.56, fixed: false,
    problem: 'YouTube videos, social media buzz, movie screenings, and local meetups all create a spark of interest — but none of them reliably hand people a next step. Viewers and attendees are engaged in the moment, but with no obvious path to community or action, most drift away within days.',
    solution: 'PARTIAL FIX: More creators and organizers now add explicit calls-to-action — links to AISF, 80,000 Hours guides, local group finders, and post-event mailing lists. Still reaches only a fraction of the people who pass through.',
    impactNote: 'Small improvement. Without dedicated follow-up infrastructure, this kind of casual spark of attention decays fast.',
  },
  {
    id:'blog_overwhelm', stage:'funnel', channels:['blogs'],
    title: 'Content Is Too Technical for Newcomers',
    escapeRate: 0.60, fixedEscapeRate: 0.40, fixed: false,
    problem: 'The Alignment Forum assumes significant ML and philosophy background. Curious newcomers read a post, feel overwhelmed and unqualified, and don\'t return.',
    solution: 'PARTIAL FIX: AGI Safety Fundamentals reading sequences and beginner guides give structure. Still requires significant self-motivation without a community.',
    impactNote: 'Moderate improvement for technically-minded readers. Less so for others.',
  },
  {
    id:'culture_framing_mismatch', stage:'funnel', channels:['lesswrong','activist','protests'],
    title: 'Culture and Framing Don\'t Match the Pipeline',
    escapeRate: 0.73, fixedEscapeRate: 0.59, fixed: false,
    problem: 'Rationalist/LessWrong spaces, adjacent activist movements, and protest culture each bring people in — but each has its own vocabulary, norms, and theory of change that often clash with the technical, multi-year career path the rest of the pipeline assumes. Newcomers who don\'t fit that mold often stay in their entry community rather than moving further in.',
    solution: 'PARTIAL FIX: Newcomer guides, coalition-building events, and explicit acknowledgment that different roles and timelines are all needed help some people bridge the gap. Cultural change is slow.',
    impactNote: 'Limited improvement. These are genuine worldview and framing differences, not just onboarding friction.',
  },
  {
    id:'university_quality', stage:'funnel', channels:['university'],
    title: 'Group Quality Is Highly Variable',
    escapeRate: 0.45, fixedEscapeRate: 0.28, fixed: false,
    problem: 'University AI safety groups range from highly organized programs with excellent curricula to semi-active chat groups that never run a session. Students in low-quality groups rarely progress further.',
    solution: 'MODERATE FIX: AISF group support and dedicated campus organizer funding significantly improve quality at funded groups. Most campuses still lack this.',
    impactNote: 'Meaningful improvement where resources are deployed — but most campuses go unsupported.',
  },
  {
    id:'fellowship_rejection', stage:'funnel', channels:['fellowships'],
    title: 'High Rejection Rates Are Demoralizing',
    escapeRate: 0.70, fixedEscapeRate: 0.55, fixed: false,
    problem: 'Leading fellowship programs (MATS, ARENA, AISF) accept only 5–15% of applicants. Rejection with little feedback discourages reapplication and leaves people without alternative pathways.',
    solution: 'PARTIAL FIX: More fellowship slots, structured rejection feedback, and explicit "what to do if rejected" resources help at the margins. Capacity is the fundamental bottleneck.',
    impactNote: 'Small improvement without major, sustained funding increases for program expansion.',
  },
  {
    id:'friend_recs_quality', stage:'funnel', channels:['friends'],
    title: 'Word-of-Mouth Doesn\'t Scale',
    escapeRate: 0.30, fixedEscapeRate: 0.22, fixed: false,
    problem: 'Friend recommendations are the highest-quality pipeline entry — but they\'re limited to existing community social graphs. The people most likely to refer others are already in the community.',
    solution: 'PARTIAL FIX: "Refer a friend" toolkits and shareable AI safety content give modest boosts to word-of-mouth.',
    impactNote: 'Small scale improvement. High quality per referral remains unchanged.',
  },
  {
    id:'conference_marginalization', stage:'funnel', channels:['conferences'],
    title: 'Safety Tracks Feel Marginal',
    escapeRate: 0.55, fixedEscapeRate: 0.38, fixed: false,
    problem: 'At major AI conferences, safety workshops are seen as peripheral. Industry incentives dominate, and safety researchers often feel they\'re preaching to the unconverted in a side room.',
    solution: 'MODERATE FIX: Dedicated safety-focused conferences (ML Safety days, GovAI events) create focused communities with much better follow-through than workshop tracks.',
    impactNote: 'Meaningful improvement for technically-minded audiences attending dedicated events.',
  },

  // ── Caring stage leaks ──
  {
    id:'impostor_syndrome', stage:'caring',
    title: 'Impostor Syndrome and Role Confusion',
    escapeRate: 0.45, fixedEscapeRate: 0.30, fixed: false,
    problem: 'Many people who care deeply about AI safety conclude they\'re not smart, technical, or credentialed enough to contribute. This is especially common among non-ML people, who see no clear role for themselves.',
    solution: 'MODERATE FIX: Explicit messaging that operations, communications, policy, and generalist roles are urgently needed. Structured mentorship and "paths in" content help significantly for those who encounter it.',
    impactNote: 'Meaningful improvement with targeted messaging and 1:1 advising access.',
  },
  {
    id:'event_inaccessibility', stage:'caring',
    title: 'Key Events Are Geographically Inaccessible',
    escapeRate: 0.38, fixedEscapeRate: 0.25, fixed: false,
    problem: 'EAG, GCP, Action Potential, and similar conferences are expensive to attend and concentrated in San Francisco, London, and Oxford — excluding promising people globally, especially in the Global South.',
    solution: 'MODERATE FIX: More travel grants, virtual attendance options, and regional events reduce but don\'t eliminate this barrier. Geography and cost remain significant.',
    impactNote: 'Meaningful improvement with dedicated travel grant funding. Gap remains large.',
  },
  {
    id:'community_insularity', stage:'caring',
    title: 'Community Feels Cliquish to Newcomers',
    escapeRate: 0.38, fixedEscapeRate: 0.26, fixed: false,
    problem: 'EA and AI safety communities, especially in-person, can feel like tight social graphs where outsiders struggle to build relationships quickly. Status dynamics and shared references are alienating.',
    solution: 'PARTIAL FIX: Structured newcomer programs, welcome events, and buddy systems at conferences help at the margins. Culture shifts slowly.',
    impactNote: 'Moderate improvement where explicitly invested in. Not a systemic fix.',
  },
  {
    id:'unclear_next_steps_caring', stage:'caring',
    title: 'No Clear Path from "Caring" to "Doing"',
    escapeRate: 0.50, fixedEscapeRate: 0.33, fixed: false,
    problem: 'After genuinely engaging with AI safety, many people stall. They don\'t know which role to pursue, what upskilling to do, whether to pivot careers, or how to make themselves useful to existing orgs.',
    solution: 'SIGNIFICANT FIX: 80,000 Hours advising calls, structured career guides by role, and university group programming provide clarity. Most impact comes from 1:1 advising — but advising capacity is limited.',
    impactNote: 'Significant improvement where advising resources are available. Capacity is the limit.',
  },

  // ── Tank leak: ongoing dwelling attrition straight out of "Really
  // Starting to Care" itself, distinct from the conn1 pipe leaks above
  // (which model specific named barriers on the way to tank2) — this one
  // is just the fact that caring alone, with no specific external
  // barrier, doesn't reliably sustain itself. Checked every frame while
  // dwelling (a per-frame probability) rather than once at a path
  // checkpoint, so it isn't run through the generic LEAK_SEVERITY scaling
  // the checkpoint-style leaks use.
  {
    id:'quiet_disengagement', stage:'tank1',
    title: 'Quiet Disengagement Sets In',
    escapeRate: 0.007, fixedEscapeRate: 0.0035, fixed: false,
    problem: 'Even with no specific external barrier, initial enthusiasm for AI safety often fades on its own within weeks — life gets busy, the initial spark isn\'t reinforced, and there\'s no active pull keeping someone engaged.',
    solution: 'PARTIAL FIX: Regular touchpoints (newsletters, local groups, cohort-based programs) give people a reason to stay engaged even without a specific next step in mind yet.',
    impactNote: 'Reduces drop-off meaningfully, but organic fade is hard to fully prevent.',
  },

  // ── Upskilling stage leaks ──
  {
    id:'program_capacity', stage:'upskilling',
    title: 'Programs Are Severely Oversubscribed',
    escapeRate: 0.55, fixedEscapeRate: 0.40, fixed: false,
    problem: 'MATS, ARENA, BlueDot Impact, and similar programs receive 10–30× more applicants than they can accept. Many rejected candidates don\'t find alternative pathways and leave the field.',
    solution: 'PARTIAL FIX: Increased funding for program expansion helps, but quality is hard to scale quickly. Better "what to do if rejected" resources provide some recovery.',
    impactNote: 'Limited improvement without major, sustained funding increases.',
  },
  {
    id:'midcareer_blind_spot', stage:'upskilling',
    title: 'Mid-Career Professionals Lack Support',
    escapeRate: 0.65, fixedEscapeRate: 0.48, fixed: false,
    problem: 'Career transition grants and upskilling programs are underadvertised to mid-career people, who also need different kinds of support: income replacement, schedule flexibility, and credentialing.',
    solution: 'MODERATE FIX: Dedicated mid-career programs, outreach at professional conferences, part-time upskilling options, and income-bridging grants reduce the career-change cost meaningfully.',
    impactNote: 'Meaningful improvement with targeted mid-career programming. Currently underinvested.',
  },
  {
    id:'non_research_upskilling_gap', stage:'upskilling',
    title: 'Non-Research Roles Have Almost No Programs',
    escapeRate: 0.72, fixedEscapeRate: 0.55, fixed: false,
    problem: 'Nearly all upskilling programs (BlueDot, MATS, ARENA) focus on ML researchers. Operations, communications, policy, and infosec professionals have almost no targeted options.',
    solution: 'PARTIAL FIX: Tarbell Fellowship (policy), Genstream at LISA (various), and fieldbuilder incubation weeks are emerging. Still vastly underresourced vs. research programs.',
    impactNote: 'Small improvement. The structural gap is large and persistent. More investment urgently needed.',
  },
  {
    id:'mentor_access', stage:'upskilling',
    title: 'Mentor Access Is Unevenly Distributed',
    escapeRate: 0.45, fixedEscapeRate: 0.30, fixed: false,
    problem: 'Well-connected people at top universities or with existing community ties get mentorship easily. Those without prior connections navigate alone and are far more likely to disengage.',
    solution: 'MODERATE FIX: 80k Hours mentorship matching, structured group advising calls, and AI safety career advisors embedded at more universities significantly democratize access.',
    impactNote: 'Meaningful improvement with structured mentorship infrastructure.',
  },

  // ── Job-stage leaks ──
  {
    id:'generalist_pipeline_gap', stage:'jobs', bucket:'generalist',
    title: 'No Pipeline for Generalist Leaders',
    escapeRate: 0.82, fixedEscapeRate: 0.65, fixed: false,
    problem: 'AI safety orgs desperately need operational leaders, chiefs of staff, program directors, and executive generalists — but the pipeline offers almost no targeted support for these roles. Most generalists pivot to research or leave.',
    solution: 'PARTIAL FIX: Explicit generalist tracks at incubation programs and exec team building at growing AI safety orgs create some pipeline.',
    impactNote: 'Large opportunity. One of the most critical current bottlenecks in the field.',
  },
  {
    id:'comms_pipeline_gap', stage:'jobs', bucket:'comms',
    title: 'Communications Professionals Are Never Reached',
    escapeRate: 0.87, fixedEscapeRate: 0.72, fixed: false,
    problem: 'PR, journalism, and communications professionals rarely encounter AI safety at all, and when they do, no structured pathway supports them into roles where their skills are desperately needed.',
    solution: 'PARTIAL FIX: Targeted outreach at comms professional events and dedicated AI safety comms fellowships create a thin pipeline.',
    impactNote: 'Large opportunity. Currently almost entirely neglected as a pipeline target.',
  },
  {
    id:'infosec_pipeline_gap', stage:'jobs', bucket:'infosec',
    title: 'Security Professionals Aren\'t Recruited',
    escapeRate: 0.83, fixedEscapeRate: 0.68, fixed: false,
    problem: 'Information security professionals have directly applicable skills (red-teaming, adversarial thinking, threat modeling) but are almost never actively recruited or supported into AI safety roles.',
    solution: 'PARTIAL FIX: AI safety messaging at security conferences, infosec-to-safety transition fellowships, and dedicated red-teaming roles at AI safety labs create initial pathways.',
    impactNote: 'Large opportunity. Skills are directly applicable to AI security and red-teaming work.',
  },
];

const JOB_BUCKETS = [
  {
    id: 'research',
    label: 'Technical Research',
    color: '#5E7F9C',
    pipelineStrength: 'STRONG',
    demandSaturationPoint: 10,
    baseMarginalImpact: 0.38,
    theoryOfChange: 'Technical safety researchers identify failure modes, develop alignment techniques, and advance our understanding of how to build AI that reliably does what we want — directly reducing the odds that a future powerful system behaves in catastrophic, uncontrolled ways. Research is the single most in-demand skillset in AI safety job postings (~43%), especially in academia (~86%). But at AI labs specifically, where the most consequential deployment decisions get made, only ~37% of roles need it, and usually paired with policy or engineering. The pipeline here is strong and well-supplied; the field\'s most acute constraints increasingly lie elsewhere.',
  },
  {
    id: 'policy',
    label: 'Policy & Governance',
    color: '#7C93A8',
    pipelineStrength: 'MODERATE',
    demandSaturationPoint: 18,
    baseMarginalImpact: 0.62,
    theoryOfChange: 'AI policy professionals shape whether powerful AI gets developed and deployed under real safeguards — through legislation, international coordination, and advising the institutions that will make consequential calls under time pressure. Policy skills appear in roughly a quarter of AI safety postings, concentrated in public institutions (~55%) and NGOs (~30%). Existential risk from AI isn\'t purely a technical problem: it\'s also a coordination problem between labs, states, and the public that only policy work can address.',
  },
  {
    id: 'generalist',
    label: 'Generalist Leadership',
    color: '#97A3AE',
    pipelineStrength: 'WEAK',
    demandSaturationPoint: 35,
    baseMarginalImpact: 0.95,
    theoryOfChange: 'Every safety org needs people who can actually run it: hiring, fundraising, operations, and scaling the institutions doing the safety-relevant work. Leadership postings prioritize management (~52%) and operations (~36%) over research skills (needed in under 10% of these roles) — yet almost every AI-safety-specific training pipeline produces researchers, not operators. A safety org stalled on hiring a chief of staff is safety-relevant work not getting done, no matter how many aligned researchers exist.',
  },
  {
    id: 'comms',
    label: 'Comms & Outreach',
    color: '#A9958F',
    pipelineStrength: 'VERY WEAK',
    demandSaturationPoint: 40,
    baseMarginalImpact: 0.97,
    theoryOfChange: 'Communications professionals translate what\'s actually happening inside labs and safety research into terms journalists, policymakers, and the public can act on — shaping whether the world responds to AI risk with urgency or shrugs it off. Outreach skills show up in under 7% of AI safety postings, almost entirely at NGOs (~21%), with essentially none at labs or public institutions. A field that can\'t explain the risk it exists to prevent has a much harder time getting the attention, funding, and regulation needed to actually prevent it.',
  },
  {
    id: 'infosec',
    label: 'Information Security',
    color: '#A9695F',
    pipelineStrength: 'VERY WEAK',
    demandSaturationPoint: 30,
    baseMarginalImpact: 0.97,
    theoryOfChange: 'InfoSec professionals protect against model theft, weight exfiltration, and adversarial attacks that could let dangerous capabilities leak out of controlled environments before safety measures are ready. This is the largest specific skill gap the data reveals: information security is needed in nearly half of AI-lab job postings (~49%) — the single highest concentration of any skillset at labs — yet it\'s barely represented in AI safety career advising or training pipelines. The skills are directly transferable from the existing infosec profession; almost nobody in that profession currently hears the case for making the move.',
  },
];
