import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export const FAQ = [
  {
    q: 'How is this different from other language apps?',
    a: 'Most apps check whether speech recognition understood the word. Being understood is not the same as saying it well. Wunder Tutor scores pronunciation sound by sound, shows which sound slipped, explains what to do with your mouth, and lets your child retry straight away and hear the difference.',
  },
  {
    q: 'What does my child need?',
    a: 'A phone, tablet or laptop with a microphone and a modern browser. There is nothing to install — it opens in the browser and can be added to the home screen like an app.',
  },
  {
    q: 'What happens to my child’s voice?',
    a: 'The microphone is only on while the mic button is red. Each short recording is sent securely to Microsoft Azure’s speech service to be scored, and is not stored by us on any server. Recordings your child can replay (“before” and “now”) stay on the device, and you can switch that off or delete them at any time in the Parent Zone.',
  },
  {
    q: 'American or British English?',
    a: 'You choose during setup. The teacher’s voice and the feedback follow your choice, and legitimate differences between the two accents are not marked as mistakes — for example, a British learner is not expected to pronounce the “r” at the end of “water”.',
  },
  {
    q: 'My child speaks Spanish / Chinese / Hindi at home. Does that matter?',
    a: 'Yes — in a good way. You tell Pip your home language during setup, and Pip uses it to predict which English sounds will be trickiest, so the very first session is already personal. After that, Pip learns from what your child actually says.',
  },
  {
    q: 'How long is a lesson?',
    a: 'About 3 to 7 minutes. Short, frequent speaking practice works better than long sessions, and it keeps younger children keen to come back.',
  },
  {
    q: 'Is it finished?',
    a: 'Not yet — this is a beta. The first unit (“Yummy Food”), the Pronunciation Lab for eight tricky sounds and three speaking scenarios are ready; more units are being written. Progress is currently saved on the device you use.',
  },
  {
    q: 'How much does it cost?',
    a: 'It is free during the beta. We will be clear about pricing well before anything changes.',
  },
];

export default function Faq() {
  return (
    <Accordion type="single" collapsible className="w-full">
      {FAQ.map((f, i) => (
        <AccordionItem key={f.q} value={`q${i}`} className="border-border">
          <AccordionTrigger className="py-5 text-left font-display text-lg font-extrabold hover:no-underline md:text-xl">{f.q}</AccordionTrigger>
          <AccordionContent className="pb-5 text-base leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
