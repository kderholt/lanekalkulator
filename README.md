# Lånekalkulator

En avansert norsk lånekalkulator for boligkjøp med støtte for to låntakere.

## Funksjoner

- **To beregningsmåter**: Finn boligpris fra ønsket månedsbeløp eller finn månedsbeløp fra boligpris
- **Lånetype**: Annuitetslån og serielån
- **To låntakere**: Individuelle egenkapitalinnskudd og eierandeler
- **Kostnadsberegning**: Inkluderer kommunale avgifter, boligforsikring, felleskostnader og utleieinntekt
- **Visualisering**: Grafer for lånebalanse over tid og månedlig betalingsfordeling
- **Responsiv design**: Fungerer på desktop og mobil

## Teknologi

- React 19
- Chart.js for visualisering
- TailwindCSS for styling
- Create React App

## Utvikling

### Installasjon
```bash
npm install
```

### Start utviklingsserver
```bash
npm start
```
Åpner [http://localhost:3000](http://localhost:3000) i nettleseren.

### Bygg for produksjon
```bash
npm run build
```

## Deployment

Applikasjonen er konfigurert for deployment til `https://lanekalkulator.kjetil.ro`.

### Bygg for produksjon
```bash
npm run build
```

Deploy `build/` mappen til din web server eller hosting provider.

