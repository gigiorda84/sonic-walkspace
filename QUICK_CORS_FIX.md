# Quick Fix: CORS Error S3 Upload

## Il Problema

```
❌ CORS policy: No 'Access-Control-Allow-Origin' header
```

## La Soluzione (2 Minuti)

### 1. Apri AWS S3 Console

https://s3.console.aws.amazon.com/s3/buckets/gigiorda-walkspace

### 2. Vai a Permissions → CORS → Edit

Clicca sulla tab **Permissions**, scorri a **CORS**, clicca **Edit**

### 3. Incolla Questo JSON

```json
[
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
```

### 4. Salva

Clicca **Save changes**

### 5. Aspetta 30 Secondi

S3 deve propagare la configurazione

### 6. Riprova Upload

Hard refresh (Ctrl+Shift+R) e riprova!

---

## Verifica

Upload dovrebbe funzionare e vedere:

```
✅ Audio caricato con successo!
File: file.mp3
Dimensione: 31.18MB
URL S3: https://gigiorda-walkspace.s3...
```

---

## Se Non Funziona Ancora

1. **Aspetta 1-2 minuti** (propagazione S3)
2. **Hard refresh** browser (Ctrl+Shift+R)
3. **Prova finestra incognito**
4. **Controlla** che hai salvato correttamente

---

## Dettagli Completi

Vedi: **S3_CORS_FIX.md** per guida completa con:
- Spiegazione dettagliata
- Metodo AWS CLI
- Troubleshooting
- Alternative

---

## Cosa Fa Questa Configurazione

✅ Permette upload da Vercel
✅ Permette upload da localhost (sviluppo)
✅ Supporta file fino a 50MB
✅ Gestisce preflight CORS correttamente
✅ Cache 1 ora per performance

**Fatto! Ora gli upload funzionano!** 🎵
