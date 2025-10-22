# Fix: S3 CORS Error During Audio Upload

## Problema

Quando carichi file audio nel CMS, vedi questo errore:

```
Access to fetch at 'https://gigiorda-walkspace.s3.eu-north-1.amazonaws.com/...'
from origin 'https://sonic-walkscape-full-s3-...vercel.app'
has been blocked by CORS policy: Response to preflight request doesn't pass
access control check: No 'Access-Control-Allow-Origin' header is present
on the requested resource.
```

## Causa

Il bucket S3 `gigiorda-walkspace` non ha configurato le regole CORS per permettere upload da domini esterni (come Vercel).

## Soluzione: Configurare CORS su S3

### Metodo 1: AWS Console (Più Semplice) ✅

#### Passo 1: Apri AWS S3 Console

1. Vai su: https://s3.console.aws.amazon.com/s3/buckets
2. Accedi con le tue credenziali AWS
3. Clicca sul bucket: **gigiorda-walkspace**

#### Passo 2: Vai alle Impostazioni CORS

1. Nella pagina del bucket, clicca sulla tab **Permissions** (Permessi)
2. Scorri fino alla sezione **Cross-origin resource sharing (CORS)**
3. Clicca sul pulsante **Edit** (Modifica)

#### Passo 3: Incolla la Configurazione CORS

Cancella tutto il contenuto esistente (se presente) e incolla questo JSON:

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "PUT",
            "POST",
            "DELETE",
            "HEAD"
        ],
        "AllowedOrigins": [
            "https://sonic-walkscape-full-s3-mfbb829tf-gigiordas-projects.vercel.app",
            "https://sonic-walkscape-full-s3-*.vercel.app",
            "http://localhost:3000"
        ],
        "ExposeHeaders": [
            "ETag",
            "x-amz-server-side-encryption",
            "x-amz-request-id",
            "x-amz-id-2"
        ],
        "MaxAgeSeconds": 3600
    }
]
```

**Nota:** Questo permette:
- Tutte le richieste dalla tua app Vercel
- Richieste da localhost (per sviluppo)
- Upload con tutti i metodi HTTP necessari

#### Passo 4: Salva

1. Clicca sul pulsante **Save changes** (Salva modifiche)
2. Attendi qualche secondo per la propagazione
3. Riprova l'upload nel CMS!

---

### Metodo 2: AWS CLI (Per Esperti)

#### Passo 1: Crea File CORS

Crea un file chiamato `cors.json` con questo contenuto:

```json
{
    "CORSRules": [
        {
            "AllowedHeaders": ["*"],
            "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
            "AllowedOrigins": [
                "https://sonic-walkscape-full-s3-mfbb829tf-gigiordas-projects.vercel.app",
                "https://sonic-walkscape-full-s3-*.vercel.app",
                "http://localhost:3000"
            ],
            "ExposeHeaders": [
                "ETag",
                "x-amz-server-side-encryption",
                "x-amz-request-id",
                "x-amz-id-2"
            ],
            "MaxAgeSeconds": 3600
        }
    ]
}
```

#### Passo 2: Applica la Configurazione

```bash
aws s3api put-bucket-cors \
  --bucket gigiorda-walkspace \
  --cors-configuration file://cors.json \
  --region eu-north-1
```

#### Passo 3: Verifica

```bash
aws s3api get-bucket-cors \
  --bucket gigiorda-walkspace \
  --region eu-north-1
