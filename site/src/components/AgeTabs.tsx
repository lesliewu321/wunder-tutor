import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const BANDS = [
  {
    id: 'little', label: 'Little', ages: '5–7', emoji: '🍎',
    sample: 'apple', sampleNote: 'Single words with big pictures',
    tip: '“Peek your tongue out between your teeth and blow softly — like a quiet snake!”',
    points: ['Picture-led — almost no reading needed', 'Tutu says every tip out loud', 'Stars alongside the score', 'Tiny phrases like “Milk, please.”'],
  },
  {
    id: 'junior', label: 'Junior', ages: '8–11', emoji: '💧',
    sample: 'Can I have some water, please?', sampleNote: 'Short, useful sentences',
    tip: '“Put the tip of your tongue lightly between your teeth and blow air over it.”',
    points: ['Playful, but not babyish', 'Meaning shown with every new phrase', 'Listening games: three or tree?', 'Short café and zoo conversations'],
  },
  {
    id: 'teen', label: 'Teen', ages: '12–17', emoji: '☕',
    sample: 'I would like a cup of hot chocolate.', sampleNote: 'Natural, full sentences',
    tip: '“Rest your tongue tip lightly between your teeth and push air forward. No voice.”',
    points: ['A cleaner, calmer look', 'Phonetic symbols like /θ/ and /r/', 'Optional deeper detail on each sound', 'A higher bar for “mastered”'],
  },
];

/** The same lesson, three ways — shown with the real example content from the app. */
export default function AgeTabs() {
  return (
    <Tabs defaultValue="junior" className="w-full">
      <TabsList className="mx-auto grid h-auto w-full max-w-md grid-cols-3 rounded-2xl bg-secondary p-1.5">
        {BANDS.map((b) => (
          <TabsTrigger key={b.id} value={b.id} className="rounded-xl py-2.5 font-display text-base font-extrabold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow">
            {b.label} <span className="ml-1 text-xs font-bold opacity-70">{b.ages}</span>
          </TabsTrigger>
        ))}
      </TabsList>
      {BANDS.map((b) => (
        <TabsContent key={b.id} value={b.id} className="mt-8 focus-visible:outline-none">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div className="rounded-[2rem] bg-card p-8 text-center shadow-sm ring-1 ring-border">
              <div className="text-6xl" aria-hidden>{b.emoji}</div>
              <p className="mt-3 font-display text-3xl font-extrabold leading-tight md:text-4xl">{b.sample}</p>
              <p className="mt-2 text-sm text-muted-foreground">{b.sampleNote}</p>
              <p className="mt-6 rounded-2xl bg-sun-soft px-4 py-3 text-left text-[0.95rem] text-foreground"><span className="font-extrabold text-primary">Tutu’s tip for “th”: </span>{b.tip}</p>
            </div>
            <ul className="space-y-3">
              {b.points.map((pt) => (
                <li key={pt} className="flex items-start gap-3 text-lg">
                  <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-leaf-soft text-sm font-extrabold text-good" aria-hidden>✓</span>
                  {pt}
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
