# iSelect Social Bot

Bot, który co tydzień zbiera od Ciebie dane i zdjęcia telefonu na Discordzie, tworzy rolki, karuzele i relacje w stylu @iselect_hub,
wysyła je do akceptacji na stronie i publikuje na Instagramie o 21:00 jako **współtworzone z @szymon_igg i @majster_wihajsters**.
Działa w chmurze (GitHub Actions), **laptop nie musi być włączony**. Koszt: **0 zł**.

## Jak wygląda tydzień

| Dzień (21:00) | Co | Kto publikuje |
|---|---|---|
| Poniedziałek | Rolka „haczyk + decyzja” (format Twojej najlepszej rolki) | 📲 Ty – bot przysyła gotowe wideo, opis i podpowiedź muzyki |
| Wtorek | Relacja | 🤖 bot |
| Środa | Karuzela ofertowa „NA SPRZEDAŻ” | 🤖 bot (współtworzona) |
| Czwartek | Relacja | 🤖 bot |
| Piątek | Rolka z innym kątem (POV / porównanie / „flip loading”) | 📲 Ty + muzyka |
| Sobota | Relacja | 🤖 bot |
| Niedziela | Karuzela „do zapisania” (porady / ZA i PRZECIW) | 🤖 bot (współtworzona) |

1. **Niedziela 10:00** – bot pisze na **#social-zgłoszenia**: prosi o model, pamięć, kolor, baterię, stan, cenę, zestaw + zdjęcia (do 40).
2. Wysyłasz dane i zdjęcia w ilu chcesz wiadomościach (Discord: max 10 zdjęć w jednej), na końcu piszesz **`gotowe`**.
   Po ~10–20 min dostajesz **link do strony akceptacji**. Bez „gotowe” bot czeka (po 30 min przypomni).
3. Na stronie (działa na telefonie): oglądasz rolki i karuzele, możesz poprawić opis, klikasz **Akceptuj** albo **Popraw…** i wpisujesz uwagi
   → bot robi nową wersję i przysyła link. Niezaakceptowane materiały **nigdy** nie są publikowane.
4. **O 21:00** bot publikuje karuzele i relacje. W dni rolek dostajesz na **#social-publikacje** wideo, okładkę, opis do skopiowania
   i podpowiedź, jakiego trendującego dźwięku szukać – publikacja zajmuje ok. minuty.

Komendy na #social-zgłoszenia:

| Komenda | Działanie |
|---|---|
| `dalej` / `dalej 999` | zeszły telefon nadal dostępny (opcjonalnie nowa cena) – nowe hooki i kąty |
| `ogólne` | w tym tygodniu bez telefonu – treści o iPhone'ach na podstawie aktualnych informacji z internetu |
| `sprzedany` | wstrzymuje materiały o tym telefonie, robi relację „SPRZEDANE” i treści ogólne na resztę tygodnia |
| `status` | plan publikacji i statusy |
| `gotowe` | wysłałem już wszystkie dane i zdjęcia – zaczynaj |

Brak odpowiedzi do poniedziałku 12:00 = bot sam przygotuje treści ogólne. Nowy telefon możesz wysłać **w dowolnym dniu** – bot podmieni kolejne dni tygodnia.

## Dlaczego rolki publikujesz Ty

Oficjalne API Instagrama **nie pozwala dodać muzyki z biblioteki Instagrama** (trendujących dźwięków), a to one najmocniej podbijają zasięg rolek.
Narzędzia, które „klikają” w Instagram za człowieka, łamią regulamin i grożą blokadą konta – nie używamy ich.
Dlatego rolki przychodzą do Ciebie gotowe, a Ty tylko dodajesz dźwięk i współtwórców (ok. 60 sekund).

## Konfiguracja krok po kroku (jednorazowo, ok. 20 min)

Potrzebujesz Node.js (masz) i 4 kluczy. Uruchom w tym folderze:

```powershell
.\setup.ps1          # otwiera plik .env w Notatniku
```

### 1. Discord – token bota
1. <https://discord.com/developers/applications> → **New Application** → nazwa np. „iSelect Social”.
2. Zakładka **Bot** → **Reset Token** → skopiuj do `DISCORD_BOT_TOKEN`.
3. Na tej samej stronie włącz **Message Content Intent** → Save.
4. Zakładka **OAuth2 → URL Generator**: zaznacz `bot`, a w uprawnieniach: View Channels, Send Messages, Attach Files, Embed Links,
   Read Message History, Add Reactions, Manage Channels, Manage Webhooks → otwórz wygenerowany link → dodaj bota do serwera z botem OLX.

