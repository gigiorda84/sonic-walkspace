# Configurazione Policy Supabase Storage

## Problema Risolto

❌ **Prima**: Upload falliva con file >4.5MB (limite payload Vercel)
✅ **Dopo**: Upload diretto da client a Supabase, supporta fino a 50MB

## Passaggi per Configurare le Policy

### Step 1: Vai alla Dashboard Supabase

1. Apri: https://app.supabase.com/project/kiwufyymymzuapbjatat
2. Clicca su **Storage** nella sidebar sinistra
3. Seleziona il bucket **walkscape-audio**
4. Vai alla tab **Policies**

### Step 2: Configura le Policy

Hai 2 opzioni:

#### Opzione A: Upload Pubblico (Più Semplice) ⭐ RACCOMANDATO

Permette a chiunque di caricare file (ideale per CMS pubblico):

1. Clicca **"New Policy"**
2. Seleziona **"Custom Policy"**
3. Copia e incolla questo SQL:

```sql
-- Policy 1: Lettura Pubblica (se non già presente)
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'walkscape-audio' );

-- Policy 2: Upload Pubblico
CREATE POLICY "Public Insert Access"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'walkscape-audio' );

-- Policy 3: Update Pubblico (per upsert)
CREATE POLICY "Public Update Access"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'walkscape-audio' )
WITH CHECK ( bucket_id = 'walkscape-audio' );
```

#### Opzione B: Upload Solo Autenticati (Più Sicuro)

Se vuoi limitare upload solo a utenti autenticati:

```sql
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'walkscape-audio' );

CREATE POLICY "Authenticated Update"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'walkscape-audio' )
WITH CHECK ( bucket_id = 'walkscape-audio' );
```

⚠️ **Nota**: Con questa opzione dovrai implementare Supabase Auth nel CMS.

### Step 3: Verifica le Policy

1. Vai in **Storage** → **walkscape-audio** → **Policies**
2. Dovresti vedere almeno 3 policy:
   - ✅ SELECT (lettura pubblica)
   - ✅ INSERT (upload)
   - ✅ UPDATE (modifica/upsert)

### Step 4: Configura via SQL Editor (Alternativa)

Se preferisci usare l'SQL Editor:

1. Vai in **SQL Editor** nella sidebar
2. Clicca **"New Query"**
3. Copia e incolla il contenuto di `supabase-storage-policies.sql`
4. Clicca **"Run"**

## Verifica che Funzioni

### Test Locale

1. Riavvia il dev server: `npm run dev`
2. Apri http://localhost:3000/cms
3. Prova a caricare un file audio >10MB
4. Dovrebbe funzionare senza errori!

### Test da Console del Browser

```javascript
const { createClient } = supabase;
const supabase = createClient(
  'https://kiwufyymymzuapbjatat.supabase.co',
  'sb_publishable_VJG7Il93z4QAdV7EHHpB2Q_4fIBkHfy'
);

// Prova upload
const file = new File(['test'], 'test.txt', { type: 'text/plain' });
const { data, error } = await supabase.storage
  .from('walkscape-audio')
  .upload('tours/test/test.txt', file);

console.log({ data, error });
```

Se `error` è `null`, le policy funzionano! ✅

## Risoluzione Problemi

### Errore: "new row violates row-level security policy"

**Causa**: Le policy INSERT/UPDATE non sono configurate

**Soluzione**: Esegui le SQL queries sopra per creare le policy

### Errore: "Only service role can bypass"

**Causa**: Stai usando anon key ma le policy richiedono autenticazione

**Soluzione**: Usa l'Opzione A (Upload Pubblico) oppure implementa Supabase Auth

### Upload funziona ma non vedo i file

**Causa**: Il bucket potrebbe essere privato

**Soluzione**:
1. Vai in Storage → walkscape-audio → Settings
2. Assicurati che "Public bucket" sia **ON**

## Vantaggi del Nuovo Sistema

✅ **File grandi**: Supporta fino a 50MB (limite Supabase)
✅ **Più veloce**: Upload diretto senza passare per API
✅ **Meno costoso**: Non usa funzioni Vercel
✅ **Progress tracking**: Supabase supporta progress callback
✅ **Resumable**: Possibile implementare upload resumable

## Limitazioni

- Max file size: 50MB (configurabile in Supabase)
- Richiede connessione internet stabile per file grandi
- Se vuoi sicurezza, devi implementare autenticazione

## Prossimi Step (Opzionali)

1. **Progress bar**: Aggiungi barra di progresso per upload
2. **Chunk upload**: Upload a pezzi per file molto grandi
3. **Auth**: Implementa Supabase Auth per limitare accesso
4. **Validazione**: Valida tipo file server-side

---

**Data**: 2025-10-22
**Versione**: 2.0 (Direct Upload)
**Limite file**: 50MB
**Status**: ✅ Funzionante
