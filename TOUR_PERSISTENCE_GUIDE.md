# Guida alla Persistenza dei Tour

## Come Funziona il Sistema di Salvataggio

L'applicazione Sonic Walkscape utilizza un sistema **ibrido a due livelli** per salvare i tuoi tour:

### 📦 Livello 1: LocalStorage (Bozze Locali)
- **Dove**: Salvato nel browser locale
- **Quando**: Automaticamente ad ogni modifica
- **Visibilità**: Solo sul tuo dispositivo/browser
- **Durata**: Fino a quando non cancelli i dati del browser
- **Uso**: Per tour in lavorazione (bozze)

### ☁️ Livello 2: S3 Cloud (Tour Pubblicati)
- **Dove**: Salvato su Amazon S3
- **Quando**: Quando spunti "Tour Pubblicato"
- **Visibilità**: Disponibile su **tutti i dispositivi** per **tutti gli utenti**
- **Durata**: Permanente (fino a eliminazione manuale)
- **Uso**: Per tour finiti e pronti per la condivisione

## 🔄 Flusso Completo: Dalla Creazione alla Pubblicazione

### 1️⃣ Creazione Tour (Bozza Locale)

```
Apri CMS → Crea Nuovo Tour
    ↓
Tour salvato in localStorage
    ↓
✅ Tour visibile SOLO sul tuo browser
```

**Console Log:**
```
📦 Loaded 1 tours from localStorage
```

### 2️⃣ Modifica e Aggiunta Contenuti

```
Aggiungi Regioni → Upload Audio → Genera Sottotitoli
    ↓
Ogni modifica salva automaticamente in localStorage
    ↓
✅ Tour aggiornato localmente
```

**Avvisi:**
- ⚠️ Se cancelli i dati del browser, perdi le bozze non pubblicate
- ⚠️ Se cambi browser/dispositivo, non vedrai le bozze

### 3️⃣ Pubblicazione su S3 (Condivisione Globale)

```
Spunta "📢 Tour Pubblicato"
    ↓
Sistema invia tour a S3
    ↓
Aggiorna index.json su S3
    ↓
✅ Tour disponibile a tutti!
```

**Alert di Successo:**
```
✅ Tour published successfully! It is now available to all users.
```

**Console Log:**
```
📤 Publishing tour to S3: My Tour Title
✅ Tour published to S3: https://...manifest.json
```

### 4️⃣ Caricamento CMS (Su Altri Dispositivi)

```
Apri CMS su nuovo dispositivo
    ↓
Sistema carica:
  1. Tour da localStorage (bozze locali)
  2. Tour da S3 (pubblicati)
    ↓
Merge dei due set (evita duplicati)
    ↓
✅ Tutti i tour disponibili!
```

**Console Log:**
```
📦 Loaded 2 tours from localStorage
🌐 Loading published tours from S3...
✅ Loaded 3 tours from S3
📚 Total tours available: 4 (2 local + 2 from S3)
```

## 📊 Tabella Comparativa

| Caratteristica | localStorage | S3 Cloud |
|----------------|--------------|----------|
| **Persistenza** | Temporanea (fino a clear cache) | Permanente |
| **Dispositivi** | Solo corrente | Tutti |
| **Utenti** | Solo tu | Tutti |
| **Velocità** | Istantanea | 2-5 secondi |
| **Limite** | ~5-10MB | 50MB per file |
| **Backup** | ❌ No | ✅ Sì |
| **Condivisione** | ❌ No | ✅ Sì |

## 🎯 Scenari d'Uso

### Scenario 1: Lavoro su Singolo Dispositivo
```
1. Crei tour sul tuo computer → salvato in localStorage
2. Modifichi tour più volte → salvato in localStorage
3. Quando finito → spunti "Pubblicato"
4. Tour caricato su S3 → disponibile ovunque
```

### Scenario 2: Lavoro su Più Dispositivi
```
Dispositivo A (Computer):
  - Crei tour → localStorage
  - Pubblichi → S3

Dispositivo B (Tablet):
  - Apri CMS → carica da S3
  - Modifichi → salva in localStorage locale
  - Pubblichi → aggiorna S3

Dispositivo A:
  - Riapri CMS → carica versione aggiornata da S3
```

### Scenario 3: Cancellazione Dati Browser
```
PRIMA:
  localStorage: 3 tour (1 pubblicato + 2 bozze)
  S3: 1 tour (quello pubblicato)

[Cancelli dati browser]

DOPO:
  localStorage: vuoto
  CMS ricarica:
    - localStorage: 0 tour
    - S3: 1 tour (quello pubblicato)
    - Totale: 1 tour ✅

⚠️ Le 2 bozze non pubblicate sono PERSE!
```

## 💡 Best Practices

### ✅ Cosa FARE:

1. **Pubblica Regolarmente**
   - Pubblica i tour importanti appena completi
   - Usa "Pubblicato" come backup cloud