Kanały **#social-zgłoszenia**, **#social-publikacje** i **#social-log** utworzy skrypt.

### 2. Instagram – token (konto @iselect_hub, bez strony na Facebooku)
1. <https://developers.facebook.com/apps> → **Utwórz aplikację** → przypadek użycia **„Zarządzaj wiadomościami i treściami na Instagramie”**.
2. W panelu aplikacji: **Instagram → Konfiguracja API z logowaniem przez Instagram** → **Wygeneruj tokeny dostępu** → **Dodaj konto** → zaloguj się na @iselect_hub i zatwierdź uprawnienia.
3. Skopiuj token do `IG_ACCESS_TOKEN`. Aplikacja może zostać w trybie deweloperskim – publikujesz tylko na własne konto.
4. Token jest ważny 60 dni, ale **bot sam go odświeża** co 3 tygodnie.

### 3. GitHub – token
<https://github.com/settings/tokens> → **Generate new token (classic)** → zaznacz **repo** i **workflow** → Expiration: *No expiration* → skopiuj do `GITHUB_TOKEN`.

### 4. Gemini
Możesz zostawić puste – skrypt użyje klucza z projektu `olx-iphone-hunter`.

### 5. (Opcjonalnie) Pexels
Darmowy klucz z <https://www.pexels.com/api/> → `PEXELS_API_KEY`. Daje legalne klipy wideo do rolek ogólnych.

### 6. Start
```powershell
.\setup.ps1 -Check   # sprawdza klucze, niczego nie zmienia
.\setup.ps1 -Apply   # tworzy kanały, repozytorium, sekrety, stronę akceptacji i uruchamia bota
```
Na #social-zgłoszenia pojawi się powitanie – możesz od razu wysłać pierwszy telefon.

## Współtworzenie – ważne
- Każdy współtwórca musi **zaakceptować zaproszenie** w aplikacji (powiadomienie po publikacji) – tak działa Instagram.
- Jeśli Instagram odrzuci któregoś współtwórcę, bot opublikuje post bez niego i napisze o tym na Discordzie.
- Problem z oznaczaniem @majster_wihajsters: na tym koncie sprawdź **Ustawienia → Prywatność → Tagi i wzmianki → „Zezwalaj na tagi od: wszystkich”**
  oraz czy @iselect_hub nie jest tam zablokowane lub ograniczone.

## Zmiany
- **Godziny, plan tygodnia, współtwórcy, numer telefonu w CTA** → `config.json` (np. `PUBLISH_HOUR`, `WEEK_PLAN`, `PHONE_NUMBER`), potem `.\setup.ps1 -Code`.
- **Styl pisania, zasady marketingu, wnioski ze statystyk** → `src/brand.js` (najważniejszy plik dla jakości treści), potem `.\setup.ps1 -Code`.
- **Wygląd grafik** → `remotion/` (podgląd lokalnie: `npm run demo`, potem `npm run preview`).
- Testy: `npm test` (logika + pełny tydzień na podstawionych usługach, ok. 2 min).

## Jak to działa technicznie
- `src/tick.js` – jeden przebieg (co ~10 min): zgłoszenia → decyzje ze strony → generowanie → publikacja → przypomnienia.
- `src/content.js` + `src/brand.js` – Gemini (darmowy) pisze hooki, sceny, slajdy i opisy; kod pilnuje formatu.
- `remotion/` – szablony rolek (1080×1920) i grafik (1080×1350 / 1080×1920) renderowane w chmurze.
- `web/` – strona akceptacji (GitHub Pages). Decyzje wracają przez webhook kanału #social-log; klucz jest tylko w części linku po `#`.
- Gałąź `data` – pamięć bota i media; nadpisywana bez historii, więc repozytorium nie rośnie.
- Repozytorium jest **publiczne** (dzięki temu Actions i strona są darmowe). Klucze są w zaszyfrowanych sekretach GitHuba, a publiczne są tylko
  kod i materiały, które i tak trafiają na Instagram.
- Remotion jest darmowy dla firm do 3 osób.

Lokalnie na Windowsie ścieżka do przeglądarki renderującej może przekroczyć limit 260 znaków. Wtedy ustaw `BROWSER_EXECUTABLE`
na krótszą ścieżkę (np. przez dowiązanie w `%TEMP%`). W chmurze ten problem nie występuje.
