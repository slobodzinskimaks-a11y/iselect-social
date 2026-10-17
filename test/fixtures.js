// Przykładowe specyfikacje (w formacie, jaki zwraca Gemini) – do demo i testów.
export const sampleSpecs = {
  reel_hook: {
    angle: 'Haczyk + decyzja widza',
    scenes: [
      { kind: 'hook', title: 'iPhone 13 Pro. Jest jeden haczyk', accent: 'haczyk', sub: 'Zgadniesz jaki?', photo: 0, seconds: 1.8 },
      { kind: 'photo', title: 'Pęknięta szybka w rogu', accent: 'Pęknięta', sub: 'Pokazujemy bez retuszu', photo: 1, seconds: 1.7 },
      { kind: 'list', title: 'Za to dostajesz', accent: 'dostajesz', items: ['+ Bateria 100%', '+ 120 Hz ProMotion', '+ Pudełko i etui MagSafe'], photo: 2, seconds: 2.4 },
      { kind: 'price', title: 'Cena?', sub: '1100 zł', photo: 0, seconds: 2 },
      { kind: 'cta', title: 'Bierzesz? TAK czy NIE', accent: 'TAK', sub: 'Napisz w komentarzu', photo: null, seconds: 2 },
    ],
    cover: { title: 'Jest jeden haczyk', accent: 'haczyk', photo: 0 },
    caption: 'iPhone 13 Pro za 1100 zł. Jest jeden haczyk – pęknięta szybka w rogu. Bierzesz? 🤔\n\n✔ bateria po wymianie: 100%\n✔ ekran 120 Hz, trzy aparaty\n✔ pudełko, kabel, etui MagSafe\n✖ pęknięta szybka w prawym dolnym rogu\n\nOdbiór osobisty w Dzierżoniowie albo wysyłka. Przyjmujemy telefony w rozliczeniu.\n\nNapisz TAK albo NIE 👇\n\n#iphone13pro #używanyiphone #dzierżoniów #iphone',
    music: { mood: 'pewny siebie, z napięciem', tempo: 'średnie', ideas: ['beat z mocnym dropem', 'trendujący rap/trap instrumental'] },
  },
  reel_angle: {
    angle: 'Porównanie: nowy vs nasz',
    scenes: [
      { kind: 'hook', title: 'Flagowiec za pół ceny?', accent: 'pół ceny', sub: 'Policzmy to uczciwie', photo: 2, seconds: 1.8 },
      { kind: 'compare', title: 'Ile zapłacisz', left: { label: 'Nowy 16 Pro', value: '5000 zł' }, right: { label: 'Nasz 13 Pro', value: '1100 zł' }, photo: 0, seconds: 2.4 },
      { kind: 'progress', title: 'Flip loading', items: ['0%|kupiony', '40%|nowa bateria', '80%|sesja zdjęć', '100%|gotowy dla Ciebie'], photo: null, seconds: 2.8 },
      { kind: 'cta', title: 'Napisz CHCĘ na DM', accent: 'CHCĘ', sub: 'Odbiór w Dzierżoniowie lub wysyłka', photo: 0, seconds: 2 },
    ],
    cover: { title: 'Flagowiec za pół ceny?', accent: 'pół ceny', photo: 2 },
    caption: 'Flagowiec za pół ceny? Policzmy uczciwie. 📱\n\niPhone 13 Pro, 128 GB, Graphite, bateria 100% – 1100 zł.\n\nNapisz CHCĘ na DM 📩\n\n#iphone13pro #używanyiphone #dzierżoniów',
    music: { mood: 'energiczny', tempo: 'szybkie', ideas: ['szybki trend z przejściami'] },
  },
  carousel_offer: {
    theme: 'graphite',
    slides: [
      { kind: 'cover', tag: 'NA SPRZEDAŻ', title: 'iPhone 13 Pro', accent: 'Pro', sub: 'Graphite · 128 GB · bateria 100%', bullets: ['+ Pełny zestaw', '+ Uczciwy opis stanu'], photo: 0 },
      { kind: 'specs', tag: 'SPECYFIKACJA', title: 'Konkrety', accent: 'Konkrety', specs: [{ label: 'Bateria', value: '100%' }, { label: 'Pamięć', value: '128 GB' }, { label: 'Ekran', value: '120 Hz' }, { label: 'Aparaty', value: '3 × 12 MP' }], photo: 2 },
      { kind: 'bullets', tag: 'UCZCIWIE O STANIE', title: 'Co musisz wiedzieć', accent: 'wiedzieć', bullets: ['- Pęknięta szybka w prawym dolnym rogu', '- Drobne ślady na ramce', '+ Wszystko działa, bez blokad'], photo: 1 },
      { kind: 'price', tag: 'CENA', title: 'Uczciwa cena', accent: 'Uczciwa', specs: [{ label: 'Cena', value: '1100 zł' }], bullets: ['+ Przyjmujemy telefony w rozliczeniu'], photo: 0 },
      { kind: 'cta', tag: 'KONTAKT', title: 'Chcesz go? Napisz CHCĘ', accent: 'CHCĘ', sub: 'Zapisz post, jeśli porównujesz oferty.', photo: null },
    ],
    caption: 'NA SPRZEDAŻ: iPhone 13 Pro 128 GB, Graphite 📱\n\nUczciwie o stanie – wszystko widać na zdjęciach.\n\nCena: 1100 zł. Dzierżoniów – odbiór osobisty lub wysyłka.\n\nNapisz CHCĘ na DM 📩\n\n#iphone13pro #używanyiphone #dzierżoniów #iphone',
  },
  carousel_value: {
    theme: 'red',
    slides: [
      { kind: 'cover', tag: 'ZAPISZ', title: '5 rzeczy przed zakupem iPhone’a', accent: '5 rzeczy', sub: 'Sprawdź, zanim zapłacisz', photo: 2 },
      { kind: 'bullets', tag: 'CHECKLISTA', title: 'Sprawdź to na miejscu', accent: 'na miejscu', bullets: ['1. Kondycja baterii', '2. Wylogowanie z iCloud', '3. Face ID i aparaty', '4. Numer IMEI', '5. Oryginalność ekranu'], photo: null },
      { kind: 'cta', tag: 'ISELECT', title: 'U nas sprawdzisz wszystko', accent: 'wszystko', sub: 'Napisz, jakiego iPhone’a szukasz.', photo: 0 },
    ],
    caption: '5 rzeczy, które sprawdzam, zanim kupię używanego iPhone’a. Zapisz 🔖\n\n#używanyiphone #iphone #dzierżoniów',
  },
  story: { tag: 'NOWOŚĆ NA STANIE', title: 'iPhone 13 Pro za 1100 zł', accent: '1100 zł', sub: 'Bateria 100%, pełny zestaw', cta: 'Napisz na DM', photo: 0 },
};

const STORY_TITLES = { 2: 'iPhone 13 Pro za 1100 zł', 4: 'Ile byś za niego dał?', 6: 'Przyjmujemy w rozliczeniu' };

// Surowe specyfikacje dla listy slotów { id, date, kind } – jak odpowiedź Gemini { items: {...} }.
export function rawPackage(slots) {
  const items = {};
  for (const s of slots) {
    items[s.id] = s.kind === 'story'
      ? { ...sampleSpecs.story, title: STORY_TITLES[new Date(`${s.date}T00:00:00Z`).getUTCDay()] ?? sampleSpecs.story.title }
      : sampleSpecs[s.kind];
  }
  return { items };
}
