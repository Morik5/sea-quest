# SeaQuest: Vzdělávací Aplikace 🚀

## Link na aplikaci
https://sea-quest.web.app/
## O Projektu

SeaQuest je vzdělávací aplikace, která propojuje učitele, žáky a rodiče. Nabízí interaktivní výukové nástroje a online testování. Aplikace umožňuje vytváření virtuálních tříd, spravovat úkoly a sledování pokroku studentů.

## Technické Informace

Aplikace je postavená na:
- [Qwik](https://qwik.dev/) s [QwikCity](https://qwik.dev/qwikcity/overview/) pro frontend
- Firebase pro backend (autentizace a databáze)
- CSS pro styling

## Struktura Projektu
```
├── public/ # Statické soubory (obrázky, ikony) 
├── src/ 
    │ ├── components/ # Znovupoužitelné komponenty 
    │ ├── routes/ # Stránky jako takové a routování 
    │ ├── utils/ # Pomocné funkce a nástroje
    │ ├── services/ # Služby pro práci s API
    │ └── styles/ # Globální styly
```

## Funkce

- **Správa uživatelů** - registrace, přihlašování, role (učitel, žák, rodič)
- **Třídy** - vytváření a správa online tříd
- **Testování** - tvorba online testů s automatickým doporučeným hodnocením
- **Oznámení** - oznámení s komentáři
- **Úkoly** - zadávání, odevzdávání a hodnocení úkolů
- **Statistiky** (pro rodiče) - přehledy a reporty o výsledcích žáků

## Aktuální stav a plánované úpravy

Ačkoliv je aplikace funkční a již otestováná ve škole, tak ještě zdaleka není hotová a plánuji pokračovat v jejím rozvoji.
**TODO:**
- **Duplicitní kód** - V projektu se vyskytuje hodně duplicit, které jsou potřeba eliminovat
- **CSS optimalizace** - Dát do pořádku CSS styly, mnoho se jich překrývá/mají podobné názvy => aplikace nefunguje jak má
- **Refaktoring komponent** - Některé komponenty by mohly být lépe strukturované pro opětovné používání
- **Komentáře** - Kód je nutné lépe okomentovat, spíše vůbec nějak okomentovat


## Poznámka k cvičení Letter Hunt

Cvičení Letter Hunt jsem naprogramoval sám jako součást své aplikace na výuku angličtiny. Hra Wordle mi sloužila pouze jako inspirace z hlediska základního principu hádání slova po písmenech. Původně jsem měl v plánu úplně jinou podobu – například čtyřpísmenná slova, bublinové rozhraní nebo vizuální nápovědy pomocí obrázků. Postupně jsem ale koncept zjednodušil a upravil tak, aby zapadl do celkového designu a tématu aplikace. Výsledkem je tedy vlastní varianta inspirovaná, ale nikoli kopírující Wordle.

