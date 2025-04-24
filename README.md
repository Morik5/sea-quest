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

## Instalace a spuštění

```
git clone https://github.com/Morik5/sea-quest.git
cd sea-quest
```
npm install
```
npm start
```
--------------
```
npm run build
```

## Cloudflare Pages

Cloudflare's [wrangler](https://github.com/cloudflare/wrangler) CLI can be used to preview a production build locally. To start a local server, run:

```
npm run serve
```

Then visit [http://localhost:8787/](http://localhost:8787/)

### Deployments

[Cloudflare Pages](https://pages.cloudflare.com/) are deployable through their [Git provider integrations](https://developers.cloudflare.com/pages/platform/git-integration/).

If you don't already have an account, then [create a Cloudflare account here](https://dash.cloudflare.com/sign-up/pages). Next go to your dashboard and follow the [Cloudflare Pages deployment guide](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/).

Within the projects "Settings" for "Build and deployments", the "Build command" should be `npm run build`, and the "Build output directory" should be set to `dist`.

### Function Invocation Routes

Cloudflare Page's [function-invocation-routes config](https://developers.cloudflare.com/pages/platform/functions/routing/#functions-invocation-routes) can be used to include, or exclude, certain paths to be used by the worker functions. Having a `_routes.json` file gives developers more granular control over when your Function is invoked.
This is useful to determine if a page response should be Server-Side Rendered (SSR) or if the response should use a static-site generated (SSG) `index.html` file.

By default, the Cloudflare pages adaptor _does not_ include a `public/_routes.json` config, but rather it is auto-generated from the build by the Cloudflare adaptor. An example of an auto-generate `dist/_routes.json` would be:

```
{
  "include": [
    "/*"
  ],
  "exclude": [
    "/_headers",
    "/_redirects",
    "/build/*",
    "/favicon.ico",
    "/manifest.json",
    "/service-worker.js",
    "/about"
  ],
  "version": 1
}
```

In the above example, it's saying _all_ pages should be SSR'd. However, the root static files such as `/favicon.ico` and any static assets in `/build/*` should be excluded from the Functions, and instead treated as a static file.

In most cases the generated `dist/_routes.json` file is ideal. However, if you need more granular control over each path, you can instead provide you're own `public/_routes.json` file. When the project provides its own `public/_routes.json` file, then the Cloudflare adaptor will not auto-generate the routes config and instead use the committed one within the `public` directory.
