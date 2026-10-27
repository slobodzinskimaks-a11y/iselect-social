// Tworzy kanał #instrukcje (jeśli go nie ma) i publikuje zasady działania bota.
// Uruchom ponownie po zmianach: node scripts/instructions.js  (stare wiadomości bota na kanale zostaną zastąpione)
import { config } from '../src/config.js';
import * as discord from '../src/discord.js';

const c = config;
const collabs = c.COLLABORATORS.map((x) => `@${x}`).join(' i ');
const ch = (key) => `<#${c.CHANNEL_IDS[key]}>`;

const MESSAGES = [
  `# 📘 Bot iSelect Social – instrukcja
Bot co tydzień zamienia jeden telefon w **gotowy pakiet treści na Instagram** (@${c.IG_USERNAME}): rolki, karuzele i relacje w naszym stylu.
Ty dajesz zdjęcia i dane → bot tworzy → Ty akceptujesz → bot publikuje o **${c.PUBLISH_HOUR}:00**.
Działa w chmurze – **laptop nie musi być włączony**.

**Kanały**
• ${ch('intake')} – tu wysyłasz telefon i komendy, tu przychodzą linki do akceptacji
• ${ch('publish')} – o ${c.PUBLISH_HOUR}:00 rolki do wrzucenia z muzyką + potwierdzenia publikacji
• ${ch('log')} – techniczny (decyzje ze strony akceptacji), możesz wyciszyć`,

  `## 🗓️ Tydzień
**Niedziela ${c.REQUEST_HOUR}:00** – bot prosi o telefon na kolejny tydzień.
Publikacje o ${c.PUBLISH_HOUR}:00, co drugi dzień post/rolka, pomiędzy relacje:
• **Pon** – rolka „haczyk + decyzja” (📲 Ty + muzyka)
• **Wt** – relacja (🤖 bot)
• **Śr** – karuzela ofertowa „NA SPRZEDAŻ” (🤖 bot)
• **Czw** – relacja (🤖 bot)
• **Pt** – rolka z innym kątem: POV / porównanie / flip loading (📲 Ty + muzyka)
• **Sob** – relacja (🤖 bot)
• **Nd** – karuzela „do zapisania” – porady, ZA i PRZECIW (🤖 bot)
Karuzele i rolki są **współtworzone z ${collabs}**.`,

  `## 📱 Jak wysłać telefon (${ch('intake')})
1. Wiadomość z danymi:
\`\`\`
Model:
Pamięć:
Kolor:
Bateria:
Stan / wady:
Cena:
Zestaw:
Dodatkowo:
\`\`\`
2. Zdjęcia – **do ${c.MAX_PHOTOS}**, po 10 w wiadomości (limit Discorda). Kolejność dowolna, możesz na raty.
3. Na końcu napisz **\`gotowe\`** – dopiero wtedy bot zaczyna (bez tego po 30 min przypomni).
4. Po ok. 10–20 min dostajesz **link do strony akceptacji**.

**Dobre zdjęcia = lepsze wyniki:** przód, tył, boki, ekran z kondycją baterii, każda wada z bliska, telefon z pudełkiem i zestawem. Jasne, równe tło, bez bałaganu w kadrze.

Nowy telefon możesz wysłać **w każdy dzień** – bot podmieni kolejne dni tygodnia.`,

  `## 💬 Jak rozmawiać z botem (${ch('intake')})
**Pisz normalnie** – bot rozumie zwykłe zdania, np.:
• „w tym tygodniu treści ogólne” → newsy, porady, rankingi o iPhone’ach z aktualnych źródeł, bez konkretnego telefonu
• „telefon dalej się nie sprzedał, zrób nowe materiały o nim” (można dodać nową cenę)
• „sprzedany” → wstrzymuje materiały o telefonie, relacja „SPRZEDANE” + treści ogólne na resztę tygodnia
• „to wygląda słabo, zrób bardziej…” → bot przerabia materiały tego tygodnia wg uwag
• „nigdy nie używaj…”, „zawsze dodawaj…” → bot **zapamiętuje to na kolejne tygodnie**
Krótkie komendy też działają: \`gotowe\` · \`ogólne\` · \`sprzedany\` · \`status\` · \`pomoc\`
Brak odpowiedzi do **poniedziałku ${c.GENERAL_FALLBACK_HOUR}:00** = bot sam przygotuje treści ogólne.`,

  `## ✅ Akceptacja (strona z linku)
• Działa na telefonie: przewijasz karuzele, oglądasz rolki, czytasz opisy.
• **Opis możesz poprawić od razu** w polu tekstowym – bot opublikuje Twoją wersję.
• **Akceptuj** – materiał wyjdzie w swoim dniu o ${c.PUBLISH_HOUR}:00.
• **Popraw…** – wpisz, co zmienić (np. „mocniejszy hook”, „inne zdjęcie na okładce”, „krócej”) → bot zrobi nową wersję i przyśle link.
• **Akceptuj wszystkie** – na dole strony.
Decyzja trafia do bota w ciągu ~10 min.`,

  `## 🎬 Rolki o ${c.PUBLISH_HOUR}:00 (${ch('publish')})
Instagram nie pozwala botom dodawać muzyki z biblioteki IG, a trendujące dźwięki dają największy zasięg – dlatego rolki wrzucasz Ty (ok. 1 min):
1. Pobierz wideo i okładkę z wiadomości bota.
2. Instagram → ➕ → **Reel** → wybierz wideo.
3. 🎵 **Audio** → zakładka **Trending** (strzałka ↗) – bot podpowie klimat i tempo.
4. Wklej opis z następnej wiadomości bota (przytrzymaj → Kopiuj).
5. **Tag people → Invite collaborators**: ${collabs}.
6. **Edit cover → Add from camera roll** → cover.jpg → **Share**.`,

  `## 📏 Zasady bota
1. **Nic nie wychodzi bez akceptacji.** Niezaakceptowany materiał nie zostanie opublikowany – o ${c.PUBLISH_HOUR}:00 dostaniesz przypomnienie, a po akceptacji wyjdzie tego samego wieczoru (do ${c.PUBLISH_UNTIL_HOUR}:59) albo następnego dnia.
2. **Maks. 1 post/rolka i 1 relacja dziennie** – zaległe materiały wychodzą w kolejne dni.
3. **Uczciwość:** wady opisujemy konkretnie i pokazujemy na zdjęciach. Bot nie wymyśla parametrów ani stanu – bierze tylko to, co podasz.
4. **Nie wspominamy o gwarancji.** Zawsze: ${c.CITY}, odbiór osobisty lub wysyłka, przyjmujemy telefony w rozliczeniu.
5. **Współtwórcy** muszą zaakceptować zaproszenie w aplikacji Instagram po każdej publikacji. Jeśli Instagram kogoś odrzuci, bot opublikuje bez niego i da znać.
6. **Bot się uczy:** w niedzielę wysyła podsumowanie tygodnia (wyświetlenia, komentarze, zapisy) i bierze pod uwagę, co działało najlepiej. Pamięta też ostatnie tematy, żeby się nie powtarzać.
7. **Źródła treści ogólnych:** newsy (iMagazine, Spider’s Web, Antyweb, Google News, MacRumors, 9to5Mac) + wyszukiwarka. Zdjęcia i filmy tylko z legalnych źródeł (Pexels, wolne licencje) lub nasze – nigdy cudze zdjęcia z Instagrama/TikToka (prawa autorskie, ryzyko blokady konta).
8. **Koszt: 0 zł** – darmowe Gemini, GitHub i Instagram API.`,

  `## 🛠️ Gdy coś nie działa
• Bot nie reaguje 👀 – przebiegi są co ~10 min, czasem GitHub opóźnia je do kilkudziesięciu minut. Poczekaj chwilę.
• Strona akceptacji pokazuje błąd – odśwież za minutę (strona się wdraża).
• Komunikat ❌ od bota – skopiuj go i wklej Claude’owi (rozmowa, w której powstał bot) – naprawi.
• Zmiana godzin, planu tygodnia, stylu tekstów – edycja \`config.json\` i \`src/brand.js\` w folderze bota, potem \`.\\setup.ps1 -Code\`.`,
];

const me = await discord.me();
const [guild] = await discord.myGuilds();
const channels = await discord.guildChannels(guild.id);
let channel = channels.find((x) => x.type === 0 && x.name === 'instrukcje');
if (!channel) {
  channel = await discord.createChannel(guild.id, 'instrukcje', 'Jak działa bot iSelect Social – zasady i instrukcja.');
  console.log('Utworzyłem #instrukcje');
}
// usuń poprzednią wersję instrukcji (tylko wiadomości tego bota)
const old = (await discord.readMessages(channel.id)).filter((m) => m.author?.id === me.id);
for (const m of old) await discord.deleteMessage(channel.id, m.id);
for (const content of MESSAGES) {
  if (content.length > 2000) throw new Error(`Wiadomość za długa (${content.length})`);
  await discord.send(channel.id, { content });
}
console.log(`Opublikowano ${MESSAGES.length} wiadomości na #instrukcje (usunięto starych: ${old.length})`);