2. **Tour di Test**
   - Tieni tour di test NON pubblicati
   - Cancellali quando non servono più

3. **Nomi Univoci**
   - Usa slug unici per ogni tour
   - Esempio: `roma-centro-2024` invece di `tour-1`

4. **Backup Locale**
   - Prima di cancellare dati browser, pubblica tutti i tour
   - Oppure esporta i tour (feature futura)

### ❌ Cosa NON FARE:

1. **Non Fare Solo Bozze**
   - Se un tour è importante, pubblicalo!
   - localStorage non è affidabile a lungo termine

2. **Non Duplicare Tour**
   - Evita di creare copie dello stesso tour
   - Usa lo stesso slug per aggiornamenti

3. **Non Pubblicare Tour Incompleti**
   - Controlla che abbiano audio e regioni
   - Tour pubblicati sono visibili a tutti

## 🔍 Debug: Controllare Cosa è Salvato

### Nel Browser (Console)

```javascript
// Controlla localStorage
const tours = localStorage.getItem('WS_CMS_TOURS');
console.log(JSON.parse(tours));

// Controlla quanti tour hai
const parsedTours = JSON.parse(tours);
console.log(`Tour locali: ${parsedTours.length}`);

// Controlla quali sono pubblicati
parsedTours.forEach(t => {
  console.log(`${t.title}: ${t.published ? 'PUBBLICATO' : 'BOZZA'}`);
});
```

### Controllo S3

1. Vai su AWS S3 Console
2. Apri bucket: `gigiorda-walkspace`
3. Naviga a: `walkspace/tours/`
4. Dovresti vedere:
   - `index.json` (lista tour)
   - Cartelle per ogni tour pubblicato

## 🚨 Problemi Comuni e Soluzioni

### Problema: "Non trovo il tour che ho creato"

**Causa**: Tour salvato solo in localStorage, poi browser cancellato o cambiato

**Soluzione**:
1. Controlla se il tour era pubblicato (spunta verde)
2. Se NO → tour perso (era solo locale)
3. Se SÌ → controlla S3, dovrebbe essere lì
4. Ricarica la pagina → sistema lo recupera da S3

**Prevenzione**: Pubblica i tour importanti subito!

---

### Problema: "Vedo tour duplicati"

**Causa**: Stesso tour in localStorage E S3 con slug diversi

**Soluzione**:
1. Elimina la copia locale (quella in bozza)
2. Mantieni solo quella pubblicata
3. Sistema usa slug per evitare duplicati

**Prevenzione**: Usa slug coerenti e unici

---

### Problema: "Il demo tour appare sempre"

**Causa**: Nessun tour trovato né in localStorage né in S3

**Soluzione**:
1. Questo è normale al primo avvio
2. Elimina il demo tour se non serve
3. Crea i tuoi tour e pubblicali
4. Al prossimo caricamento, caricherà i tuoi

**Prevenzione**: Pubblica almeno un tour

---

### Problema: "Tour pubblicato ma non appare nel Player"

**Causa**: Player carica solo tour con `published: true`

**Soluzione**:
1. Apri CMS
2. Controlla che la spunta "📢 Tour Pubblicato" sia attiva
3. Salva nuovamente
4. Ricarica Player

---

### Problema: "Errore durante il caricamento da S3"

**Causa**: Permessi S3 non configurati correttamente

**Soluzione**:
1. Segui `AWS_IAM_SETUP_GUIDE.md`
2. Aggiungi permesso `s3:ListBucket`
3. Rideploy su Vercel
4. Ricarica CMS

## 📱 Utilizzo Mobile

### Su Smartphone/Tablet:

1. **Creazione**: Funziona, ma consigliato da desktop
2. **Pubblicazione**: Funziona perfettamente
3. **Modifica**: Possibile ma limitata da schermo piccolo
4. **Player**: **Ottimizzato per mobile**!

### Workflow Consigliato:

```
Desktop/Laptop:
  → Crea e modifica tour nel CMS
  → Carica audio e sottotitoli
  → Pubblica su S3

Mobile:
  → Usa Player per testare GPS
  → Visualizza tour pubblicati
  → Feedback e correzioni

Desktop:
  → Modifica in base a feedback
  → Ripubblica
```

## 🎓 Riepilogo

**Ricorda:**
- ✅ localStorage = Bozze temporanee locali
- ✅ S3 = Tour pubblicati permanenti globali
- ✅ Spunta "Pubblicato" = Salva su S3
- ✅ CMS carica da ENTRAMBE le fonti
- ✅ Player carica solo da S3 (tour pubblicati)

**Per non perdere mai un tour:**
1. Lavora sulla bozza locale
2. Quando finito → Pubblica
3. Tour salvato su S3 ✅
4. Disponibile sempre e ovunque ✅

## 📞 Supporto

Se hai problemi:
1. Controlla console browser (F12)
2. Cerca messaggi di errore
3. Verifica permessi S3
4. Consulta `DEPLOYMENT_GUIDE.md`