```

Dovresti vedere la configurazione CORS applicata.

---

## Spiegazione della Configurazione

### AllowedOrigins (Domini Permessi)

```json
"AllowedOrigins": [
    "https://sonic-walkscape-full-s3-mfbb829tf-gigiordas-projects.vercel.app",  // Produzione
    "https://sonic-walkscape-full-s3-*.vercel.app",  // Tutte le preview di Vercel
    "http://localhost:3000"  // Sviluppo locale
]
```

- Prima URL: La tua app in produzione
- Seconda URL con `*`: Tutte le preview deployments di Vercel
- Terza URL: Per testare in locale

### AllowedMethods (Metodi HTTP)

```json
"AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"]
```

- **GET**: Scaricare file (audio, manifest)
- **PUT**: Caricare file (audio upload)
- **POST**: Operazioni speciali
- **DELETE**: Eliminare file
- **HEAD**: Controllare esistenza file

### AllowedHeaders

```json
"AllowedHeaders": ["*"]
```

Permette tutti gli headers HTTP nelle richieste. Necessario per:
- `Content-Type` (tipo file)
- `Authorization` (se usato)
- Headers custom

### ExposeHeaders

```json
"ExposeHeaders": [
    "ETag",
    "x-amz-server-side-encryption",
    "x-amz-request-id",
    "x-amz-id-2"
]
```

Headers S3 che l'app può leggere nella risposta. Utile per:
- `ETag`: Verificare integrità upload
- Headers `x-amz-*`: Debug e logging

### MaxAgeSeconds

```json
"MaxAgeSeconds": 3600
```

Cache della risposta CORS per 1 ora (3600 secondi). Riduce richieste preflight.

---

## Verifica che Funzioni

### Test 1: Console Browser

1. Apri CMS: https://sonic-walkscape-full-s3-mfbb829tf-gigiordas-projects.vercel.app/cms
2. Apri DevTools (F12) → Tab **Network**
3. Seleziona un tour e prova a caricare un MP3
4. Cerca richiesta `OPTIONS` (preflight)
5. **Dovrebbe avere status 200 OK**
6. Controlla headers risposta:
   ```
   access-control-allow-origin: https://sonic-walkscape-full-s3-...
   access-control-allow-methods: GET, PUT, POST, DELETE, HEAD
   ```

### Test 2: Upload Reale

1. Carica un file MP3 (anche grande, fino a 50MB)
2. **Prima** vedevi errore CORS
3. **Dopo** dovresti vedere:
   ```
   📤 Uploading audio to S3: file.mp3 (31.18MB)
   ✅ Audio uploaded successfully to S3: https://...
   ✅ Audio caricato con successo!
   ```

---

## Problemi Comuni Dopo Configurazione

### Problema: "Ancora errore CORS dopo aver salvato"

**Causa**: Cache browser o propagazione S3 non completata

**Soluzione**:
1. Aspetta 1-2 minuti
2. Fai hard refresh (Ctrl+Shift+R o Cmd+Shift+R)
3. Prova in finestra incognito
4. Verifica che hai salvato correttamente nella console S3

---

### Problema: "Funziona in localhost ma non su Vercel"

**Causa**: AllowedOrigins non include il dominio Vercel

**Soluzione**:
1. Controlla che la configurazione CORS includa:
   ```json
   "https://sonic-walkscape-full-s3-*.vercel.app"
   ```
2. Il wildcard `*` permette tutte le preview deployments
3. Se hai un dominio custom, aggiungilo alla lista

---

### Problema: "Funziona per file piccoli ma non grandi (>10MB)"

**Causa**: Timeout o limite dimensione non configurato

**Soluzione**:
1. CORS è OK, problema è altro
2. Controlla timeout Vercel (dovrebbe essere 60s)
3. Controlla connessione internet
4. Verifica che il file sia valido MP3

---

## Sicurezza: AllowedOrigins Specifici

### Configurazione Produzione (Più Sicura)

Se vuoi limitare l'accesso SOLO al tuo dominio di produzione:

```json
"AllowedOrigins": [
    "https://tuodominio.com",  // Solo il tuo dominio
    "http://localhost:3000"     // Solo per sviluppo
]
```

### Configurazione Sviluppo (Più Permissiva)

Per permettere tutti i deployments Vercel durante sviluppo:

```json
"AllowedOrigins": [
    "https://*.vercel.app",     // Tutti i sottodomini Vercel
    "http://localhost:3000",    // Sviluppo locale
    "http://localhost:3001"     // Porta alternativa
]
```

**⚠️ NON usare `"*"` (tutti i domini)** - è un rischio di sicurezza!

---

## Alternative: Proxy Request

Se per qualche motivo non puoi modificare CORS su S3, puoi usare un proxy:

### Opzione: API Route Proxy (Non Raccomandato)

Invece di upload diretto a S3, passa tramite API Vercel:

```typescript
// app/api/upload/proxy/route.ts
export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get('file');

  // Upload a S3 server-side (no CORS)
  // ...
}
```

**Svantaggi:**
- ❌ File passa due volte (browser → Vercel → S3)
- ❌ Consuma bandwidth Vercel
- ❌ Più lento
- ❌ Limite dimensione Vercel (4.5MB default)

**Meglio configurare CORS!** ✅

---

## Riepilogo Veloce

### Quick Fix (2 Minuti)

```bash
1. AWS Console → S3 → gigiorda-walkspace
2. Permissions → CORS → Edit
3. Incolla JSON (vedi sopra)
4. Save
5. Aspetta 30 secondi
6. Riprova upload
```

### Verifica Rapida

```bash
# Controlla CORS attuale
aws s3api get-bucket-cors \
  --bucket gigiorda-walkspace \
  --region eu-north-1
```

### File da Scaricare

- JSON CORS pronto: Vedi sezione "Metodo 1" sopra
- Copia-incolla direttamente nella console S3

---

## Supporto

Se continui ad avere problemi:

1. **Controlla Console Logs**:
   - Apri DevTools (F12)
   - Tab Console
   - Cerca errori dettagliati

2. **Controlla Network Tab**:
   - Tab Network
   - Filtra per `s3.eu-north-1.amazonaws.com`
   - Guarda richiesta OPTIONS (preflight)
   - Controlla headers risposta

3. **Verifica Configurazione S3**:
   - Console AWS S3
   - Bucket → Permissions → CORS
   - Deve essere identica al JSON sopra

4. **Test Manuale**:
   ```bash
   curl -X OPTIONS \
     -H "Origin: https://sonic-walkscape-full-s3-mfbb829tf-gigiordas-projects.vercel.app" \
     -H "Access-Control-Request-Method: PUT" \
     https://gigiorda-walkspace.s3.eu-north-1.amazonaws.com/test
   ```
   Dovrebbe rispondere con headers CORS.

---

## Prossimi Passi

Una volta configurato CORS:

1. ✅ Upload audio funzionerà senza errori
2. ✅ File fino a 50MB caricabili
3. ✅ Da tutti i dispositivi (via web)
4. ✅ Sia in produzione che in sviluppo

**Buon upload!** 🎵
